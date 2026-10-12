import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileText, ImagePlus } from 'lucide-react';
import { ErpInput, IconButton, type ErpInputProps } from '../../components/erp';
import { PreviewableImage } from '../../components/ImagePreview';
import { useAuth } from '../../app/providers/AuthProvider';
import type { PurchaseLine } from '../../types/api';
import { mediaUrl } from '../inventory/inventoryUtils';
import { materialLabel } from './purchaseUtils';

export const PURCHASE_PAGE_SIZE = 15;
export const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

export type ReceiptFile = {
  url?: string;
  fileName?: string;
  kind?: 'po' | 'grn';
  docId?: string;
  index?: number;
};

/** Permission flags used across the purchase screens. */
export function usePurchasePerms() {
  const { permissions, user } = useAuth();
  const has = (p: string) => permissions.includes('*') || permissions.includes(p);
  const canCreate = has('purchase.create');
  const canApprove = has('purchase.approve');
  return {
    permissions,
    userId: user?._id,
    canCreate,
    canUpdate: has('purchase.update'),
    canApprove,
    canApprovePr: has('purchase.authorize'),
    canMarkPaid: has('purchase.pay'),
    canExport: has('purchase.export'),
    canReadApprovals: has('approval.read'),
    /** Create payments / suppliers (needs create + approve, as the API does). */
    canExecute: canCreate && canApprove,
    canReceive: canCreate,
    /** Cross-module links: only offer pages the user can actually open. */
    canOpenQc: has('quality.read'),
    canPutAway: has('warehouse.update') || has('inventory.update'),
    canSeeProduction: has('production.read'),
  };
}

export type PurchasePerms = ReturnType<typeof usePurchasePerms>;

/** Every query a purchase mutation can affect (purchase, inventory, QC, dashboards). */
export function useInvalidatePurchase() {
  const qc = useQueryClient();
  return () => {
    [
      'purchase-list', 'purchase-stats', 'prs', 'prs-approved', 'pos', 'pos-open', 'pos-pr-link', 'grns',
      'grns-history-link', 'suppliers-all', 'suppliers-active', 'vendors-list', 'vendors-count',
      'approvals-pending', 'approvals-pending-pr', 'inventory-balances', 'inventory-balances-page',
      'inventory-availability', 'inventory-stats', 'warehouse-stats', 'qc-queue', 'quality-stats',
      'dashboard-financial', 'reports', 'prs-open-for-alerts',
    ].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Number input with the unit shown inside the right edge, e.g. "120  Meters". */
export function UnitInput({ unit, className = '', ...props }: ErpInputProps & { unit?: ReactNode }) {
  return (
    <div className="relative min-w-0">
      <ErpInput type="number" inputMode="decimal" {...props} className={`erp-num ${unit ? 'pr-20' : ''} ${className}`.trim()} />
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 max-w-[4.5rem] -translate-y-1/2 truncate text-xs text-erp-text-muted">
          {unit}
        </span>
      )}
    </div>
  );
}

export function lineQty(l: PurchaseLine) {
  return l.requiredQty ?? l.orderedQty ?? l.quantity ?? 0;
}

/** Compact item list for table cells: first two lines + "+N more". */
/** `itemWidth` caps each line — tighter in wide tables (Payments) so the row actions stay in view. */
export function LinesList({ lines, max = 2, itemWidth = 'max-w-[280px]' }: { lines?: PurchaseLine[]; max?: number; itemWidth?: string }) {
  if (!lines?.length) return <span className="text-erp-text-muted">—</span>;
  const shown = lines.slice(0, max);
  const rest = lines.length - shown.length;
  return (
    <ul className="space-y-0.5">
      {shown.map((l, i) => (
        <li key={i} className={`${itemWidth} truncate text-[13px] leading-snug`} title={materialLabel(l.materialId)}>
          <span className="text-erp-text-primary">{materialLabel(l.materialId)}</span>
          <span className="erp-tabular text-erp-text-muted"> · {lineQty(l).toLocaleString()} {l.unit ? l.unit.toLowerCase() : ''}</span>
        </li>
      ))}
      {rest > 0 && <li className="text-xs text-erp-text-muted">+{rest} more</li>}
    </ul>
  );
}

function isPdfReceipt(item: { url?: string; fileName?: string }) {
  return /\.pdf($|\?)/i.test(item.fileName || item.url || '');
}

/** Invoice / supporting-document thumbnails with optional upload + download. */
export function ReceiptThumbs({
  items, pending, canAdd, onAdd, onDownload, addLabel = 'Add',
}: {
  items?: ReceiptFile[];
  pending?: File[];
  canAdd?: boolean;
  onAdd?: (files: File[]) => void;
  onDownload?: (item: ReceiptFile) => void;
  addLabel?: string;
}) {
  const saved = items?.filter((r) => r.url) || [];
  const imageGallery = [
    ...saved.filter((r) => !isPdfReceipt(r)).map((r) => ({ src: mediaUrl(r.url), alt: r.fileName || 'Invoice' })),
    ...(pending || []).filter((f) => f.type !== 'application/pdf').map((f) => ({ src: URL.createObjectURL(f), alt: f.name })),
  ];
  if (!saved.length && !pending?.length && !canAdd) {
    return <span className="text-[13px] text-erp-text-muted">—</span>;
  }
  let imageIndex = 0;
  return (
    // Clicks here must not open the row's detail drawer.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {saved.map((r, i) => {
        const href = mediaUrl(r.url);
        const file = { ...r, index: r.index ?? i };
        const downloadBtn = onDownload ? (
          <IconButton size="sm" aria-label={`Download ${r.fileName || 'invoice'}`} onClick={() => onDownload(file)}>
            <Download size={14} />
          </IconButton>
        ) : null;
        if (isPdfReceipt(r)) {
          return (
            <span key={r.url} className="inline-flex items-center gap-0.5">
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--erp-border)] px-2 text-xs text-erp-text-secondary hover:bg-[var(--erp-surface-muted)]"
                title={r.fileName || 'Invoice PDF'}
              >
                <FileText size={14} />
                PDF
              </a>
              {downloadBtn}
            </span>
          );
        }
        const idx = imageIndex;
        imageIndex += 1;
        return (
          <span key={r.url} className="inline-flex items-center gap-0.5">
            <PreviewableImage
              src={href}
              alt={r.fileName || 'Invoice'}
              className="h-9 w-9 rounded-md object-cover"
              gallery={imageGallery}
              galleryIndex={idx}
              onDownload={onDownload ? () => onDownload(file) : undefined}
            />
            {downloadBtn}
          </span>
        );
      })}
      {pending?.map((file, i) => {
        if (file.type === 'application/pdf') {
          return (
            <span key={`${file.name}-${i}`} className="inline-flex h-9 max-w-[160px] items-center truncate rounded-md border border-dashed border-[var(--erp-border)] px-2 text-xs text-erp-text-muted">
              {file.name}
            </span>
          );
        }
        const idx = imageIndex;
        imageIndex += 1;
        return (
          <PreviewableImage
            key={`${file.name}-${i}`}
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="h-9 w-9 rounded-md object-cover"
            gallery={imageGallery}
            galleryIndex={idx}
          />
        );
      })}
      {canAdd && onAdd && (
        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-[var(--erp-border)] px-2.5 text-xs font-medium text-erp-text-secondary hover:bg-[var(--erp-surface-muted)]">
          <ImagePlus size={14} aria-hidden="true" />
          {addLabel}
          <input
            type="file"
            accept={RECEIPT_ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              e.target.value = '';
              if (files.length) onAdd(files);
            }}
          />
        </label>
      )}
    </div>
  );
}

export function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
