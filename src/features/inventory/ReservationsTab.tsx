import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Lock, Plus, Unlock } from 'lucide-react';
import {
  Button, Drawer, EmptyState, ErpDataTable, ErpInput, ErpSearchSelect, Field, InfoBanner, useConfirm,
  type ErpSearchOption,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { inventoryApi } from '../../services/manufacturing';
import type { Material } from '../../types/api';
import { UnitInput } from '../purchase/purchaseShared';
import { formatDateTime, unitLabel } from './inventoryUtils';
import { MaterialCell, useInvalidateInventory, type InventoryPerms } from './inventoryLayout';

/* ───────────────────────── Reserve drawer ───────────────────────── */

export function ReserveDrawer({
  open, onClose, initialMaterialId,
}: {
  open: boolean;
  onClose: () => void;
  initialMaterialId?: string;
}) {
  const invalidate = useInvalidateInventory();
  const [materialId, setMaterialId] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setMaterialId(initialMaterialId || ''); setQty(''); setNote(''); setErrors({}); }
  }, [open, initialMaterialId]);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => inventoryApi.listMaterials(),
    enabled: open,
  });
  const options: ErpSearchOption[] = useMemo(
    () => materials.map((m: Material) => ({ value: m._id, label: `${m.materialCode} — ${m.name}` })),
    [materials],
  );
  const mat = materials.find((m: Material) => m._id === materialId);
  const { data: avail } = useQuery({
    queryKey: ['inventory-availability', materialId],
    queryFn: () => inventoryApi.availability(materialId),
    enabled: open && !!materialId,
  });
  const available = avail?.available ?? 0;

  const reserve = useMutation({
    mutationFn: () => inventoryApi.reserve({
      materialId,
      quantity: Number(qty),
      unit: mat?.unit || avail?.unit || 'METERS',
      note: note.trim() || undefined,
    }),
    meta: { successMessage: 'Stock reserved', successDescription: 'Available quantity is reduced until you release it.' },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!materialId) next.material = 'Choose a material.';
    const q = Number(qty);
    if (!(q > 0)) next.qty = 'Enter a quantity above 0.';
    else if (avail && q > available) next.qty = `Only ${available.toLocaleString()} ${unitLabel(avail.unit).toLowerCase()} available.`;
    setErrors(next);
    if (Object.keys(next).length === 0) reserve.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={false}
      title="Reserve stock"
      description="Hold stock aside so it isn't used elsewhere — e.g. a buyer sample or rework."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="reserve-form" icon={<Lock size={16} />} loading={reserve.isPending} disabled={!materialId || !(Number(qty) > 0)}>
            Reserve
          </Button>
        </>
      )}
    >
      <form id="reserve-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Material" required error={errors.material}>
          <ErpSearchSelect
            className="w-full"
            value={materialId}
            onChange={(v) => { setMaterialId(v); setErrors((e) => ({ ...e, material: '' })); }}
            options={options}
            loading={isLoading}
            placeholder="Search code or name…"
          />
        </Field>
        <Field
          label="Quantity"
          required
          error={errors.qty}
          hint={materialId && avail ? `${available.toLocaleString()} ${unitLabel(avail.unit).toLowerCase()} available` : undefined}
        >
          <UnitInput min={0} step="any" unit={mat ? unitLabel(mat.unit) : undefined} value={qty} onChange={(e) => { setQty(e.target.value); setErrors((x) => ({ ...x, qty: '' })); }} placeholder="0" />
        </Field>
        <Field label="Reason" hint="Optional, shown on the hold list.">
          <ErpInput maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Buyer sample for Zara" />
        </Field>
        <InfoBanner inset={false} tone="muted">
          Samples and production orders reserve their own material — use this only for ad-hoc holds.
        </InfoBanner>
      </form>
    </Drawer>
  );
}

/* ───────────────────────── Manual holds list ───────────────────────── */

function personName(v?: string | { firstName?: string; lastName?: string }) {
  if (!v || typeof v === 'string') return '—';
  return [v.firstName, v.lastName].filter(Boolean).join(' ') || '—';
}

export function ReservationsTab({ perms, onReserve }: { perms: InventoryPerms; onReserve: () => void }) {
  const invalidate = useInvalidateInventory();
  const confirm = useConfirm();
  const holds = useQuery({
    queryKey: ['inventory-manual-reservations'],
    queryFn: () => inventoryApi.listManualReservations(),
    enabled: perms.canUpdate,
  });
  const rows = holds.data ?? [];

  const release = useMutation({
    mutationFn: (referenceId: string) => inventoryApi.releaseReservations({ referenceId }),
    onSuccess: () => invalidate(),
    meta: { successMessage: 'Hold released', successDescription: 'The quantity is available again.' },
  });

  if (!perms.canUpdate) {
    return (
      <EmptyState
        icon={Lock}
        title="You can't manage holds"
        description="Reserving and releasing stock needs inventory update access. Reserved quantities are still visible on the Stock tab."
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--erp-border)] px-4 py-3">
        <p className="text-[13px] text-erp-text-muted">
          Manual holds only. Sample and production holds are managed in{' '}
          <Link to="/samples" className="font-medium text-[var(--erp-accent)] hover:underline">Samples</Link> and{' '}
          <Link to="/production/orders" className="font-medium text-[var(--erp-accent)] hover:underline">Production</Link>.
        </p>
      </div>
      <QueryState
        skeleton="table"
        skeletonColumns={5}
        isLoading={holds.isLoading}
        isError={holds.isError}
        error={holds.error}
        onRetry={holds.refetch}
        isEmpty={!rows.length}
        emptyIcon={Lock}
        emptyMessage="No manual holds"
        emptyDescription="Reserve stock to keep it aside for a sample, rework or a special order."
        emptyAction={<Button size="sm" icon={<Plus size={16} />} onClick={onReserve}>Reserve stock</Button>}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th>Material</th>
                <th className="erp-num">Quantity</th>
                <th>Reason</th>
                <th>Held since</th>
                <th>By</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const m = typeof h.materialId === 'object' ? h.materialId : undefined;
                return (
                  <tr key={h._id}>
                    <td><MaterialCell materialId={h.materialId} /></td>
                    <td className="erp-num">{h.quantity.toLocaleString()} <span className="text-xs text-erp-text-muted">{unitLabel(h.unit || m?.unit)}</span></td>
                    <td className="max-w-[260px] truncate" title={h.note}>{h.note || <span className="text-erp-text-muted">—</span>}</td>
                    <td className="whitespace-nowrap text-erp-text-muted">{formatDateTime(h.createdAt)}</td>
                    <td className="text-erp-text-muted">{personName(h.createdBy)}</td>
                    <td className="erp-cell-actions">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Unlock size={14} />}
                        loading={release.isPending && release.variables === h.referenceId}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Release this hold?',
                            message: `${h.quantity.toLocaleString()} ${unitLabel(h.unit || m?.unit).toLowerCase()} of ${m?.materialCode ?? 'this material'} goes back to available stock.`,
                            confirmLabel: 'Release',
                          });
                          if (ok) release.mutate(h.referenceId);
                        }}
                      >
                        Release
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        </div>
      </QueryState>
    </>
  );
}
