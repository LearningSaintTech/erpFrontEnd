import { useQueryClient } from '@tanstack/react-query';
import { Badge, type ErpTone } from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import { materialParts, transactionLabel } from './inventoryUtils';

export {
  ActionStack,
  EmptyRow,
  InfoBanner,
  StatTile,
  TabShell,
  TabToolbar,
  TablePager,
  TextLink,
  btnSm,
  fieldLabel,
} from '../../components/erp/erpLayout';

export const INVENTORY_PAGE_SIZE = 20;

export function useInventoryPerms() {
  const { permissions } = useAuth();
  const has = (p: string) => permissions.includes('*') || permissions.includes(p);
  return {
    canCreate: has('inventory.create'),
    canUpdate: has('inventory.update'),
    canExport: has('inventory.export'),
    canRequestPurchase: has('purchase.create'),
    canPutAway: has('warehouse.update'),
    canReadSkus: has('sku.read') || has('inventory.read'),
  };
}
export type InventoryPerms = ReturnType<typeof useInventoryPerms>;

/** Everything an inventory mutation can affect. */
export function useInvalidateInventory() {
  const qc = useQueryClient();
  return () => {
    [
      'materials-page', 'materials', 'materials-reserve', 'inventory-balances', 'inventory-balances-page',
      'inventory-stats', 'inventory-transactions', 'inventory-availability', 'inventory-manual-reservations',
      'warehouse-stats', 'purchase-list', 'purchase-stats', 'prs-open-for-alerts', 'qc-queue', 'quality-stats',
      'material-master-requests',
    ].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };
}

export function MaterialCell({
  materialId,
}: {
  materialId: { materialCode?: string; name?: string } | string | undefined;
}) {
  const { code, name } = materialParts(materialId);
  return (
    <div className="min-w-[140px]">
      <p className="font-mono text-[13px] font-medium text-erp-text-primary">{code}</p>
      {name ? <p className="text-[13px] text-erp-text-muted">{name}</p> : null}
    </div>
  );
}

export function LocationPill({ label, onDock }: { label: string; onDock: boolean }) {
  return (
    <Badge tone={onDock ? 'info' : 'neutral'} dot={onDock} className="max-w-[180px]" title={label}>
      {label}
    </Badge>
  );
}

const TX_TONE: Record<string, ErpTone> = {
  RECEIPT: 'success',
  ISSUE: 'danger',
  RESERVATION: 'warning',
  RESERVATION_RELEASE: 'info',
  TRANSFER: 'info',
};

export function TxTypeBadge({ type }: { type: string }) {
  return <Badge tone={TX_TONE[type] ?? 'neutral'}>{transactionLabel(type)}</Badge>;
}
