import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { productionApi } from '../../services/operations';
import { skuApi } from '../../services/manufacturing';
import { machineApi } from '../../services/admin';
import apiClient from '../../services/api';
import type { Material, ProductionBatch, ProductionOrder } from '../../types/api';
import {
  Button, Drawer, ErpInput, ErpSearchSelect, ErpSelect, Field, InfoBanner, Modal,
} from '../../components/erp';
import { PRIORITIES, priorityLabel, remainingToBatch, skuLabel, stageLabel, batchStages, batchGoodQty } from './productionUtils';
import { useInvalidateProduction } from './useProductionActions';

type Errors = Record<string, string>;

interface ProductionWorker { _id: string; firstName?: string; lastName?: string; roles?: string[] }

function listProductionWorkers(): Promise<ProductionWorker[]> {
  return apiClient.get<{ data: ProductionWorker[] }>('/production/workers').then((r) => r.data.data ?? []);
}

/* ───────────────────────────── New production order ───────────────────────────── */

export function OrderFormDrawer({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated?: (o: ProductionOrder) => void;
}) {
  const invalidate = useInvalidateProduction();
  const empty = { skuId: '', plannedQuantity: '100', priority: 'NORMAL', deliveryDate: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => { if (open) { setForm(empty); setErrors({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only SKUs that can actually be produced (an ACTIVE BOM) — anything else fails on submit.
  const { data: skus = [], isLoading: skusLoading, isError: skusError } = useQuery({
    queryKey: ['skus-prod'],
    queryFn: () => skuApi.listPage({ limit: 200, hasActiveBom: true, status: 'ACTIVE' }).then((r) => r.items),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => productionApi.createOrder({
      skuId: form.skuId,
      plannedQuantity: Number(form.plannedQuantity),
      priority: form.priority,
      deliveryDate: form.deliveryDate || undefined,
    }),
    meta: { successMessage: 'Production order created', successDescription: 'Next: run MRP to check materials.' },
    onSuccess: (o) => { invalidate(); onClose(); onCreated?.(o); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.skuId) next.skuId = 'Choose the SKU to produce.';
    const qty = Number(form.plannedQuantity);
    if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) next.plannedQuantity = 'Enter a whole number of pieces (1 or more).';
    if (form.deliveryDate && new Date(form.deliveryDate) < new Date(new Date().toDateString())) {
      next.deliveryDate = 'Delivery date cannot be in the past.';
    }
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title="New production order"
      description="Plan how many pieces of a SKU to make. Materials are checked in the next step (MRP)."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="prod-order-form" loading={save.isPending}>Create order</Button>
        </>
      )}
    >
      <form id="prod-order-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="SKU"
          required
          error={errors.skuId || (skusError ? 'Could not load SKUs — you may not have access to the SKU list. Ask your admin for SKU read access.' : undefined)}
          hint={skusLoading ? 'Loading SKUs…' : 'Only SKUs with an active BOM are listed.'}
        >
          <ErpSearchSelect
            value={form.skuId}
            onChange={(v) => setForm({ ...form, skuId: v })}
            placeholder="Search SKU code or name…"
            loading={skusLoading}
            emptyText="No SKU with an active BOM — freeze a BOM first (Products → BOMs)."
            options={skus.map((s) => ({ value: s._id, label: `${s.skuCode}${s.name ? ` — ${s.name}` : ''}` }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quantity (pieces)" required error={errors.plannedQuantity}>
            <ErpInput type="number" inputMode="numeric" min={1} value={form.plannedQuantity} onChange={(e) => setForm({ ...form, plannedQuantity: e.target.value })} />
          </Field>
          <Field label="Priority">
            <ErpSelect value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
            </ErpSelect>
          </Field>
        </div>
        <Field label="Delivery date" hint="Orders past this date are flagged as overdue." error={errors.deliveryDate}>
          <ErpInput type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
        </Field>
      </form>
    </Drawer>
  );
}

/* ───────────────────────────── New batch for an order ─────────────────────────── */

export function CreateBatchModal({ order, onClose }: { order: ProductionOrder | null; onClose: () => void }) {
  const invalidate = useInvalidateProduction();
  const remaining = order ? remainingToBatch(order) : 0;
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (order) { setQty(String(remainingToBatch(order))); setError(''); } }, [order]);

  const save = useMutation({
    mutationFn: () => productionApi.createBatch(order!._id, { plannedQuantity: Number(qty) }),
    meta: { successMessage: 'Batch created', successDescription: 'Start it from the batch board when the line is ready.' },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) return setError('Enter a whole number of pieces (1 or more).');
    if (n > remaining) return setError(`Only ${remaining} pieces are left to batch on this order.`);
    setError('');
    save.mutate();
  };

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      size="sm"
      title={`New batch for ${order?.orderNumber ?? ''}`}
      description={order ? `${skuLabel(order.skuId)} · ${remaining} pieces left to batch` : undefined}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-batch-form" loading={save.isPending}>Create batch</Button>
        </>
      )}
    >
      <form id="create-batch-form" onSubmit={submit} noValidate>
        <Field label="Batch quantity (pieces)" required error={error} hint="Defaults to everything still left to batch. Split into smaller batches if the line works in lots.">
          <ErpInput type="number" inputMode="numeric" min={1} max={remaining} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}

/* ───────────────────────────── Complete current stage ─────────────────────────── */

export function CompleteStageModal({ batch, onClose, fallbackStages = [] }: {
  batch: ProductionBatch | null;
  onClose: () => void;
  fallbackStages?: string[];
}) {
  const invalidate = useInvalidateProduction();
  const [scrapOn, setScrapOn] = useState(false);
  const [scrapMaterialId, setScrapMaterialId] = useState('');
  const [scrapQty, setScrapQty] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => { if (batch) { setScrapOn(false); setScrapMaterialId(''); setScrapQty(''); setErrors({}); } }, [batch]);

  // Scrap comes out of what was issued to this batch. Read it from the batch detail (material refs
  // embedded) — operators have no inventory read rights for the full material list.
  const { data: detail } = useQuery({
    queryKey: ['production-batch', batch?._id],
    queryFn: () => productionApi.getBatch(batch!._id),
    enabled: !!batch && scrapOn,
  });
  const materials: Pick<Material, '_id' | 'materialCode' | 'name' | 'unit'>[] = (detail?.issuedMaterials ?? [])
    .map((m) => (typeof m.materialId === 'object' ? m.materialId : null))
    .filter((m): m is { _id: string; materialCode?: string; name?: string; unit?: string } => !!m)
    .map((m) => ({ _id: m._id, materialCode: m.materialCode ?? '', name: m.name ?? '', unit: m.unit ?? '' }));

  const stages = batch ? batchStages(batch, fallbackStages) : [];
  const idx = batch ? stages.indexOf(batch.currentStage) : -1;
  const next = idx >= 0 ? stages[idx + 1] : undefined;
  const finishing = !next || next === 'COMPLETED';

  const save = useMutation({
    mutationFn: () => productionApi.completeStage(batch!._id, scrapOn && scrapMaterialId && Number(scrapQty) > 0 ? {
      scrapMaterialId,
      scrapQuantity: Number(scrapQty),
      scrapUnit: materials.find((m) => m._id === scrapMaterialId)?.unit,
      wasteType: 'PRODUCTION_SCRAP',
    } : {}),
    meta: {
      successMessage: batch ? `${stageLabel(batch.currentStage)} completed` : 'Stage completed',
      successDescription: finishing ? 'Batch is off the line and waiting for final QC.' : `Batch moved to ${stageLabel(next)}.`,
    },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const nextErr: Errors = {};
    if (scrapOn) {
      if (!scrapMaterialId) nextErr.material = 'Choose the material that was scrapped, or turn off scrap.';
      if (!(Number(scrapQty) > 0)) nextErr.qty = 'Enter the scrapped quantity.';
    }
    setErrors(nextErr);
    if (!Object.keys(nextErr).length) save.mutate();
  };

  return (
    <Modal
      open={!!batch}
      onClose={onClose}
      size="sm"
      title={batch ? `Complete ${stageLabel(batch.currentStage)}` : 'Complete stage'}
      description={batch ? `${batch.batchNumber} · ${batchGoodQty(batch)} good pieces` : undefined}
      footer={(
        <>
          {/* Shop-floor tablet: finger-sized targets. */}
          <Button variant="secondary" className="!min-h-11" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="complete-stage-form" className="!min-h-11" loading={save.isPending} icon={<CheckCircle2 size={16} />}>
            {finishing ? 'Finish line' : `Complete & move to ${stageLabel(next)}`}
          </Button>
        </>
      )}
    >
      <form id="complete-stage-form" onSubmit={submit} className="space-y-4" noValidate>
        {finishing && (
          <InfoBanner inset={false} tone="info">This is the last line stage. The batch then waits for final QC.</InfoBanner>
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-[var(--erp-border)] px-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={scrapOn} onChange={(e) => setScrapOn(e.target.checked)} />
          Record material scrap from this stage
        </label>
        {scrapOn && (
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="Scrapped material" required error={errors.material}>
              <ErpSelect value={scrapMaterialId} onChange={(e) => setScrapMaterialId(e.target.value)}>
                <option value="">Select material…</option>
                {materials.map((m) => <option key={m._id} value={m._id}>{m.materialCode} — {m.name}</option>)}
              </ErpSelect>
            </Field>
            <Field label={`Qty${scrapMaterialId ? ` (${materials.find((m) => m._id === scrapMaterialId)?.unit ?? ''})` : ''}`} required error={errors.qty}>
              <ErpInput type="number" inputMode="decimal" min={0} value={scrapQty} onChange={(e) => setScrapQty(e.target.value)} />
            </Field>
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ───────────────────────────── Assign machine / worker ────────────────────────── */

export function AssignResourcesModal({ batch, onClose }: { batch: ProductionBatch | null; onClose: () => void }) {
  const invalidate = useInvalidateProduction();
  const [machineId, setMachineId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!batch) return;
    const m = batch.machineId;
    setMachineId(typeof m === 'string' ? m : m?._id ?? '');
    const w = batch.workerIds?.[0];
    setWorkerId(typeof w === 'string' ? w : w?._id ?? '');
    setError('');
  }, [batch]);

  const { data: machines = [] } = useQuery({ queryKey: ['machines'], queryFn: () => machineApi.list(), enabled: !!batch });
  // Factory staff list scoped to production (GET /users needs user-admin rights planners don't have).
  const { data: users = [] } = useQuery({ queryKey: ['production-workers'], queryFn: listProductionWorkers, enabled: !!batch });
  // Only ACTIVE machines can take assignments (machines under maintenance are rejected by the API).
  const activeMachines = machines.filter((m) => !m.status || m.status === 'ACTIVE');

  const save = useMutation({
    mutationFn: () => productionApi.assignResources(batch!._id, {
      machineId: machineId || undefined,
      workerIds: workerId ? [workerId] : undefined,
    }),
    meta: { successMessage: 'Resources assigned' },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!machineId && !workerId) return setError('Pick a machine, a worker, or both.');
    setError('');
    save.mutate();
  };

  return (
    <Modal
      open={!!batch}
      onClose={onClose}
      size="sm"
      title={`Assign ${batch?.batchNumber ?? 'batch'}`}
      description="Choose the machine and operator for this batch."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assign-form" loading={save.isPending}>Save</Button>
        </>
      )}
    >
      <form id="assign-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Machine" hint="Machines under maintenance are hidden." error={error && !machineId && !workerId ? error : undefined}>
          <ErpSelect value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">No machine</option>
            {activeMachines.map((m) => <option key={m._id} value={m._id}>{m.machineCode} — {m.name}</option>)}
          </ErpSelect>
        </Field>
        <Field label="Worker">
          <ErpSelect value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">No worker</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.firstName} {u.lastName}{u.roles?.length ? ` · ${u.roles.join(', ')}` : ''}
              </option>
            ))}
          </ErpSelect>
        </Field>
      </form>
    </Modal>
  );
}

/* ───────────────────────────── New schedule slot ──────────────────────────────── */

export function ScheduleFormDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateProduction();
  const empty = { productionOrderId: '', plannedStart: '', plannedEnd: '', machineId: '', shiftId: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { if (open) { setForm(empty); setErrors({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: orders = [] } = useQuery({
    queryKey: ['production-orders-pick'],
    queryFn: () => productionApi.listOrdersPage({ limit: 100 }).then((r) => r.items),
    enabled: open,
  });
  const { data: machines = [] } = useQuery({ queryKey: ['machines'], queryFn: () => machineApi.list(), enabled: open });
  const { data: shifts = [] } = useQuery({ queryKey: ['shifts'], queryFn: () => machineApi.listShifts(), enabled: open });
  const activeMachines = machines.filter((m) => !m.status || m.status === 'ACTIVE');
  const openOrders = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status));

  const save = useMutation({
    mutationFn: () => productionApi.createSchedule({
      productionOrderId: form.productionOrderId,
      plannedStart: form.plannedStart,
      plannedEnd: form.plannedEnd,
      machineId: form.machineId || undefined,
      shiftId: form.shiftId || undefined,
      status: 'PLANNED',
    }),
    meta: { successMessage: 'Schedule slot added' },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.productionOrderId) next.order = 'Choose the order to schedule.';
    if (!form.plannedStart) next.start = 'Enter the start time.';
    if (!form.plannedEnd) next.end = 'Enter the end time.';
    else if (form.plannedStart && new Date(form.plannedEnd) <= new Date(form.plannedStart)) next.end = 'End must be after the start.';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title="New schedule slot"
      description="Reserve line time for a production order."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="schedule-form" loading={save.isPending}>Add slot</Button>
        </>
      )}
    >
      <form id="schedule-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Production order" required error={errors.order}>
          <ErpSelect value={form.productionOrderId} onChange={(e) => setForm({ ...form, productionOrderId: e.target.value })}>
            <option value="">Select order…</option>
            {openOrders.map((o) => <option key={o._id} value={o._id}>{o.orderNumber} · {skuLabel(o.skuId)}</option>)}
          </ErpSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start" required error={errors.start}>
            <ErpInput type="datetime-local" value={form.plannedStart} onChange={(e) => setForm({ ...form, plannedStart: e.target.value })} />
          </Field>
          <Field label="End" required error={errors.end}>
            <ErpInput type="datetime-local" value={form.plannedEnd} onChange={(e) => setForm({ ...form, plannedEnd: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Machine">
            <ErpSelect value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })}>
              <option value="">Any machine</option>
              {activeMachines.map((m) => <option key={m._id} value={m._id}>{m.machineCode}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Shift">
            <ErpSelect value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}>
              <option value="">Any shift</option>
              {shifts.filter((s) => s.isActive !== false).map((s) => <option key={s._id} value={s._id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
            </ErpSelect>
          </Field>
        </div>
      </form>
    </Drawer>
  );
}
