import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  BarChart3,
  Box,
  ChevronDown,
  ClipboardCheck,
  Factory,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Menu,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  Warehouse,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider';
import { FactorySwitcher } from './FactorySwitcher';
import { NotificationBell } from './NotificationBell';
import { ChatBell } from './chat/ChatBell';
import {
  getVisiblePanelGroups, isDesignerOnlyNav, isPatternMasterOnlyNav, type NavItem, type PanelGroup,
} from '../config/panels';

function navIconFor(to: string): ComponentType<{ className?: string }> {
  if (to === '/') return LayoutDashboard;
  if (to.startsWith('/admin') || to === '/audit') return Shield;
  if (to === '/users') return Users;
  if (to === '/settings' || to.startsWith('/approvals')) return Settings;
  if (to.startsWith('/design')) return Wrench;
  if (to.startsWith('/pattern')) return Wrench;
  if (to.startsWith('/sample')) return ClipboardCheck;
  if (to.includes('/sku') || to.includes('/bom')) return Package;
  if (to.startsWith('/inventory')) return Box;
  if (to.startsWith('/vendors')) return Users;
  if (to.startsWith('/purchase')) return ShoppingCart;
  if (to.startsWith('/production') || to.startsWith('/waste')) return Factory;
  if (to.startsWith('/warehouse')) return Warehouse;
  if (to.startsWith('/quality')) return ClipboardCheck;
  if (to.startsWith('/report') || to.startsWith('/notification')) return BarChart3;
  if (to.startsWith('/chat')) return MessageSquare;
  return LayoutDashboard;
}

function groupIconFor(group: PanelGroup): ComponentType<{ className?: string }> {
  const first = group.items[0]?.to || '/';
  return navIconFor(first);
}

function pathMatchesItem(pathname: string, item: NavItem): boolean {
  if (item.end) return pathname === item.to;
  if (item.to === '/') return pathname === '/';
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function groupContainsPath(pathname: string, items: NavItem[]): boolean {
  return items.some((item) => pathMatchesItem(pathname, item));
}

function NavGroupDropdown({
  group,
  onNavigate,
}: {
  group: PanelGroup;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const items = group.items;
  const activeInGroup = groupContainsPath(location.pathname, items);
  const [open, setOpen] = useState(activeInGroup);

  useEffect(() => {
    if (activeInGroup) setOpen(true);
  }, [activeInGroup, location.pathname]);

  const GroupIcon = groupIconFor(group);

  // Single link — no nested dropdown needed
  if (items.length === 1) {
    const item = items[0];
    const Icon = navIconFor(item.to);
    return (
      <div>
        <NavLink
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `erp-nav-item w-full${isActive ? ' erp-nav-item-active' : ''}`
          }
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{group.label === 'Overview' ? item.label : group.label}</span>
        </NavLink>
      </div>
    );
  }

  return (
    <div className="erp-nav-dropdown">
      <button
        type="button"
        className={`erp-nav-item erp-nav-dropdown-trigger w-full${activeInGroup ? ' erp-nav-item-active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <GroupIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul className="erp-nav-dropdown-menu mt-0.5 space-y-0.5 pb-0.5 pl-2">
          {items.map((item: NavItem) => {
            const Icon = navIconFor(item.to);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `erp-nav-item erp-nav-subitem w-full${isActive ? ' erp-nav-item-active' : ''}`
                  }
                >
                  <Icon className="h-3 w-3 shrink-0 opacity-80" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { permissions, user, logout } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const designerOnly = isDesignerOnlyNav(permissions, isSuperAdmin);
  const patternMasterOnly = isPatternMasterOnlyNav(permissions, isSuperAdmin);
  const focusedRoleNav = designerOnly || patternMasterOnly;
  const visibleGroups = useMemo(
    () => getVisiblePanelGroups(permissions, isSuperAdmin),
    [permissions, isSuperAdmin],
  );
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || '?';

  return (
    <>
      <div className="erp-sidebar-top shrink-0 p-3">
        <div className="erp-sidebar-glass erp-sidebar-glass-brand flex items-center gap-2.5 rounded-xl p-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
            style={{ backgroundColor: 'var(--erp-accent)' }}
          >
            E
          </div>
          <div className="min-w-0">
            <p className="truncate text-[var(--erp-font-sm)] font-semibold text-[var(--erp-sidebar-text-primary)]">
              ERP Factory
            </p>
            <p className="truncate text-[10px] text-[var(--erp-sidebar-text-muted)]">
              {patternMasterOnly ? 'Pattern workspace' : designerOnly ? 'Design workspace' : 'Factory workspace'}
            </p>
          </div>
        </div>
      </div>

      <nav className="erp-sidebar-nav min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 py-1">
        {visibleGroups.map((group) => (
          <NavGroupDropdown key={group.id} group={group} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="erp-sidebar-bottom shrink-0 p-3">
        <div className="erp-sidebar-glass erp-sidebar-glass-footer space-y-1 rounded-xl p-2">
          <div className="flex items-center gap-2.5 rounded-lg p-1.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
              style={{ background: 'var(--erp-accent-muted)', color: 'var(--erp-accent)' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[var(--erp-font-xs)] font-medium text-[var(--erp-sidebar-text-primary)]">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[10px] text-[var(--erp-sidebar-text-muted)]">{user?.email}</p>
            </div>
          </div>
          {!focusedRoleNav && (
            <div className="px-1 pb-0.5">
              <FactorySwitcher />
            </div>
          )}
          <button type="button" className="erp-nav-item w-full" onClick={() => logout()}>
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </>
  );
}

export function AppLayout() {
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const patternMasterOnly = isPatternMasterOnlyNav(permissions, isSuperAdmin);
  const canNotify = isSuperAdmin || permissions.includes('*') || permissions.includes('notification.read');
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (patternMasterOnly && (location.pathname === '/' || location.pathname.startsWith('/designs'))) {
      navigate('/pattern', { replace: true });
    }
  }, [patternMasterOnly, location.pathname, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="erp-shell-with-sidebar min-h-screen">
      <aside className="erp-sidebar erp-sidebar-fixed hidden md:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="erp-drawer-overlay absolute inset-0 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="erp-drawer-panel erp-sidebar relative flex h-full w-56 flex-col">
            <button
              type="button"
              className="erp-icon-btn absolute right-3 top-4 z-10"
              onClick={() => setMobileOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="erp-shell-main flex min-h-screen min-w-0 flex-col">
        <header className="erp-header-bar flex shrink-0 items-center justify-between border-b px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="erp-icon-btn md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-[var(--erp-font-md)] font-semibold text-erp-text-primary">ERP Factory</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <ChatBell />
            {canNotify && <NotificationBell />}
          </div>
        </header>

        <main className="erp-main-area min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
