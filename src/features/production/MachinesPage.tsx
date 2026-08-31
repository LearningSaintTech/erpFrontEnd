import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Factory, RefreshCw, Search, Timer } from 'lucide-react';
import { machineApi } from '../../services/admin';
import { productionApi } from '../../services/operations';
import { useAuth } from '../../app/providers/AuthProvider';
import { hasPermission } from '../../utils/permissions';
import type { Machine, ProductionLine, Shift } from '../../types/api';
import {
  ErpButton, ErpCard, ErpDataTable, ErpInput, ErpPageHeader, ErpSelect, ErpStatusBadge, ErpTabs,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { MACHINE_TYPES } from './productionUtils';

const PAGE_SIZE = 15;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

type TabId = 'machines' | 'lines' | 'shifts';

export function MachinesPage() {
  const qc = useQueryClient();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canConfigure = hasPermission(permissions, 'production.configure', isSuperAdmin);
  const [tab, setTab] = useState<TabId>('machines');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [machineForm, setMachineForm] = useState({
    machineCode: '', name: '', machineType: 'SEWING', capacityPerHour: '40',
  });
  const [lineForm, setLineForm] = useState({ lineCode: '', name: '', capacityPerDay: '500' });
  const [shiftForm, setShiftForm] = useState({ name: '', startTime: '08:00', endTime: '17:00' });
  const [editMachineId, setEditMachineId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ status: 'ACTIVE', capacityPerHour: '' });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const { data: capacity } = useQuery({ queryKey: ['production-capacity'], queryFn: () => productionApi.capacity() });

  const { data: machinesPage, isLoading: machinesLoading, isFetching, refetch } = useQuery({
    queryKey: ['machines-page', page, search],
    queryFn: () => machineApi.listPage({ page, limit: PAGE_SIZE, search: search || undefined }),
    enabled: tab === 'machines',
  });

  const { data: linesPage, isLoading: linesLoading } = useQuery({
    queryKey: ['lines-page', page],
    queryFn: () => machineApi.listLinesPage({ page, limit: PAGE_SIZE }),
    enabled: tab === 'lines',
  });

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => machineApi.listShifts(),
    enabled: tab === 'shifts',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['machines-page'] });
    qc.invalidateQueries({ queryKey: ['machines'] });
    qc.invalidateQueries({ queryKey: ['lines-page'] });
    qc.invalidateQueries({ queryKey: ['production-lines'] });
    qc.invalidateQueries({ queryKey: ['shifts'] });
    qc.invalidateQueries({ queryKey: ['production-capacity'] });
    qc.invalidateQueries({ queryKey: ['production-stats'] });
  };

  const createMachine = useMutation({
    mutationFn: () => machineApi.create({
      ...machineForm,
      capacityPerHour: Number(machineForm.capacityPerHour) || 0,
    }),
    onSuccess: () => {
      setMachineForm({ machineCode: '', name: '', machineType: 'SEWING', capacityPerHour: '40' });
      showSuccess('Machine created');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMachine = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => machineApi.update(id, body),
    onSuccess: () => {
      setEditMachineId(null);
      showSuccess('Machine updated');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const createLine = useMutation({
    mutationFn: () => machineApi.createLine({
      ...lineForm,
      capacityPerDay: Number(lineForm.capacityPerDay) || 0,
    }),
    onSuccess: () => {
      setLineForm({ lineCode: '', name: '', capacityPerDay: '500' });
      showSuccess('Production line created');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const createShift = useMutation({
    mutationFn: () => machineApi.createShift(shiftForm),
    onSuccess: () => {
      setShiftForm({ name: '', startTime: '08:00', endTime: '17:00' });
      showSuccess('Shift created');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const machines = machinesPage?.items ?? [];
  const lines = linesPage?.items ?? [];
  const meta = tab === 'machines' ? machinesPage?.meta : linesPage?.meta;

  return (
    <div>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess('')} />}

      <ErpPageHeader
        title="Machines & Capacity"
        subtitle="Equipment master data, lines, and shifts"
        actions={(
          <div className="flex gap-2">
            <Link to="/production/orders">
              <ErpButton variant="secondary" className={btnSm}>← Production</ErpButton>
            </Link>
            <ErpButton variant="secondary" className={btnSm} onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
          </div>
        )}
      />

      {capacity && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <Cpu className="h-4 w-4" /><span className="text-[10px] uppercase">Machines</span>
            </div>
            <p className="mt-1 text-xl font-semibold">{capacity.machineCount}</p>
          </ErpCard>
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <Factory className="h-4 w-4" /><span className="text-[10px] uppercase">Lines</span>
            </div>
            <p className="mt-1 text-xl font-semibold">{capacity.lineCount}</p>
          </ErpCard>
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <Timer className="h-4 w-4" /><span className="text-[10px] uppercase">Capacity / hr</span>
            </div>
            <p className="mt-1 text-xl font-semibold">{capacity.totalCapacityPerHour}</p>
          </ErpCard>
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <span className="text-[10px] uppercase">Batches in progress</span>
            </div>
            <p className="mt-1 text-xl font-semibold">{capacity.inProgressBatches}</p>
          </ErpCard>
        </div>
      )}

      <div className="mb-4">
        <ErpTabs
          tabs={[
            { id: 'machines', label: `Machines${capacity ? ` (${capacity.machineCount})` : ''}` },
            { id: 'lines', label: `Lines${capacity ? ` (${capacity.lineCount})` : ''}` },
            { id: 'shifts', label: 'Shifts' },
          ]}
          active={tab}
          onChange={(id) => { setTab(id as TabId); setPage(1); }}
        />
      </div>

      {tab === 'machines' && (
        <>
          {canConfigure && (
          <ErpCard className="mb-4 p-4">
            <h3 className="mb-3 text-sm font-medium">Add machine</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={fieldLabel}>Code</label>
                <ErpInput value={machineForm.machineCode} onChange={(e) => setMachineForm({ ...machineForm, machineCode: e.target.value })} className="w-28" />
              </div>
              <div>
                <label className={fieldLabel}>Name</label>
                <ErpInput value={machineForm.name} onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })} className="w-36" />
              </div>
              <div>
                <label className={fieldLabel}>Type</label>
                <ErpSelect value={machineForm.machineType} onChange={(e) => setMachineForm({ ...machineForm, machineType: e.target.value })} className="w-32">
                  {MACHINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Units / hr</label>
                <ErpInput type="number" value={machineForm.capacityPerHour} onChange={(e) => setMachineForm({ ...machineForm, capacityPerHour: e.target.value })} className="w-20" />
              </div>
              <ErpButton className={btnSm} disabled={!machineForm.machineCode || !machineForm.name || createMachine.isPending} onClick={() => createMachine.mutate()}>
                Add
              </ErpButton>
            </div>
          </ErpCard>
          )}

          <div className="mb-3 flex gap-2">
            <ErpInput className="max-w-xs" placeholder="Search machines…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
            <ErpButton variant="secondary" className={btnSm} onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-3 w-3" /></ErpButton>
          </div>

          <ErpCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <ErpDataTable className="w-full min-w-[640px] text-[11px]">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Capacity/hr</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {machinesLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-erp-text-muted">Loading…</td></tr>}
                  {!machinesLoading && machines.map((m: Machine) => (
                    <tr key={m._id} className="border-t border-[var(--erp-border)]">
                      <td className="px-3 py-2 font-mono">{m.machineCode}</td>
                      <td className="px-3 py-2">{m.name}</td>
                      <td className="px-3 py-2">{m.machineType}</td>
                      <td className="px-3 py-2">{m.capacityPerHour}</td>
                      <td className="px-3 py-2"><ErpStatusBadge status={m.status} /></td>
                      <td className="px-3 py-2 text-right">
                        {canConfigure && (editMachineId === m._id ? (
                          <div className="flex justify-end gap-1">
                            <ErpSelect value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-28 text-[10px]">
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="MAINTENANCE">MAINTENANCE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </ErpSelect>
                            <ErpInput type="number" value={editForm.capacityPerHour} onChange={(e) => setEditForm({ ...editForm, capacityPerHour: e.target.value })} className="w-16 text-[10px]" />
                            <ErpButton className={btnSm} onClick={() => updateMachine.mutate({
                              id: m._id,
                              body: {
                                status: editForm.status,
                                capacityPerHour: editForm.capacityPerHour ? Number(editForm.capacityPerHour) : m.capacityPerHour,
                              },
                            })}
                            >Save</ErpButton>
                          </div>
                        ) : (
                          <ErpButton variant="secondary" className={btnSm} onClick={() => {
                            setEditMachineId(m._id);
                            setEditForm({ status: m.status ?? 'ACTIVE', capacityPerHour: String(m.capacityPerHour ?? '') });
                          }}
                          >Edit</ErpButton>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {!machinesLoading && machines.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-erp-text-muted">No machines</td></tr>
                  )}
                </tbody>
              </ErpDataTable>
            </div>
            {meta && meta.totalPages > 0 && (
              <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-erp-text-muted">
                <span>{meta.page}/{meta.totalPages} · {meta.total}</span>
                <div className="flex gap-1">
                  <ErpButton variant="secondary" className={btnSm} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
                  <ErpButton variant="secondary" className={btnSm} disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
                </div>
              </div>
            )}
          </ErpCard>
        </>
      )}

      {tab === 'lines' && (
        <>
          {canConfigure && (
          <ErpCard className="mb-4 p-4">
            <h3 className="mb-3 text-sm font-medium">Add production line</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={fieldLabel}>Code</label>
                <ErpInput value={lineForm.lineCode} onChange={(e) => setLineForm({ ...lineForm, lineCode: e.target.value })} className="w-28" />
              </div>
              <div>
                <label className={fieldLabel}>Name</label>
                <ErpInput value={lineForm.name} onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })} className="w-36" />
              </div>
              <div>
                <label className={fieldLabel}>Capacity / day</label>
                <ErpInput type="number" value={lineForm.capacityPerDay} onChange={(e) => setLineForm({ ...lineForm, capacityPerDay: e.target.value })} className="w-24" />
              </div>
              <ErpButton className={btnSm} disabled={!lineForm.lineCode || !lineForm.name || createLine.isPending} onClick={() => createLine.mutate()}>Add</ErpButton>
            </div>
          </ErpCard>
          )}
          <ErpCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <ErpDataTable className="w-full text-[11px]">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Capacity/day</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linesLoading && <tr><td colSpan={4} className="px-3 py-6 text-center">Loading…</td></tr>}
                  {lines.map((l: ProductionLine) => (
                    <tr key={l._id} className="border-t border-[var(--erp-border)]">
                      <td className="px-3 py-2 font-mono">{l.lineCode}</td>
                      <td className="px-3 py-2">{l.name}</td>
                      <td className="px-3 py-2">{l.capacityPerDay ?? '—'}</td>
                      <td className="px-3 py-2"><ErpStatusBadge status={l.status || 'ACTIVE'} /></td>
                    </tr>
                  ))}
                  {!linesLoading && lines.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-erp-text-muted">No lines</td></tr>
                  )}
                </tbody>
              </ErpDataTable>
            </div>
            {meta && meta.totalPages > 0 && (
              <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-erp-text-muted">
                <span>{meta.page}/{meta.totalPages}</span>
                <div className="flex gap-1">
                  <ErpButton variant="secondary" className={btnSm} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
                  <ErpButton variant="secondary" className={btnSm} disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
                </div>
              </div>
            )}
          </ErpCard>
        </>
      )}

      {tab === 'shifts' && (
        <>
          {canConfigure && (
          <ErpCard className="mb-4 p-4">
            <h3 className="mb-3 text-sm font-medium">Add shift</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={fieldLabel}>Name</label>
                <ErpInput value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} className="w-32" />
              </div>
              <div>
                <label className={fieldLabel}>Start</label>
                <ErpInput type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabel}>End</label>
                <ErpInput type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
              </div>
              <ErpButton className={btnSm} disabled={!shiftForm.name || createShift.isPending} onClick={() => createShift.mutate()}>Add</ErpButton>
            </div>
          </ErpCard>
          )}
          <ErpCard className="overflow-hidden p-0">
            <ErpDataTable className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">End</th>
                  <th className="px-3 py-2 text-left">Active</th>
                </tr>
              </thead>
              <tbody>
                {shiftsLoading && <tr><td colSpan={4} className="px-3 py-6 text-center">Loading…</td></tr>}
                {shifts.map((s: Shift) => (
                  <tr key={s._id} className="border-t border-[var(--erp-border)]">
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2">{s.startTime}</td>
                    <td className="px-3 py-2">{s.endTime}</td>
                    <td className="px-3 py-2">{s.isActive !== false ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
                {!shiftsLoading && shifts.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-erp-text-muted">No shifts</td></tr>
                )}
              </tbody>
            </ErpDataTable>
          </ErpCard>
        </>
      )}
    </div>
  );
}
