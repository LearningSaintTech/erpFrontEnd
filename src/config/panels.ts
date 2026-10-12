/**
 * Sidebar navigation — grouped for daily use:
 * Dashboard · Approvals · Develop · Products · Procure · Stock · Make · Quality · Insights · Administration.
 * Permission filtering via getVisiblePanelGroups(); routes are unchanged.
 */
import {
  BarChart3, Barcode, Bell, Boxes, Building, Building2, ClipboardCheck, Cog, Factory, History, Inbox,
  Landmark, Layers, LayoutDashboard, ListChecks, MessageSquare, Palette, Recycle, Scissors, Settings,
  ShieldCheck, Shirt, ShoppingCart, Tag, Users, Warehouse, Workflow, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  /** Route (may include a query string, e.g. '/approvals?tab=workflows'). */
  to: string;
  label: string;
  end?: boolean;
  perm?: string;
  superAdminOnly?: boolean;
  icon?: LucideIcon;
  /** Nested links (rendered as a collapsible sub-list). */
  children?: NavItem[];
  /** Extra words for the command palette search. */
  keywords?: string;
}

export interface PanelGroup {
  id: string;
  /** Section label; empty for the unlabeled top section. */
  label: string;
  items: NavItem[];
}

export const panelGroups: PanelGroup[] = [
  {
    id: 'overview',
    label: '',
    items: [
      { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard, keywords: 'home overview kpi' },
      { to: '/approvals', label: 'Approvals', perm: 'approval.read', icon: Inbox, keywords: 'inbox pending approve reject' },
    ],
  },
  {
    id: 'develop',
    label: 'Develop',
    items: [
      { to: '/designs', label: 'Designs', perm: 'design.read', icon: Palette, keywords: 'tech pack style' },
      { to: '/pattern', label: 'Patterns', perm: 'pattern.read', icon: Scissors, keywords: 'pattern development marker grading' },
      { to: '/samples', label: 'Samples', perm: 'sampling.read', icon: Shirt, keywords: 'sampling fit qc proto' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    items: [
      { to: '/products/skus', label: 'SKUs', perm: 'sku.read', icon: Tag, keywords: 'product variant' },
      { to: '/products/boms', label: 'BOMs', perm: 'bom.read', icon: Layers, keywords: 'bill of materials costing' },
    ],
  },
  {
    id: 'procure',
    label: 'Procure',
    items: [
      { to: '/purchase', label: 'Purchase', perm: 'purchase.read', icon: ShoppingCart, keywords: 'pr po grn requisition payment receipt' },
      { to: '/vendors', label: 'Vendors', perm: 'purchase.read', icon: Building2, keywords: 'supplier' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    items: [
      { to: '/inventory', label: 'Inventory', perm: 'inventory.read', icon: Boxes, keywords: 'stock materials fabric trims' },
      {
        to: '/warehouse',
        label: 'Warehouse',
        perm: 'warehouse.read',
        icon: Warehouse,
        keywords: 'bins locations',
        children: [
          { to: '/warehouse/warehouses', label: 'Sites & layout', perm: 'warehouse.read' },
          { to: '/warehouse/stock-locator', label: 'Find stock', perm: 'warehouse.read' },
          { to: '/warehouse/operations/put-away', label: 'Put away', perm: 'warehouse.read' },
          { to: '/warehouse/operations/picking', label: 'Picking', perm: 'warehouse.read' },
          { to: '/warehouse/operations/transfer', label: 'Bin transfer', perm: 'warehouse.read' },
          { to: '/warehouse/operations/dispatch', label: 'Dispatch', perm: 'warehouse.read' },
          { to: '/warehouse/cycle-counts', label: 'Cycle counts', perm: 'warehouse.read' },
        ],
      },
    ],
  },
  {
    id: 'make',
    label: 'Make',
    items: [
      { to: '/production/orders', label: 'Production orders', perm: 'production.read', icon: Factory, keywords: 'batches work orders cutting' },
      { to: '/production/machines', label: 'Machines & capacity', perm: 'production.read', icon: Cog, keywords: 'lines capacity' },
      { to: '/waste', label: 'Waste', perm: 'waste.read', icon: Recycle, keywords: 'scrap recovery' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    items: [
      { to: '/quality/inspections', label: 'Inspections', perm: 'quality.read', icon: ClipboardCheck, keywords: 'qc aql' },
      { to: '/quality/capa', label: 'CAPA', perm: 'quality.read', icon: ShieldCheck, keywords: 'corrective preventive action' },
      { to: '/quality/templates', label: 'Templates', perm: 'quality.read', icon: ListChecks, keywords: 'checklist' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { to: '/reports/factory', label: 'Reports', perm: 'report.read', icon: BarChart3, keywords: 'analytics' },
      { to: '/notifications', label: 'Notifications', perm: 'notification.read', icon: Bell, keywords: 'alerts' },
      { to: '/chat', label: 'Messages', perm: 'chat.read', icon: MessageSquare, keywords: 'chat' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users & roles', perm: 'user.read', icon: Users, keywords: 'rbac permissions delegation' },
      { to: '/approvals?tab=workflows', label: 'Approval workflows', perm: 'approval.read', icon: Workflow, keywords: 'levels approvers' },
      { to: '/settings', label: 'Settings', perm: 'settings.configure', icon: Settings, keywords: 'configuration' },
      { to: '/settings/factory-settings', label: 'Factory settings', perm: 'factory.configure', icon: Building, keywords: 'factory' },
      { to: '/settings/inventory-codes', label: 'Inventory codes', perm: 'inventory.configure', icon: Barcode, keywords: 'codes categories' },
      { to: '/audit', label: 'Audit logs', perm: 'audit.read', icon: History, keywords: 'activity history' },
      { to: '/admin/organizations', label: 'Organizations', perm: 'organization.read', superAdminOnly: true, icon: Landmark, keywords: 'tenants' },
    ],
  },
];

export function canAccessNav(
  permissions: string[],
  item: NavItem,
  isSuperAdmin: boolean,
): boolean {
  if (item.superAdminOnly && !isSuperAdmin) return false;
  if (!item.perm) return true;
  if (isSuperAdmin || permissions.includes('*')) return true;
  return permissions.includes(item.perm);
}

/**
 * Designer role: dashboard + designs + collaboration.
 * `inventory.read` is only used to pick fabric names in the tech pack — not a store panel.
 */
export function isDesignerOnlyNav(permissions: string[], isSuperAdmin: boolean): boolean {
  if (isSuperAdmin || permissions.includes('*')) return false;
  const hasDesign = permissions.includes('design.read') || permissions.includes('design.create');
  const hasBroaderAccess =
    permissions.includes('user.read')
    || permissions.includes('design.approve')
    || permissions.includes('sampling.read')
    || permissions.includes('pattern.update')
    || permissions.includes('report.read');
  return hasDesign && !hasBroaderAccess;
}

/**
 * Pattern Master: pattern development + assigned sampling workflow + chat/notifications.
 * No design library, admin, inventory, or reports.
 */
export function isPatternMasterOnlyNav(permissions: string[], isSuperAdmin: boolean): boolean {
  if (isSuperAdmin || permissions.includes('*')) return false;
  if (!permissions.includes('pattern.update')) return false;
  const hasBroaderAccess =
    permissions.includes('pattern.create')
    || permissions.includes('pattern.approve')
    || permissions.includes('design.create')
    || permissions.includes('design.approve')
    || permissions.includes('user.read')
    || permissions.includes('inventory.read')
    || permissions.includes('report.read');
  return !hasBroaderAccess;
}

/** Routes kept in the focused (designer / pattern-master) navs, besides Insights. */
const DESIGNER_ROUTES = new Set(['/', '/designs']);
const PATTERN_MASTER_ROUTES = new Set(['/pattern', '/samples']);

export function getVisiblePanelGroups(
  permissions: string[],
  isSuperAdmin: boolean,
): PanelGroup[] {
  const designerOnly = isDesignerOnlyNav(permissions, isSuperAdmin);
  const patternMasterOnly = isPatternMasterOnlyNav(permissions, isSuperAdmin);
  const focused = designerOnly || patternMasterOnly;

  const keepInFocused = (group: PanelGroup, item: NavItem) => {
    if (group.id === 'insights') return !item.to.startsWith('/reports');
    if (designerOnly) return DESIGNER_ROUTES.has(item.to);
    if (patternMasterOnly) return PATTERN_MASTER_ROUTES.has(item.to);
    return true;
  };

  return panelGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !focused || keepInFocused(group, item))
        .filter((item) => canAccessNav(permissions, item, isSuperAdmin))
        .map((item) => (item.children
          ? { ...item, children: item.children.filter((c) => canAccessNav(permissions, c, isSuperAdmin)) }
          : item))
        .filter((item) => !item.children || item.children.length > 0),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flattened list of every visible link (children included) — for breadcrumbs and the command palette. */
export function flattenNav(groups: PanelGroup[]): Array<NavItem & { section: string; parent?: NavItem }> {
  const out: Array<NavItem & { section: string; parent?: NavItem }> = [];
  groups.forEach((g) => g.items.forEach((item) => {
    if (item.children?.length) {
      item.children.forEach((c) => out.push({ ...c, icon: c.icon || item.icon, section: g.label, parent: item }));
    } else {
      out.push({ ...item, section: g.label });
    }
  }));
  return out;
}

/** Path part of a nav `to` (without query). */
export function navPath(to: string): string {
  return to.split('?')[0];
}

/** Best (longest) nav match for the current location; query-string items match only when their params match. */
export function findActiveNav<T extends NavItem>(items: T[], pathname: string, search: string): T | undefined {
  const params = new URLSearchParams(search);
  let best: T | undefined;
  let bestScore = -1;
  for (const item of items) {
    const [path, query] = item.to.split('?');
    const pathOk = item.end || path === '/'
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`);
    if (!pathOk) continue;
    let score = path.length;
    if (query) {
      const q = new URLSearchParams(query);
      let all = true;
      q.forEach((v, k) => { if (params.get(k) !== v) all = false; });
      if (!all) continue;
      score += 1000;
    }
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}
