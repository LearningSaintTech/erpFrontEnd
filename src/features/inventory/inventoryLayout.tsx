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

export function MaterialCell({
  materialId,
}: {
  materialId: { materialCode?: string; name?: string } | string | undefined;
}) {
  const { code, name } = materialParts(materialId);
  return (
    <div className="min-w-[140px]">
      <p className="font-mono text-[12px] font-medium text-erp-text-primary">{code}</p>
      {name ? <p className="text-[12px] text-erp-text-muted">{name}</p> : null}
    </div>
  );
}

export function LocationPill({ label, onDock }: { label: string; onDock: boolean }) {
  return (
    <span
      className={`inline-flex max-w-[180px] truncate rounded-md px-2 py-0.5 text-[11px] font-medium ${
        onDock
          ? 'bg-sky-500/10 text-sky-800'
          : 'bg-[var(--erp-surface-muted)] text-erp-text-secondary'
      }`}
      title={label}
    >
      {label}
    </span>
  );
}

export function TxTypeBadge({ type }: { type: string }) {
  const tone =
    type === 'RECEIPT' ? 'bg-emerald-500/10 text-emerald-800'
      : type === 'ISSUE' ? 'bg-red-500/10 text-red-800'
        : type === 'RESERVATION' ? 'bg-amber-500/10 text-amber-800'
          : type === 'RESERVATION_RELEASE' ? 'bg-sky-500/10 text-sky-800'
            : type === 'TRANSFER' ? 'bg-indigo-500/10 text-indigo-800'
              : 'bg-[var(--erp-surface-muted)] text-erp-text-secondary';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {transactionLabel(type)}
    </span>
  );
}
