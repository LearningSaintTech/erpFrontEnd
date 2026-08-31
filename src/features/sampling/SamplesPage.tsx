import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Beaker, ArrowRight, CheckCircle2, ClipboardList, Package, RefreshCw, Search, Shirt, FlaskConical, Truck,
} from 'lucide-react';
import { sampleApi } from '../../services/manufacturing';
import { AlertBanner } from '../../components/AlertBanner';
import {
  ErpPageHeader, ErpStatusBadge, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpTabs,
} from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import { samplingCapabilities } from './samplingPermissions';
import { SuccessBanner } from '../users/SuccessBanner';
import {
  designIdOf, designLabel, formatCost, sampleTypeLabel, statusLabel,
} from './sampleUtils';
import { queueSampleProgress, SAMPLING_HANDOFF_FLOW, SAMPLE_TYPE_GUIDE, ALL_SAMPLE_STATUSES } from './sampleWorkflowUtils';
import { sampleWaitingHint } from './sampleNextActions';
import { SampleWorkspace } from './components/SampleWorkspace';

const PAGE_SIZE = 20;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';

type TabId = 'active' | 'approved' | 'all';

export function SamplesPage() {
  const qc = useQueryClient();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const { canCreate, canApprove, canUpdate, myWorkOnly } = samplingCapabilities(permissions, isSuperAdmin);
  const canInventory = permissions.includes('*') || permissions.includes('inventory.update');
  const patternMasterScope = myWorkOnly && user?._id ? user._id : undefined;

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkSampleId = searchParams.get('sampleId') ?? '';
  const deepLinkDesignId = searchParams.get('designId') ?? '';
  const fromPattern = searchParams.get('from') === 'pattern';

  const [tab, setTab] = useState<TabId>('active');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createDesignId, setCreateDesignId] = useState('');
  const [createType, setCreateType] = useState('PROTOTYPE');
  const [createLaborHours, setCreateLaborHours] = useState('4');
  const [createLaborRate, setCreateLaborRate] = useState('150');
  const [workspaceSampleId, setWorkspaceSampleId] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const openWorkspace = (sampleId: string) => {
    setWorkspaceSampleId(sampleId);
    setSearchParams({ sampleId });
  };

  const closeWorkspace = () => {
    setWorkspaceSampleId(null);
    if (deepLinkDesignId) setSearchParams({ designId: deepLinkDesignId });
    else setSearchParams({});
  };

  const listParams = useMemo(() => {
    const base = {
      sampleType: typeFilter || undefined,
      patternMasterId: patternMasterScope,
    };
    if (tab === 'approved') return { ...base, status: 'APPROVED' };
    if (tab === 'active') {
      return {
        ...base,
        excludeTerminal: true,
        status: statusFilter || undefined,
      };
    }
    return { ...base, status: statusFilter || undefined };
  }, [tab, statusFilter, typeFilter, patternMasterScope]);

  const statsKey = ['sample-stats', patternMasterScope ?? 'all'] as const;

  const { data: stats } = useQuery({
    queryKey: statsKey,
    queryFn: () => sampleApi.stats(patternMasterScope ? { patternMasterId: patternMasterScope } : undefined),
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['samples', page, listParams, search, tab, patternMasterScope ?? 'all'],
    queryFn: () => sampleApi.listPage({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      ...listParams,
    }),
  });

  const samples = data?.items ?? [];
  const meta = data?.meta;

  const tabCounts = useMemo(() => ({
    active: stats?.active ?? 0,
    approved: stats?.approved ?? 0,
    all: stats?.total ?? 0,
  }), [stats]);

  const { data: eligibleDesigns = [] } = useQuery({
    queryKey: ['sample-eligible-designs'],
    queryFn: sampleApi.eligibleDesigns,
    enabled: canCreate,
  });

  const { data: deepSample, isFetched: deepSampleChecked } = useQuery({
    queryKey: ['sample', deepLinkSampleId],
    queryFn: () => sampleApi.get(deepLinkSampleId),
    enabled: !!deepLinkSampleId,
    retry: false,
  });

  useEffect(() => {
    if (deepLinkSampleId) {
      if (!deepSampleChecked) return;
      if (deepSample) {
        setWorkspaceSampleId(deepLinkSampleId);
        if (deepSample.status === 'APPROVED') setTab('approved');
      } else {
        setWorkspaceSampleId(null);
      }
      return;
    }
    if (!deepLinkDesignId) {
      setWorkspaceSampleId(null);
      return;
    }
    const match = samples.find((s) => designIdOf(s) === deepLinkDesignId);
    if (match) {
      setWorkspaceSampleId(match._id);
      setSearchParams({ sampleId: match._id });
    } else if (canCreate) {
      setCreateDesignId(deepLinkDesignId);
    }
  }, [deepLinkSampleId, deepLinkDesignId, deepSampleChecked, deepSample, samples, canCreate, setSearchParams]);

  useEffect(() => {
    if (!deepLinkDesignId || !canCreate || deepLinkSampleId) return;
    if (eligibleDesigns.some((d) => d._id === deepLinkDesignId)) {
      setCreateDesignId(deepLinkDesignId);
    }
  }, [deepLinkDesignId, eligibleDesigns, canCreate, deepLinkSampleId]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['samples'] });
    qc.invalidateQueries({ queryKey: statsKey });
    qc.invalidateQueries({ queryKey: ['sample-eligible-designs'] });
    qc.invalidateQueries({ queryKey: ['inventory-availability'] });
    qc.invalidateQueries({ queryKey: ['approvals-pending'] });
  };

  const createMutation = useMutation({
    mutationFn: () => sampleApi.create({
      designId: createDesignId,
      sampleType: createType,
      laborHours: Number(createLaborHours) || 0,
      laborRate: Number(createLaborRate) || 0,
    }),
    onSuccess: (created) => {
      setCreateDesignId('');
      invalidate();
      showSuccess('Sample created — pattern master handles fabric & RM; pattern or sampling team run cutting onward');
      if (created?._id) openWorkspace(created._id);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (workspaceSampleId) {
    return (
      <div className="samples-page text-xs leading-snug">
        <SampleWorkspace
          sampleId={workspaceSampleId}
          onClose={closeWorkspace}
          onUpdated={invalidate}
        />
      </div>
    );
  }

  return (
    <div className="samples-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      {fromPattern && deepLinkDesignId && (
        <ErpCard className="mb-3 !border-emerald-500/30 !bg-emerald-500/5 !p-3">
          <p className="text-[11px] font-medium text-emerald-900">Pattern development complete</p>
          <p className="mt-1 text-[10px] text-emerald-800">
            {canCreate
              ? 'Create a fit or prototype sample below to hand off to the pattern master for materials and production.'
              : 'Sampling is unlocked for this design. A design manager will create the sample — you can open it here once created.'}
          </p>
        </ErpCard>
      )}

      {canApprove && !canUpdate && (
        <ErpCard className="mb-3 !border-[var(--erp-border)] !p-3">
          <p className="text-[11px] text-erp-text-muted">
            View and approve samples — fabric & RM stay with the assigned pattern master; cutting, stitching, and fit are pattern or sampling team.
            Open a sample to review materials, QC, and sign-off.
          </p>
        </ErpCard>
      )}

      <ErpPageHeader
        title="Sampling"
        subtitle={(
          <>
            {myWorkOnly ? 'Your pattern assignments — ' : ''}
            Pattern master submits RM → store issue → cutting / stitching / fit (pattern or sampling team) → QC.
            <Link to="/approvals" className="ml-2 text-[var(--erp-accent)]">Approvals →</Link>
            <Link to="/inventory" className="ml-2 text-[var(--erp-accent)]">Inventory →</Link>
            <Link to="/pattern" className="ml-2 text-[var(--erp-accent)]">Pattern →</Link>
          </>
        )}
        actions={(
          <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={isFetching} onClick={() => { refetch(); invalidate(); }}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            <span className="ml-1">Refresh</span>
          </ErpButton>
        )}
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard icon={Beaker} label="Active" value={stats?.active} />
        <StatCard icon={ClipboardList} label="RM pending" value={stats?.materialPending} accent="text-amber-500" />
        <StatCard icon={Shirt} label="In production" value={stats?.inProduction} accent="text-[var(--erp-accent)]" />
        <StatCard icon={FlaskConical} label="QC pending" value={stats?.qcPending} accent="text-violet-500" />
        <StatCard icon={Package} label="Awaiting sign-off" value={stats?.pendingApproval} accent="text-sky-500" />
        <StatCard icon={CheckCircle2} label="Approved" value={stats?.approved} accent="text-emerald-500" />
      </div>

      <ErpCard className="mb-3 !p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Sampling RM handoff</p>
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          {SAMPLING_HANDOFF_FLOW.map((step, i) => (
            <span key={step.id} className="flex items-center gap-1">
              {i > 0 && <ArrowRight size={10} className="text-erp-text-muted" />}
              <span className="rounded px-1.5 py-0.5 text-erp-text-muted" title={step.who}>{step.label}</span>
            </span>
          ))}
        </div>
        {canInventory && (
          <div className="mt-2 flex flex-wrap gap-1">
            <ErpButton variant="secondary" className="!px-2 !py-0.5 text-[10px]" onClick={() => { setTab('active'); setStatusFilter('MATERIAL_REQUEST_APPROVED'); setPage(1); }}>
              <Truck size={10} className="mr-1 inline" />Awaiting reserve
            </ErpButton>
            <ErpButton variant="secondary" className="!px-2 !py-0.5 text-[10px]" onClick={() => { setTab('active'); setStatusFilter('MATERIAL_RESERVED'); setPage(1); }}>
              Awaiting issue
            </ErpButton>
          </div>
        )}
      </ErpCard>

      {canCreate && (
        <ErpCard className="mb-3 !p-3">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-[var(--erp-accent)]" />
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Create sample</h3>
          </div>
          <p className="mt-1 text-[10px] text-erp-text-muted">
            Design must be released with completed pattern development. One active sample per design.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className={fieldLabel}>Design</label>
              <ErpSelect className="w-full !py-1.5 text-[11px]" value={createDesignId} onChange={(e) => setCreateDesignId(e.target.value)}>
                <option value="">Select design…</option>
                {eligibleDesigns.map((d) => (
                  <option key={d._id} value={d._id}>{d.designCode} — {d.title}</option>
                ))}
              </ErpSelect>
            </div>
            <div className="min-w-[140px]">
              <label className={fieldLabel}>Type</label>
              <ErpSelect className="w-full !py-1.5 text-[11px]" value={createType} onChange={(e) => setCreateType(e.target.value)}>
                <option value="PROTOTYPE">Proto sample</option>
                <option value="FIT">Fit sample</option>
                <option value="SIZE_SET">Size set</option>
                <option value="SALESMAN">Salesman sample</option>
                <option value="PHOTO">Photo sample</option>
                <option value="PP">Pre-production (PP)</option>
                <option value="TOP">TOP sample</option>
                <option value="SHIPMENT">Shipment sample</option>
              </ErpSelect>
            </div>
            <div className="w-20">
              <label className={fieldLabel}>Labor hrs</label>
              <ErpInput className="!py-1.5 text-[11px]" type="number" min={0} value={createLaborHours} onChange={(e) => setCreateLaborHours(e.target.value)} />
            </div>
            <div className="w-24">
              <label className={fieldLabel}>Rate/hr</label>
              <ErpInput className="!py-1.5 text-[11px]" type="number" min={0} value={createLaborRate} onChange={(e) => setCreateLaborRate(e.target.value)} />
            </div>
            <ErpButton
              className="!px-3 !py-1.5 text-[11px]"
              disabled={!createDesignId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create & open
            </ErpButton>
          </div>
          {createType && SAMPLE_TYPE_GUIDE[createType] && (
            <p className="mt-2 text-[10px] text-erp-text-muted">{SAMPLE_TYPE_GUIDE[createType]}</p>
          )}
        </ErpCard>
      )}

      <ErpTabs
        tabs={[
          { id: 'active', label: `Active (${tabCounts.active})` },
          { id: 'approved', label: `Approved (${tabCounts.approved})` },
          { id: 'all', label: `All (${tabCounts.all})` },
        ]}
        active={tab}
        onChange={(id) => { setTab(id as TabId); setPage(1); setStatusFilter(''); }}
      />

      <ErpCard className="mt-3 !p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--erp-border)] p-3">
          <div className="relative min-w-[180px] flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
            <ErpInput
              className="!py-1.5 pl-7 text-[11px]"
              placeholder="Search code or design…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
            />
          </div>
          <ErpSelect className="!py-1.5 text-[11px]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            <option value="PROTOTYPE">Proto sample</option>
            <option value="FIT">Fit sample</option>
            <option value="SIZE_SET">Size set</option>
            <option value="SALESMAN">Salesman sample</option>
            <option value="PHOTO">Photo sample</option>
            <option value="PP">Pre-production (PP)</option>
            <option value="TOP">TOP sample</option>
            <option value="SHIPMENT">Shipment sample</option>
          </ErpSelect>
          {tab !== 'approved' && (
            <ErpSelect className="!py-1.5 text-[11px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {ALL_SAMPLE_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </ErpSelect>
          )}
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput); setPage(1); }}>Search</ErpButton>
        </div>

        {isLoading ? (
          <p className="p-6 text-center text-[11px] text-erp-text-muted">Loading samples…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[720px] text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Sample</th>
                  <th className="px-3 py-2 text-left">Design</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Progress</th>
                  <th className="px-3 py-2 text-left">Sample cost</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => {
                  const progress = queueSampleProgress(s.status, s.sampleType);
                  return (
                    <tr key={s._id} className="border-t border-[var(--erp-border)] hover:bg-[var(--erp-surface-muted)]/50">
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] text-erp-text-muted">{s.sampleCode}</span>
                        {s.iteration && s.iteration > 1 && (
                          <span className="ml-1 text-[10px] text-amber-600">v{s.iteration}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Link to={`/designs/${designIdOf(s)}/edit`} className="text-[var(--erp-accent)] hover:underline" onClick={(e) => e.stopPropagation()}>
                          {designLabel(s.designId)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{sampleTypeLabel(s.sampleType)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--erp-border)]">
                            <div className="h-full bg-[var(--erp-accent)]" style={{ width: `${progress.percent}%` }} />
                          </div>
                          <span className="text-[10px] text-erp-text-muted">{progress.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{formatCost(s.totalCost)}</td>
                      <td className="px-3 py-2">
                        <ErpStatusBadge status={s.status} label={statusLabel(s.status)} />
                        {tab === 'active' && !['APPROVED', 'REJECTED'].includes(s.status) && (
                          <p className="mt-0.5 max-w-[140px] text-[9px] text-erp-text-muted">
                            {sampleWaitingHint(s.status).who}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ErpButton className="!px-3 !py-1 text-[10px]" onClick={() => openWorkspace(s._id)}>
                          Open
                        </ErpButton>
                      </td>
                    </tr>
                  );
                })}
                {samples.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                      {tab === 'active'
                        ? (myWorkOnly
                          ? 'No active samples assigned to you — check pattern assignments'
                          : 'No active samples — complete pattern development, then create a sample')
                        : 'No samples match your filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}
        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
            <p className="text-[10px] text-erp-text-muted">
              {meta.page}/{meta.totalPages} · showing {samples.length} of {meta.total}
              {statusFilter || typeFilter || search ? ' (filtered)' : ''}
            </p>
            <div className="flex gap-1">
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
            </div>
          </div>
        )}
      </ErpCard>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = 'text-[var(--erp-accent)]',
}: {
  icon: typeof Beaker;
  label: string;
  value?: number;
  accent?: string;
}) {
  return (
    <ErpCard className="!p-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className={accent} />
        <div>
          <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">{label}</p>
          <p className="text-lg font-semibold">{value ?? '—'}</p>
        </div>
      </div>
    </ErpCard>
  );
}
