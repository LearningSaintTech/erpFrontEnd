import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button, Drawer, ErpDataTable, ErpSearchSelect, Field, InfoBanner, type ErpSearchOption,
} from '../../components/erp';
import { purchaseApi } from '../../services/operations';
import type { PurchaseOrder, PurchaseRequisition, Supplier } from '../../types/api';
import { filesToImagePayloads, unitLabel } from '../inventory/inventoryUtils';
import { formatCurrency, materialIdOf, materialLabel } from './purchaseUtils';
import { ReceiptThumbs, UnitInput, useInvalidatePurchase } from './purchaseShared';

/**
 * Record the payment agreed with the supplier for an approved requisition.
 * (There is no supplier portal — price is agreed on a call.)
 */
export function PaymentFormDrawer({
  open, onClose, initialPrId, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialPrId?: string;
  onCreated?: (po: PurchaseOrder) => void;
}) {
  const invalidate = useInvalidatePurchase();
  const [prId, setPrId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setPrId(initialPrId || '');
    setSupplierId('');
    setPrices({});
    setFiles([]);
    setErrors({});
  }, [open, initialPrId]);

  const { data: approvedPrs = [], isLoading: prsLoading } = useQuery({
    queryKey: ['prs-approved'],
    queryFn: () => purchaseApi.listPRs({ status: 'APPROVED' }),
    enabled: open,
  });
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => purchaseApi.listSuppliers({ status: 'ACTIVE' }),
    enabled: open,
    select: (list) => list.filter((s) => (s.status || 'ACTIVE') === 'ACTIVE'),
  });

  const prOptions: ErpSearchOption[] = useMemo(() => approvedPrs.map((p: PurchaseRequisition) => ({
    value: p._id,
    label: `${p.prNumber} · ${(p.lines || []).map((l) => materialLabel(l.materialId)).join(', ')}`,
  })), [approvedPrs]);
  const supplierOptions: ErpSearchOption[] = useMemo(() => suppliers.map((s: Supplier) => ({
    value: s._id,
    label: `${s.supplierCode} — ${s.name}`,
    keywords: s.materialsSupplied,
  })), [suppliers]);

  const pr = approvedPrs.find((p: PurchaseRequisition) => p._id === prId);
  const rows = (pr?.lines || []).map((l) => {
    const mid = materialIdOf(l);
    const raw = prices[mid];
    const price = raw === undefined || raw === '' ? (l.estimatedUnitCost ?? 0) : Number(raw);
    const qty = l.requiredQty ?? 0;
    return { line: l, mid, raw, price, qty, amount: qty * (Number.isFinite(price) ? price : 0) };
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const create = useMutation({
    mutationFn: async () => {
      const receipts = await filesToImagePayloads(files);
      return purchaseApi.createPO({
        prId,
        supplierId,
        receipts,
        ...(rows.length ? { lines: rows.map((r) => ({ materialId: r.mid, unitPrice: r.price })) } : {}),
      });
    },
    meta: { successMessage: 'Payment created', successDescription: 'Record the goods receipt when the shipment arrives.' },
    onSuccess: (po) => {
      invalidate();
      onCreated?.(po);
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!prId) next.pr = 'Choose the approved requisition you are paying for.';
    if (!supplierId) next.supplier = 'Choose the supplier you agreed the price with.';
    rows.forEach((r) => {
      if (!Number.isFinite(r.price) || r.price < 0) next[`price.${r.mid}`] = 'Enter 0 or more.';
    });
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={false}
      title="Create payment"
      description="Record the price you agreed with the supplier for an approved requisition."
      footer={(
        <>
          <span className="mr-auto hidden text-[13px] text-erp-text-muted sm:inline">
            Total <span className="erp-tabular font-semibold text-erp-text-primary">{formatCurrency(total)}</span>
          </span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="payment-form" loading={create.isPending} disabled={!prId || !supplierId}>
            Create payment
          </Button>
        </>
      )}
    >
      <form id="payment-form" onSubmit={submit} noValidate className="space-y-4">
        {!prsLoading && approvedPrs.length === 0 && (
          <InfoBanner inset={false} tone="info">
            There are no approved requisitions waiting for payment. A requisition must be approved first.
          </InfoBanner>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Approved requisition" required error={errors.pr}>
            <ErpSearchSelect
              className="w-full"
              value={prId}
              onChange={(v) => { setPrId(v); setPrices({}); setErrors((e) => ({ ...e, pr: '' })); }}
              options={prOptions}
              loading={prsLoading}
              placeholder="Choose requisition…"
              searchPlaceholder="Search PR number or material…"
            />
          </Field>
          <Field
            label="Supplier"
            required
            error={errors.supplier}
            hint={!suppliersLoading && suppliers.length === 0 ? <Link to="/vendors" className="text-[var(--erp-accent)] hover:underline">No active suppliers — add one in Vendors</Link> : undefined}
          >
            <ErpSearchSelect
              className="w-full"
              value={supplierId}
              onChange={(v) => { setSupplierId(v); setErrors((e) => ({ ...e, supplier: '' })); }}
              options={supplierOptions}
              loading={suppliersLoading}
              placeholder="Choose supplier…"
              searchPlaceholder="Search code, name or material…"
            />
          </Field>
        </div>

        {pr && rows.length > 0 && (
          <div>
            <p className="erp-field-label mb-1.5">Agreed prices</p>
            <div className="erp-table-wrap rounded-lg border border-[var(--erp-border)]">
              <ErpDataTable className="w-full">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="erp-num">Qty</th>
                    <th className="erp-num">Unit price (₹)</th>
                    <th className="erp-num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.mid}>
                      <td className="min-w-[160px]">{materialLabel(r.line.materialId)}</td>
                      <td className="erp-num">{r.qty.toLocaleString()} {unitLabel(r.line.unit)}</td>
                      <td className="erp-num">
                        <div className="ml-auto w-32">
                          <UnitInput
                            inputSize="sm"
                            min={0}
                            step="0.01"
                            aria-label={`Unit price for ${materialLabel(r.line.materialId)}`}
                            invalid={!!errors[`price.${r.mid}`]}
                            value={r.raw ?? String(r.line.estimatedUnitCost ?? 0)}
                            onChange={(e) => setPrices((p) => ({ ...p, [r.mid]: e.target.value }))}
                          />
                        </div>
                      </td>
                      <td className="erp-num">{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="text-right font-medium">Total</td>
                    <td className="erp-num font-semibold">{formatCurrency(total)}</td>
                  </tr>
                </tbody>
              </ErpDataTable>
            </div>
            <p className="erp-field-hint mt-1">Prices start from the estimate on the requisition — change them to what the supplier quoted.</p>
          </div>
        )}

        <Field label="Supporting document" hint="Optional. The supplier invoice is uploaded on the goods receipt when goods arrive.">
          <div>
            <ReceiptThumbs
              pending={files}
              canAdd
              addLabel="Attach file"
              onAdd={(f) => setFiles((prev) => [...prev, ...f].slice(0, 12))}
            />
          </div>
        </Field>
      </form>
    </Drawer>
  );
}
