import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button, Drawer, ErpDataTable, ErpSearchSelect, Field, InfoBanner, Skeleton, type ErpSearchOption,
} from '../../components/erp';
import { purchaseApi } from '../../services/operations';
import type { GoodsReceipt, Material, PurchaseOrder } from '../../types/api';
import { filesToImagePayloads, unitLabel } from '../inventory/inventoryUtils';
import { formatCurrency, PO_OPEN_STATUSES, supplierLabel } from './purchaseUtils';
import { ReceiptThumbs, UnitInput, useInvalidatePurchase } from './purchaseShared';

const materialKey = (id: string | Material) => (typeof id === 'string' ? id : id._id);

/** Receive goods against an open payment (creates a GRN in Draft → QC). */
export function GrnFormDrawer({
  open, onClose, initialPoId, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialPoId?: string;
  onCreated?: (grn: GoodsReceipt) => void;
}) {
  const invalidate = useInvalidatePurchase();
  const [poId, setPoId] = useState('');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setPoId(initialPoId || '');
    setQtys({});
    setFiles([]);
    setErrors({});
  }, [open, initialPoId]);

  const { data: openPos = [], isLoading: posLoading } = useQuery({
    queryKey: ['pos-open'],
    queryFn: () => purchaseApi.listPOs({ status: PO_OPEN_STATUSES.join(','), limit: 500 }),
    enabled: open,
  });
  const poOptions: ErpSearchOption[] = useMemo(() => openPos.map((po: PurchaseOrder) => ({
    value: po._id,
    label: `${po.poNumber} · ${supplierLabel(po.supplierId)} · ${formatCurrency(po.totalAmount)}`,
  })), [openPos]);

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['po-receipt-preview', poId],
    queryFn: () => purchaseApi.poReceiptPreview(poId),
    enabled: open && !!poId,
  });
  const lines = preview?.lines ?? [];

  const qtyOf = (mid: string, remaining: number) => {
    const raw = qtys[mid];
    return raw === undefined ? remaining : raw === '' ? 0 : Number(raw);
  };

  const create = useMutation({
    mutationFn: async () => {
      const body = lines
        .map((l) => {
          const mid = materialKey(l.materialId);
          return { materialId: mid, receivedQty: qtyOf(mid, l.remainingQty), unit: l.unit };
        })
        .filter((l) => (l.receivedQty ?? 0) > 0);
      const receipts = await filesToImagePayloads(files);
      return purchaseApi.createGRN({ poId, lines: body, receipts });
    },
    meta: { successMessage: 'Goods receipt recorded', successDescription: 'Submit it for incoming QC once the invoice is attached.' },
    onSuccess: (grn) => {
      invalidate();
      onCreated?.(grn);
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!poId) next.po = 'Choose the payment these goods belong to.';
    let any = false;
    lines.forEach((l) => {
      const mid = materialKey(l.materialId);
      const q = qtyOf(mid, l.remainingQty);
      if (!Number.isFinite(q) || q < 0) next[`qty.${mid}`] = 'Enter 0 or more.';
      else if (q > l.remainingQty) next[`qty.${mid}`] = `Only ${l.remainingQty} ${unitLabel(l.unit).toLowerCase()} still due.`;
      if (q > 0) any = true;
    });
    if (poId && lines.length && !any) next.lines = 'Enter a received quantity for at least one material.';
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={false}
      title="Receive goods"
      description="Record what arrived against a payment. Stock updates after incoming QC passes."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="grn-form" loading={create.isPending} disabled={!poId || !lines.length}>
            Record receipt
          </Button>
        </>
      )}
    >
      <form id="grn-form" onSubmit={submit} noValidate className="space-y-4">
        {!posLoading && openPos.length === 0 && (
          <InfoBanner inset={false} tone="info">No open payments to receive against. Create a payment from an approved requisition first.</InfoBanner>
        )}
        <Field label="Payment" required error={errors.po}>
          <ErpSearchSelect
            className="w-full"
            value={poId}
            onChange={(v) => { setPoId(v); setQtys({}); setErrors({}); }}
            options={poOptions}
            loading={posLoading}
            placeholder="Choose open payment…"
            searchPlaceholder="Search payment number or supplier…"
          />
        </Field>

        {poId && previewLoading && !lines.length && (
          <div className="space-y-2"><Skeleton height={14} width="60%" /><Skeleton /><Skeleton width="80%" /></div>
        )}
        {poId && !previewLoading && preview && lines.length === 0 && (
          <InfoBanner inset={false} tone="success">Everything on this payment has already been received.</InfoBanner>
        )}

        {lines.length > 0 && (
          <div>
            <p className="erp-field-label mb-1.5">Quantities received</p>
            <div className="erp-table-wrap rounded-lg border border-[var(--erp-border)]">
              <ErpDataTable className="w-full">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="erp-num">Still due</th>
                    <th className="erp-num">Received now</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const mid = materialKey(l.materialId);
                    const err = errors[`qty.${mid}`];
                    return (
                      <tr key={mid}>
                        <td className="min-w-[160px]">
                          <p className="font-mono text-[13px] font-medium">{l.materialCode}</p>
                          <p className="text-[13px] text-erp-text-muted">{l.materialName}</p>
                        </td>
                        <td className="erp-num text-erp-text-muted">{l.remainingQty.toLocaleString()} {unitLabel(l.unit)}</td>
                        <td className="erp-num">
                          <div className="ml-auto w-40">
                            <UnitInput
                              inputSize="sm"
                              min={0}
                              max={l.remainingQty}
                              step="any"
                              unit={unitLabel(l.unit)}
                              aria-label={`Received quantity for ${l.materialCode}`}
                              invalid={!!err}
                              value={qtys[mid] ?? String(l.remainingQty)}
                              onChange={(e) => setQtys((q) => ({ ...q, [mid]: e.target.value }))}
                            />
                          </div>
                          {err && <p className="erp-field-error mt-1 justify-end">{err}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </ErpDataTable>
            </div>
            {errors.lines
              ? <p className="erp-field-error mt-1" role="alert">{errors.lines}</p>
              : <p className="erp-field-hint mt-1">Quantities default to everything still due. Set 0 for items that did not arrive.</p>}
          </div>
        )}

        {lines.length > 0 && (
          <Field label="Supplier invoice" hint="Photo or PDF. Finance uses it to mark the payment as paid.">
            <div>
              <ReceiptThumbs
                pending={files}
                canAdd
                addLabel="Attach invoice"
                onAdd={(f) => setFiles((prev) => [...prev, ...f].slice(0, 12))}
              />
            </div>
          </Field>
        )}
      </form>
    </Drawer>
  );
}
