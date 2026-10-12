import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X,
} from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider';
import { NotificationBell } from './NotificationBell';
import { ChatBell } from './chat/ChatBell';
import { CommandPalette } from './CommandPalette';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { Breadcrumbs, DropdownMenu, Tooltip, useOverlayBehavior, type Crumb } from './erp';
import { approvalApi } from '../services/approvals';
import { canActOnApproval } from '../features/approvals/approvalUtils';
import {
  findActiveNav, flattenNav, getVisiblePanelGroups, isDesignerOnlyNav, isPatternMasterOnlyNav, navPath,
  type NavItem, type PanelGroup,
} from '../config/panels';

const COLLAPSE_KEY = 'erp-sidebar-collapsed';

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

/* ─────────────────────────────── Sidebar ────────────────────────────────── */

function NavLinkItem({
  item, active, collapsed, badge, onNavigate, sub = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
  sub?: boolean;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`erp-nav-item w-full${sub ? ' erp-nav-subitem' : ''}${active ? ' erp-nav-item-active' : ''}`}
    >
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span className="erp-nav-label min-w-0 flex-1 truncate">{item.label}</span>
      {badge ? <span className="erp-nav-badge" aria-label={`${badge} pending`}>{badge > 99 ? '99+' : badge}</span> : null}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip content={badge ? `${item.label} · ${badge} pending` : item.label} side="right" delay={100} className="flex w-full">
      {link}
    </Tooltip>
  );
}

function NavParentItem({
  item, activeTo, collapsed, onNavigate,
}: {
  item: NavItem;
  activeTo?: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const children = item.children || [];
  const containsActive = children.some((c) => c.to === activeTo);
  const [open, setOpen] = useState(containsActive);
  useEffect(() => { if (containsActive) setOpen(true); }, [containsActive]);
  const Icon = item.icon;

  if (collapsed) {
    // Rail: the parent links to its first child.
    return (
      <NavLinkItem
        item={{ ...item, to: children[0]?.to || item.to }}
        active={containsActive}
        collapsed
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        className={`erp-nav-item erp-nav-dropdown-trigger w-full${containsActive && !open ? ' erp-nav-item-active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {Icon && <Icon size={18} aria-hidden="true" />}
        <span className="erp-nav-label min-w-0 flex-1 truncate text-left">{item.label}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul className="erp-nav-dropdown-menu mt-0.5 space-y-0.5 pl-2">
          {children.map((c) => (
            <li key={c.to}>
              <NavLinkItem item={c} active={c.to === activeTo} collapsed={false} onNavigate={onNavigate} sub />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SidebarContent({
  groups, activeTo, collapsed, onNavigate, onToggleCollapse, approvalsPending, workspaceLabel, onClose,
}: {
  groups: PanelGroup[];
  activeTo?: string;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  approvalsPending?: number;
  workspaceLabel: string;
  onClose?: () => void;
}) {
  return (
    <>
      <div className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-[var(--erp-sidebar-border)] ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
        <Link
          to="/"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5 rounded-md"
          aria-label="ERP Factory — dashboard"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--erp-accent)] text-[13px] font-bold text-white shadow-sm">
            EF
          </span>
          {!collapsed && (
            <span className="min-w-0 erp-nav-hide-collapsed">
              <span className="block truncate text-sm font-semibold leading-5 text-erp-text-primary">ERP Factory</span>
              <span className="block truncate text-xs leading-4 text-erp-text-muted">{workspaceLabel}</span>
            </span>
          )}
        </Link>
        {onClose && (
          <button type="button" className="erp-icon-btn erp-btn-sm ml-auto" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className={`erp-sidebar-nav min-h-0 flex-1 overflow-y-auto py-2 ${collapsed ? 'px-2' : 'px-3'}`} aria-label="Main">
        {groups.map((group) => (
          <div key={group.id} className="erp-nav-section">
            {group.label && !collapsed && <p className="erp-nav-group-label">{group.label}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  {item.children?.length ? (
                    <NavParentItem item={item} activeTo={activeTo} collapsed={collapsed} onNavigate={onNavigate} />
                  ) : (
                    <NavLinkItem
                      item={item}
                      active={item.to === activeTo}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                      badge={navPath(item.to) === '/approvals' && !item.to.includes('?') ? approvalsPending : undefined}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {onToggleCollapse && (
        <div className={`shrink-0 border-t border-[var(--erp-sidebar-border)] py-2 ${collapsed ? 'px-2' : 'px-3'}`}>
          <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right" className="flex w-full">
            <button
              type="button"
              className="erp-nav-item w-full"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
            >
              {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
              <span className="erp-nav-label">Collapse</span>
            </button>
          </Tooltip>
        </div>
      )}
    </>
  );
}

/* ───────────────────────────── Mobile drawer ────────────────────────────── */

function MobileNav({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayBehavior({ open, panelRef, onClose });
  if (!open) return null;
  return (
    <div className="erp-overlay-layer lg:hidden">
      <div className="erp-overlay-backdrop -z-10" aria-hidden="true" onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="erp-sidebar relative flex h-full w-[min(300px,85vw)] flex-col border-r border-[var(--erp-sidebar-border)] shadow-[var(--erp-shadow-xl)]"
        style={{ animation: 'erp-fade-in 150ms ease' }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────── Top bar bits ───────────────────────────── */

function FactorySelect() {
  const { factories, factoryId, setFactoryId } = useAuth();
  if (!factories.length) return null;
  const current = factories.find((f) => f._id === factoryId) || factories[0];
  if (factories.length === 1) {
    return (
      <span
        className="hidden max-w-[220px] items-center truncate rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-2.5 py-1 text-[13px] text-erp-text-secondary md:inline-flex"
        title={`${current.code} — ${current.name}`}
      >
        {current.name}
      </span>
    );
  }
  return (
    <select
      aria-label="Active factory"
      value={factoryId || ''}
      onChange={(e) => setFactoryId(e.target.value)}
      className="erp-select erp-input-sm hidden max-w-[220px] md:block"
    >
      {factories.map((f) => (
        <option key={f._id} value={f._id}>
          {f.code} — {f.name}
        </option>
      ))}
    </select>
  );
}

const EXTRA_CRUMBS: Array<{ match: RegExp; label: string; base?: string }> = [
  { match: /^\/designs\/new$/, label: 'New design', base: '/designs' },
  { match: /^\/designs\/[^/]+\/edit$/, label: 'Edit design', base: '/designs' },
];

function useBreadcrumbs(flat: ReturnType<typeof flattenNav>, pathname: string, search: string): Crumb[] {
  return useMemo(() => {
    if (pathname === '/') return [{ label: 'Dashboard' }];
    if (pathname === '/settings/account') return [{ label: 'My account' }];
    const active = findActiveNav(flat, pathname, search);
    const extra = EXTRA_CRUMBS.find((c) => c.match.test(pathname));
    if (!active) {
      const segs = pathname.split('/').filter(Boolean);
      return segs.map((s, i) => ({
        label: s.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
        to: i < segs.length - 1 ? `/${segs.slice(0, i + 1).join('/')}` : undefined,
      }));
    }
    const crumbs: Crumb[] = [];
    if (active.section) crumbs.push({ label: active.section });
    if (active.parent) crumbs.push({ label: active.parent.label, to: active.parent.children?.[0]?.to });
    crumbs.push({ label: active.label, to: extra ? active.to : undefined });
    if (extra) crumbs.push({ label: extra.label });
    return crumbs;
  }, [flat, pathname, search]);
}

/* ─────────────────────────────── Layout ─────────────────────────────────── */

export function AppLayout() {
  const { permissions, user, logout } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const designerOnly = isDesignerOnlyNav(permissions, isSuperAdmin);
  const patternMasterOnly = isPatternMasterOnlyNav(permissions, isSuperAdmin);
  const focusedRoleNav = designerOnly || patternMasterOnly;
  const can = useCallback(
    (perm: string) => isSuperAdmin || permissions.includes('*') || permissions.includes(perm),
    [isSuperAdmin, permissions],
  );
  const canNotify = can('notification.read');
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const groups = useMemo(() => getVisiblePanelGroups(permissions, isSuperAdmin), [permissions, isSuperAdmin]);
  const flat = useMemo(() => flattenNav(groups), [groups]);
  const activeItem = findActiveNav(flat, location.pathname, location.search);
  const crumbs = useBreadcrumbs(flat, location.pathname, location.search);

  const canSeeApprovals = can('approval.read') && !focusedRoleNav;
  // Count only approvals this user can decide — the factory-wide total contradicted the
  // dashboard's "Approvals for you" for people who can see but not act.
  const { data: myPending } = useQuery({
    queryKey: ['approvals-pending', 'dashboard-mine'],
    queryFn: () => approvalApi.pending({ page: 1, limit: 50 }),
    enabled: canSeeApprovals,
    staleTime: 60_000,
    refetchInterval: 180_000,
  });
  const actionableApprovals = myPending
    ? myPending.items.filter((a) => canActOnApproval(a, permissions, user?._id)).length
    : undefined;

  useEffect(() => {
    if (patternMasterOnly && (location.pathname === '/' || location.pathname.startsWith('/designs'))) {
      navigate('/pattern', { replace: true });
    }
  }, [patternMasterOnly, location.pathname, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const signOut = useCallback(() => { logout().catch(() => {}); }, [logout]);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const workspaceLabel = patternMasterOnly ? 'Pattern workspace' : designerOnly ? 'Design workspace' : 'Factory workspace';
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Account';
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  const sidebarProps = {
    groups,
    activeTo: activeItem?.to,
    approvalsPending: actionableApprovals,
    workspaceLabel,
  };

  return (
    <div className="erp-shell-with-sidebar min-h-screen" data-collapsed={collapsed ? 'true' : 'false'}>
      <a
        href="#erp-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[13000] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside className="erp-sidebar erp-sidebar-fixed hidden lg:flex" aria-label="Sidebar">
        <SidebarContent {...sidebarProps} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <SidebarContent
          {...sidebarProps}
          collapsed={false}
          onNavigate={() => setMobileOpen(false)}
          onClose={() => setMobileOpen(false)}
        />
      </MobileNav>

      <div className="erp-shell-main flex min-h-screen min-w-0 flex-col">
        <header className="erp-header-bar flex shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
          <button
            type="button"
            className="erp-icon-btn lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <Breadcrumbs items={crumbs} className="hidden sm:block" />
            <p className="truncate text-sm font-semibold text-erp-text-primary sm:hidden">
              {String(crumbs[crumbs.length - 1]?.label ?? 'ERP Factory')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-56 items-center gap-2 rounded-md border border-[var(--erp-border-strong)] bg-[var(--erp-surface)] px-2.5 text-[13px] text-erp-text-muted shadow-[var(--erp-shadow-xs)] transition-colors hover:border-[var(--erp-gray-400)] md:flex xl:w-72"
            aria-label="Search pages and actions"
            aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
          >
            <Search size={16} aria-hidden="true" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-1.5 font-sans text-[13px] text-erp-text-muted">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
          <button
            type="button"
            className="erp-icon-btn md:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search pages and actions"
          >
            <Search size={20} />
          </button>

          {!focusedRoleNav && <FactorySelect />}

          <div className="flex items-center gap-0.5">
            <ChatBell />
            {canNotify && <NotificationBell />}
          </div>

          <DropdownMenu
            align="end"
            stopPropagation={false}
            trigger={(
              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-full pl-0.5 pr-0.5 hover:bg-[var(--erp-surface-hover)] sm:pr-2"
                aria-label={`Account menu for ${fullName}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--erp-accent-subtle)] text-xs font-semibold text-[var(--erp-accent-text)]">
                  {initials}
                </span>
                <ChevronDown size={14} className="hidden text-erp-text-muted sm:block" aria-hidden="true" />
              </button>
            )}
            items={[
              {
                type: 'label',
                label: (
                  <span className="block max-w-[240px]">
                    <span className="block truncate text-[13px] font-semibold text-erp-text-primary">{fullName}</span>
                    <span className="block truncate font-normal">{user?.email}</span>
                  </span>
                ),
              },
              { type: 'separator' },
              { label: 'My account', icon: KeyRound, onSelect: () => navigate('/settings/account') },
              { label: 'Sign out', icon: LogOut, onSelect: signOut },
            ]}
          />
        </header>

        {/* pb-24 on phones: the floating chat button must not cover the last row/card. */}
        <main id="erp-main" className="erp-main-area erp-content min-h-0 flex-1 pb-24" tabIndex={-1}>
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        pages={flat}
        can={can}
        hideDesignCreate={patternMasterOnly}
        onSignOut={signOut}
      />
    </div>
  );
}
