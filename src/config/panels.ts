/** Navigation panels aligned with docs/deliverables/ui-ux/panel-map.md and Volume 23 */

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  perm?: string;
  superAdminOnly?: boolean;
}

export interface PanelGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const panelGroups: PanelGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', end: true }],
  },
  {
    id: 'admin',
    label: 'Super Admin',
    items: [
      { to: '/admin/organizations', label: 'Organizations', perm: 'organization.read', superAdminOnly: true },
      { to: '/audit', label: 'Audit Logs', perm: 'audit.read' },
    ],
  },
  {
    id: 'factory',
    label: 'Factory',
    items: [
      { to: '/users', label: 'Users & Roles', perm: 'user.read' },
      { to: '/settings', label: 'Settings', perm: 'settings.configure' },
      { to: '/settings/factory-settings', label: 'Factory Settings', perm: 'factory.configure' },
      { to: '/settings/inventory-codes', label: 'Inventory Codes', perm: 'inventory.configure' },
      { to: '/approvals', label: 'Approval Workflows', perm: 'approval.read' },
    ],
  },
  {
    id: 'design',
    label: 'Design',
    items: [
      { to: '/designs', label: 'Designs', perm: 'design.read' },
    ],
  },
  {
    id: 'pattern',
    label: 'Pattern',
    items: [
      { to: '/pattern', label: 'Pattern Development', perm: 'pattern.read' },
    ],
  },
  {
    id: 'sampling',
    label: 'Sampling',
    items: [{ to: '/samples', label: 'Samples', perm: 'sampling.read' }],
  },
  {
    id: 'products',
    label: 'Products',
    items: [
      { to: '/products/skus', label: 'SKUs', perm: 'sku.read' },
      { to: '/products/boms', label: 'BOMs', perm: 'bom.read' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [{ to: '/inventory', label: 'Stock & Materials', perm: 'inventory.read' }],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    items: [
      { to: '/purchase', label: 'PR · RFQ · PO · GRN', perm: 'purchase.read' },
      { to: '/vendors', label: 'Vendors', perm: 'purchase.read' },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    items: [
      { to: '/production/orders', label: 'Orders & Batches', perm: 'production.read' },
      { to: '/production/machines', label: 'Machines & Capacity', perm: 'production.read' },
      { to: '/waste', label: 'Waste', perm: 'waste.read' },
    ],
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    items: [
      { to: '/warehouse/warehouses', label: 'Sites & layout', perm: 'warehouse.read' },
      { to: '/warehouse/stock-locator', label: 'Find stock', perm: 'warehouse.read' },
      { to: '/warehouse/operations/put-away', label: 'Put away', perm: 'warehouse.read' },
      { to: '/warehouse/operations/picking', label: 'Picking', perm: 'warehouse.read' },
      { to: '/warehouse/operations/transfer', label: 'Bin transfer', perm: 'warehouse.read' },
      { to: '/warehouse/operations/dispatch', label: 'Dispatch', perm: 'warehouse.read' },
      { to: '/warehouse/cycle-counts', label: 'Cycle counts', perm: 'warehouse.read' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    items: [
      { to: '/quality/inspections', label: 'Inspections', perm: 'quality.read' },
      { to: '/quality/capa', label: 'CAPA', perm: 'quality.read' },
      { to: '/quality/templates', label: 'Templates', perm: 'quality.read' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { to: '/reports/factory', label: 'Reports', perm: 'report.read' },
      { to: '/notifications', label: 'Notifications', perm: 'notification.read' },
      { to: '/chat', label: 'Messages', perm: 'chat.read' },
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

export function getVisiblePanelGroups(
  permissions: string[],
  isSuperAdmin: boolean,
): PanelGroup[] {
  const designerOnly = isDesignerOnlyNav(permissions, isSuperAdmin);
  const patternMasterOnly = isPatternMasterOnlyNav(permissions, isSuperAdmin);

  return panelGroups
    .filter((group) => {
      if (designerOnly) return group.id === 'overview' || group.id === 'design' || group.id === 'insights';
      if (patternMasterOnly) {
        return group.id === 'pattern' || group.id === 'sampling' || group.id === 'insights';
      }
      return true;
    })
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canAccessNav(permissions, item, isSuperAdmin))
        .filter((item) => !(
          (designerOnly || patternMasterOnly) && item.to.startsWith('/reports')
        )),
    }))
    .filter((group) => group.items.length > 0);
}
