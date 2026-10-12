import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Cpu, Factory, Layers, Pencil, Plus, RefreshCw, Timer, Wrench, CheckCircle2, Ban } from 'lucide-react';
import { machineApi } from '../../services/admin';
import { productionApi } from '../../services/operations';
import { useAuth } from '../../app/providers/AuthProvider';
import { hasPermission } from '../../utils/permissions';
import type { Machine, ProductionLine, Shift } from '../../types/api';
import {
  Button, Drawer, EmptyRow, ErpDataTable, ErpInput, ErpSelect, Field, FilterBar, IconButton, KpiGrid, PageHeader,
  SearchInput, Section, StatTile, StatusBadge, TablePager, TableSkeleton, Tabs, RowActionsMenu,
} from '../../components/erp';
import { MACHINE_TYPES, humanStatus } from './productionUtils';
import { useDebouncedValue } from './useProductionActions';
import { QueryErrorRow } from './QueryErrorRow';

const PAGE_SIZE = 15;
type TabId = 'machines' | 'lines' | 'shifts';
type Errors = Record<string, string>;
const MACHINE_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const;

function useInvalidateMachines() {
  const qc = useQueryClient();
  return () => ['machines-page', 'machines', 'lines-page', 'production-lines', 'shifts', 'production-capacity', 'production-stats']
    .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

function machineTone(status?: string) {
  if (status === 'MAINTENANCE') return 'warning' as const;
  if (status === 'INACTIVE') return 'neutral' as const;
  return undefined;
}

/* ─────────────────────────────── Forms ─────────────────────────────── */

function MachineDrawer({ open, machine, onClose }: { open: boolean; machine: Machine | null; onClose: () => void }) {
  const invalidate = useInvalidateMachines();
  const editing = !!machine;
  const [form, setForm] = useState({ machineCode: '', name: '', machineType: 'SEWING', capacityPerHour: '40', status: 'ACTIVE' });
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(machine
      ? { machineCode: machine.machineCode ?? '', name: machine.name ?? '', machineType: machine.machineType ?? 'OTHER', capacityPerHour: String(machine.capacityPerHour ?? ''), status: machine.status ?? 'ACTIVE' }
      : { machineCode: '', name: '', machineType: 'SEWING', capacityPerHour: '40', status: 'ACTIVE' });
  }, [open, machine]);

  const save = useMutation({
    mutationFn: () => (editing
      ? machineApi.update(machine!._id, { status: form.status, capacityPerHour: Number(form.capacityPerHour) })
      : machineApi.create({ machineCode: form.machineCode.trim(), name: form.name.trim(), machineType: form.machineType, capacityPerHour: Number(form.capacityPerHour) || 0 })),
    meta: { successMessage: editing ? 'Machine updated' : 'Machine added' },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!editing && !form.machineCode.trim()) next.code = 'Enter a short machine code, e.g. SEW-01.';
    if (!editing && !form.name.trim()) next.name = 'Enter the machine name.';
    const cap = Number(form.capacityPerHour);
    if (!Number.isFinite(cap) || cap < 0) next.cap = 'Enter units per hour (0 or more).';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={false}
      title={editing ? `Edit ${machine?.machineCode}` : 'New machine'}
      description={editing ? machine?.name : 'Add equipment that batches and schedules can be assigned to.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="machine-form" loading={save.isPending}>{editing ? 'Save changes' : 'Add machine'}</Button>
        </>
      )}
    >
      <form id="machine-form" onSubmit={submit} className="space-y-4" noValidate>
        {!editing && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" required error={errors.code}>
                <ErpInput className="font-mono" value={form.machineCode} onChange={(e) => setForm({ ...form, machineCode: e.target.value })} placeholder="SEW-01" />
              </Field>
              <Field label="Type">
                <ErpSelect value={form.machineType} onChange={(e) => setForm({ ...form, machineType: e.target.value })}>
                  {MACHINE_TYPES.map((t) => <option key={t} value={t}>{humanStatus(t)}</option>)}
                </ErpSelect>
              </Field>
            </div>
            <Field label="Name" required error={errors.name}>
              <ErpInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juki lockstitch #1" />
            </Field>
          </>
        )}
        <Field label="Capacity (units per hour)" error={errors.cap}>
          <ErpInput type="number" inputMode="numeric" min={0} value={form.capacityPerHour} onChange={(e) => setForm({ ...form, capacityPerHour: e.target.value })} />
        </Field>
        {editing && (
          <Field label="Status" hint="Machines in maintenance or inactive can't take new batches or schedule slots.">
            <ErpSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
            </ErpSelect>
          </Field>
        )}
      </form>
    </Drawer>
  );
}

function LineDrawer({ open, line, onClose }: { open: boolean; line: ProductionLine | null; onClose: () => void }) {
  const invalidate = useInvalidateMachines();
  const [form, setForm] = useState({ lineCode: '', name: '', capacityPerDay: '500' });
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => {
    if (!open) return;
    setForm(line
      ? { lineCode: line.lineCode ?? '', name: line.name ?? '', capacityPerDay: line.capacityPerDay != null ? String(line.capacityPerDay) : '' }
      : { lineCode: '', name: '', capacityPerDay: '500' });
    setErrors({});
  }, [open, line]);
  const save = useMutation({
    mutationFn: () => (line
      ? machineApi.updateLine(line._id, { name: form.name.trim(), ...(form.capacityPerDay.trim() !== '' ? { capacityPerDay: Number(form.capacityPerDay) } : {}) })
      : machineApi.createLine({ lineCode: form.lineCode.trim(), name: form.name.trim(), capacityPerDay: Number(form.capacityPerDay) || 0 })),
    meta: { successMessage: line ? 'Production line updated' : 'Production line added' },
    onSuccess: () => { invalidate(); onClose(); },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.lineCode.trim()) next.code = 'Enter a line code, e.g. L1.';
    if (!form.name.trim()) next.name = 'Enter the line name.';
    if (!(Number(form.capacityPerDay) >= 0)) next.cap = 'Enter pieces per day (0 or more).';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={false}
      title={line ? `Edit ${line.lineCode}` : 'New production line'}
      description="A line groups machines and sets daily capacity."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="line-form" loading={save.isPending}>{line ? 'Save changes' : 'Add line'}</Button>
        </>
      )}
    >
      <form id="line-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Code" required error={errors.code} hint={line ? 'The code identifies the line and cannot be changed.' : undefined}>
          <ErpInput className="font-mono" value={form.lineCode} disabled={!!line} onChange={(e) => setForm({ ...form, lineCode: e.target.value })} placeholder="L1" />
        </Field>
        <Field label="Name" required error={errors.name}>
          <ErpInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Stitching line 1" />
        </Field>
        <Field label="Capacity (pieces per day)" error={errors.cap}>
          <ErpInput type="number" inputMode="numeric" min={0} value={form.capacityPerDay} onChange={(e) => setForm({ ...form, capacityPerDay: e.target.value })} />
        </Field>
      </form>
    </Drawer>
  );
}

function ShiftDrawer({ open, shift, onClose }: { open: boolean; shift: Shift | null; onClose: () => void }) {
  const invalidate = useInvalidateMachines();
  const [form, setForm] = useState({ name: '', startTime: '08:00', endTime: '17:00' });
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => {
    if (!open) return;
    setForm(shift
      ? { name: shift.name, startTime: shift.startTime ?? '08:00', endTime: shift.endTime ?? '17:00' }
      : { name: '', startTime: '08:00', endTime: '17:00' });
    setErrors({});
  }, [open, shift]);
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, name: form.name.trim() };
      return shift ? machineApi.updateShift(shift._id, body) : machineApi.createShift(body);
    },
    meta: { successMessage: shift ? 'Shift updated' : 'Shift added' },
    onSuccess: () => { invalidate(); onClose(); },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.name.trim()) next.name = 'Enter the shift name, e.g. Morning.';
    if (!form.startTime) next.start = 'Enter the start time.';
    if (!form.endTime) next.end = 'Enter the end time.';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={false}
      title={shift ? `Edit ${shift.name}` : 'New shift'}
      description="Working hours used when scheduling and assigning batches."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="shift-form" loading={save.isPending}>{shift ? 'Save changes' : 'Add shift'}</Button>
        </>
      )}
    >
      <form id="shift-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" required error={errors.name}>
          <ErpInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning" />
        </Field>
        <div className="grid gap-4 grid-cols-2">
          <Field label="Start" required error={errors.start}>
            <ErpInput type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </Field>
          <Field label="End" required error={errors.end} hint="Overnight shifts may end before they start.">
            <ErpInput type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export function MachinesPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidateMachines();
  const { permissions, user } = useAuth();
  const canConfigure = hasPermission(permissions, 'production.configure', !!user?.isSuperAdmin);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>(() => {
    const t = searchParams.get('tab');
    return t === 'lines' || t === 'shifts' ? t : 'machines';
  });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [creating, setCreating] = useState<TabId | null>(null);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [editLine, setEditLine] = useState<ProductionLine | null>(null);
  const lineStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => machineApi.updateLine(id, { status }),
    meta: { successMessage: 'Production line updated' },
    onSuccess: () => invalidate(),
  });
  const shiftActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => machineApi.updateShift(id, { isActive }),
    meta: { successMessage: 'Shift updated' },
    onSuccess: () => invalidate(),
  });

  const capacityQ = useQuery({ queryKey: ['production-capacity'], queryFn: () => productionApi.capacity() });
  const capacity = capacityQ.data;
  const machinesQ = useQuery({
    queryKey: ['machines-page', page, search],
    queryFn: () => machineApi.listPage({ page, limit: PAGE_SIZE, search: search || undefined }),
    enabled: tab === 'machines',
    placeholderData: (prev) => prev,
  });
  const linesQ = useQuery({
    queryKey: ['lines-page', page],
    queryFn: () => machineApi.listLinesPage({ page, limit: PAGE_SIZE }),
    enabled: tab === 'lines',
  });
  const shiftsQ = useQuery({ queryKey: ['shifts'], queryFn: () => machineApi.listShifts() });

  const quickStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => machineApi.update(id, { status }),
    meta: { successMessage: 'Machine status updated' },
    onSuccess: invalidate,
  });

  const machines = machinesQ.data?.items ?? [];
  const lines = linesQ.data?.items ?? [];
  const shifts = shiftsQ.data ?? [];
  const meta = tab === 'machines' ? machinesQ.data?.meta : linesQ.data?.meta;

  const changeTab = (id: TabId) => { setTab(id); setPage(1); };
  const newLabel = tab === 'machines' ? 'New machine' : tab === 'lines' ? 'New line' : 'New shift';

  return (
    <>
      <PageHeader
        title="Machines & capacity"
        description="Equipment, production lines and shifts that set how much the floor can make."
        secondaryActions={(
          <>
            <IconButton aria-label="Refresh" loading={machinesQ.isFetching || linesQ.isFetching} onClick={() => { capacityQ.refetch(); machinesQ.refetch(); linesQ.refetch(); shiftsQ.refetch(); }}>
              <RefreshCw size={16} />
            </IconButton>
            <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/production/orders')}>Production</Button>
          </>
        )}
        primaryAction={canConfigure ? <Button icon={<Plus size={16} />} onClick={() => setCreating(tab)}>{newLabel}</Button> : undefined}
      />

      <KpiGrid cols={4} className="mb-4">
        <StatTile icon={Cpu} label="Active machines" value={capacity?.machineCount ?? '—'} hint={capacity?.machineTotal != null ? `of ${capacity.machineTotal}` : undefined} onClick={() => changeTab('machines')} active={tab === 'machines'} />
        <StatTile icon={Factory} label="Active lines" value={capacity?.lineCount ?? '—'} hint={capacity?.lineTotal != null ? `of ${capacity.lineTotal}` : undefined} onClick={() => changeTab('lines')} active={tab === 'lines'} />
        <StatTile icon={Timer} label="Capacity per hour" value={capacity?.totalCapacityPerHour?.toLocaleString() ?? '—'} hint="Active machines" />
        <StatTile icon={Layers} label="Batches running" value={capacity?.inProgressBatches ?? '—'} onClick={() => navigate('/production/orders?tab=board')} />
      </KpiGrid>

      <Section flush>
        <div className="px-3">
          <Tabs
            ariaLabel="Equipment"
            tabs={[
              { id: 'machines', label: 'Machines', count: capacity?.machineTotal ?? capacity?.machineCount },
              { id: 'lines', label: 'Lines', count: capacity?.lineTotal ?? capacity?.lineCount },
              { id: 'shifts', label: 'Shifts', count: shiftsQ.data ? shifts.length : undefined },
            ]}
            active={tab}
            onChange={(id) => changeTab(id as TabId)}
          />
        </div>

        {tab === 'machines' && (
          <>
            <FilterBar
              search={<SearchInput inputSize="sm" value={searchInput} onChange={(v) => { setSearchInput(v); setPage(1); }} placeholder="Search machines…" />}
              onClear={searchInput ? () => setSearchInput('') : undefined}
            />
            <ErpDataTable className="min-w-[640px]">
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Type</th><th className="erp-num">Capacity / hr</th><th>Status</th>
                  <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {machinesQ.isLoading ? <TableSkeleton asRows rows={5} columns={6} /> : machinesQ.isError ? <QueryErrorRow colSpan={6} error={machinesQ.error} onRetry={() => machinesQ.refetch()} /> : machines.length === 0 ? (
                  <EmptyRow
                    colSpan={6}
                    title={searchInput ? 'No machines match your search' : 'No machines yet'}
                    action={canConfigure && !searchInput ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating('machines')}>New machine</Button> : undefined}
                  >
                    {searchInput ? undefined : 'Add machines so batches and schedules can be assigned to them.'}
                  </EmptyRow>
                ) : machines.map((m: Machine) => (
                  <tr key={m._id} className={canConfigure ? 'erp-row-clickable' : ''} onClick={canConfigure ? () => setEditMachine(m) : undefined}>
                    <td className="erp-cell-primary font-mono">{m.machineCode}</td>
                    <td>{m.name}</td>
                    <td>{humanStatus(m.machineType ?? '')}</td>
                    <td className="erp-num">{m.capacityPerHour ?? '—'}</td>
                    <td><StatusBadge status={m.status} tone={machineTone(m.status)} /></td>
                    <td className="erp-cell-actions">
                      {canConfigure && (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={(e) => { e.stopPropagation(); setEditMachine(m); }}>Edit</Button>
                          <RowActionsMenu
                            label={`Actions for ${m.machineCode}`}
                            items={[
                              { label: 'Mark active', icon: CheckCircle2, hidden: m.status === 'ACTIVE' || !m.status, onSelect: () => quickStatus.mutate({ id: m._id, status: 'ACTIVE' }) },
                              { label: 'Send to maintenance', icon: Wrench, hidden: m.status === 'MAINTENANCE', onSelect: () => quickStatus.mutate({ id: m._id, status: 'MAINTENANCE' }) },
                              { label: 'Deactivate', icon: Ban, danger: true, hidden: m.status === 'INACTIVE', onSelect: () => quickStatus.mutate({ id: m._id, status: 'INACTIVE' }) },
                            ]}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </>
        )}

        {tab === 'lines' && (
          <ErpDataTable className="min-w-[520px]">
            <thead><tr><th>Code</th><th>Name</th><th className="erp-num">Capacity / day</th><th>Status</th>{canConfigure && <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>
              {linesQ.isLoading ? <TableSkeleton asRows rows={4} columns={canConfigure ? 5 : 4} /> : linesQ.isError ? <QueryErrorRow colSpan={canConfigure ? 5 : 4} error={linesQ.error} onRetry={() => linesQ.refetch()} /> : lines.length === 0 ? (
                <EmptyRow
                  colSpan={canConfigure ? 5 : 4}
                  title="No production lines yet"
                  action={canConfigure ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating('lines')}>New line</Button> : undefined}
                >
                  Lines group machines and set daily capacity.
                </EmptyRow>
              ) : lines.map((l: ProductionLine) => (
                <tr key={l._id}>
                  <td className="erp-cell-primary font-mono">{l.lineCode}</td>
                  <td>{l.name}</td>
                  <td className="erp-num">{l.capacityPerDay?.toLocaleString() ?? '—'}</td>
                  <td><StatusBadge status={l.status || 'ACTIVE'} /></td>
                  {canConfigure && (
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditLine(l)}>Edit</Button>
                        <RowActionsMenu
                          label={`Actions for ${l.lineCode}`}
                          items={[
                            { label: 'Mark active', icon: CheckCircle2, hidden: (l.status || 'ACTIVE') === 'ACTIVE', onSelect: () => lineStatus.mutate({ id: l._id, status: 'ACTIVE' }) },
                            { label: 'Deactivate', icon: Ban, danger: true, hidden: l.status === 'INACTIVE', onSelect: () => lineStatus.mutate({ id: l._id, status: 'INACTIVE' }) },
                          ]}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        )}

        {tab === 'shifts' && (
          <ErpDataTable className="min-w-[480px]">
            <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Status</th>{canConfigure && <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>
              {shiftsQ.isLoading ? <TableSkeleton asRows rows={3} columns={canConfigure ? 5 : 4} /> : shiftsQ.isError ? <QueryErrorRow colSpan={canConfigure ? 5 : 4} error={shiftsQ.error} onRetry={() => shiftsQ.refetch()} /> : shifts.length === 0 ? (
                <EmptyRow
                  colSpan={canConfigure ? 5 : 4}
                  title="No shifts yet"
                  action={canConfigure ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating('shifts')}>New shift</Button> : undefined}
                >
                  Shifts are used when scheduling and assigning batches.
                </EmptyRow>
              ) : shifts.map((s: Shift) => (
                <tr key={s._id}>
                  <td className="erp-cell-primary">{s.name}</td>
                  <td className="erp-tabular">{s.startTime}</td>
                  <td className="erp-tabular">{s.endTime}</td>
                  <td><StatusBadge status={s.isActive !== false ? 'ACTIVE' : 'INACTIVE'} /></td>
                  {canConfigure && (
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditShift(s)}>Edit</Button>
                        <RowActionsMenu
                          label={`Actions for ${s.name}`}
                          items={[
                            { label: 'Mark active', icon: CheckCircle2, hidden: s.isActive !== false, onSelect: () => shiftActive.mutate({ id: s._id, isActive: true }) },
                            { label: 'Deactivate', icon: Ban, danger: true, hidden: s.isActive === false, onSelect: () => shiftActive.mutate({ id: s._id, isActive: false }) },
                          ]}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        )}

        {tab !== 'shifts' && meta && (
          <TablePager
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={PAGE_SIZE}
            itemLabel={tab === 'machines' ? 'machines' : 'lines'}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </Section>

      <MachineDrawer open={creating === 'machines' || !!editMachine} machine={editMachine} onClose={() => { setCreating(null); setEditMachine(null); }} />
      <LineDrawer open={creating === 'lines' || !!editLine} line={editLine} onClose={() => { setCreating(null); setEditLine(null); }} />
      <ShiftDrawer open={creating === 'shifts' || !!editShift} shift={editShift} onClose={() => { setCreating(null); setEditShift(null); }} />
    </>
  );
}
