import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Barcode, CheckCircle2, ExternalLink, FileStack, Layers, Pencil, Plus, Settings2, Tag,
} from 'lucide-react';
import { skuApi } from '../../services/manufacturing';
import {
  Button, ErpDataTable, ErpSelect, ErpTabs, FilterBar, KpiGrid, PageHeader, RowActionsMenu, SearchInput, Section,
  StatTile, StatusBadge, TablePager,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import type { Sku } from '../../types/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { designIdOf, designLabel, formatPrice, sampleLabel } from './skuUtils';
import { EditSkuDrawer, GenerateSkusDrawer } from './SkuDrawers';

const PAGE_SIZE = 20;

type TabId = 'active' | 'all';

export function SkusPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('sku.create');
  const canUpdate = permissions.includes('*') || permissions.includes('sku.update');
  const canSettings = permissions.includes('*') || permissions.includes('inventory_code.read');

  const [tab, setTab] = useState<TabId>('active');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  // From an approved sample ("Generate SKUs"): open the generator with that sample chosen.
  const [searchParams, setSearchParams] = useSearchParams();
  const [generateFor, setGenerateFor] = useState('');
  useEffect(() => {
    const id = searchParams.get('generate');
    if (!id || !canCreate) return;
    setGenerateFor(id);
    setGenerateOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, canCreate, setSearchParams]);
  const [editing, setEditing] = useState<Sku | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const listParams = useMemo(() => {
    if (tab === 'active') return { status: 'ACTIVE' };
    return { status: statusFilter || undefined };
  }, [tab, statusFilter]);

  const { data: stats } = useQuery({ queryKey: ['sku-stats'], queryFn: skuApi.stats });

  const list = useQuery({
    queryKey: ['skus', page, listParams, search, tab],
    queryFn: () => skuApi.listPage({ page, limit: PAGE_SIZE, search: search || undefined, ...listParams }),
  });

  const { data: eligible = [] } = useQuery({
    queryKey: ['sku-eligible-samples'],
    queryFn: skuApi.eligibleSamples,
    enabled: canCreate,
  });
  const waitingSamples = eligible.filter((s) => (s.matrixRows ?? 0) > (s.existingSkus ?? 0)).length;

  const skus = list.data?.items ?? [];
  const meta = list.data?.meta;
  const hasFilters = !!(search || (tab === 'all' && statusFilter));
  const clearFilters = () => { setSearchInput(''); setSearch(''); setStatusFilter(''); setPage(1); };

  const showStatus = (s: string) => {
    if (s === 'ACTIVE') { setTab('active'); setStatusFilter(''); } else { setTab('all'); setStatusFilter(s); }
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="SKUs"
        description="Sellable size and colour variants, generated from approved samples."
        secondaryActions={canSettings ? (
          <Button variant="secondary" icon={<Settings2 size={16} />} onClick={() => navigate('/settings/inventory-codes')}>SKU code format</Button>
        ) : undefined}
        primaryAction={canCreate ? (
          <Button icon={<Plus size={16} />} onClick={() => setGenerateOpen(true)}>Generate SKUs</Button>
        ) : undefined}
      />

      <KpiGrid cols={4} className="mb-4">
        {canCreate ? (
          <StatTile
            icon={Layers}
            label="Samples ready for SKUs"
            value={waitingSamples}
            highlight={waitingSamples > 0 ? 'warn' : undefined}
            hint="Approved, not fully generated"
            onClick={() => setGenerateOpen(true)}
          />
        ) : (
          <StatTile icon={Tag} label="Total" value={stats?.total ?? '—'} active={tab === 'all' && !statusFilter} onClick={() => { setTab('all'); setStatusFilter(''); setPage(1); }} />
        )}
        <StatTile icon={CheckCircle2} label="Active" value={stats?.active ?? '—'} active={tab === 'active'} onClick={() => showStatus('ACTIVE')} />
        <StatTile icon={Pencil} label="Draft" value={stats?.draft ?? '—'} active={tab === 'all' && statusFilter === 'DRAFT'} onClick={() => showStatus('DRAFT')} />
        <StatTile icon={Barcode} label="Discontinued" value={stats?.discontinued ?? '—'} active={tab === 'all' && statusFilter === 'DISCONTINUED'} onClick={() => showStatus('DISCONTINUED')} />
      </KpiGrid>

      <ErpTabs
        className="mb-3"
        ariaLabel="SKU lists"
        tabs={[
          { id: 'active', label: 'Active', count: stats?.active },
          { id: 'all', label: 'All', count: stats?.total },
        ]}
        active={tab}
        onChange={(id) => { setTab(id as TabId); setPage(1); setStatusFilter(''); }}
      />

      <Section flush>
        <FilterBar
          search={<SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search code, name or design…" inputSize="sm" />}
          filters={tab === 'all' ? (
            <ErpSelect inputSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="DISCONTINUED">Discontinued</option>
            </ErpSelect>
          ) : undefined}
          onClear={hasFilters ? clearFilters : undefined}
        />
        <QueryState
          skeleton="table"
          skeletonColumns={7}
          isLoading={list.isLoading}
          isError={list.isError}
          error={list.error}
          onRetry={list.refetch}
          isEmpty={!skus.length}
          emptyIcon={Tag}
          emptyMessage={hasFilters ? 'No SKUs match these filters' : 'No SKUs yet'}
          emptyDescription={hasFilters ? 'Try a different status or search.' : 'Approve a sample, then generate its size and colour variants.'}
          emptyAction={hasFilters
            ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button>
            : canCreate ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setGenerateOpen(true)}>Generate SKUs</Button> : undefined}
        >
          <ErpDataTable className="min-w-[880px]">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Design</th>
                <th>Size</th>
                <th>Colour</th>
                <th>Sample</th>
                <th className="erp-num">Base price</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {skus.map((s: Sku) => {
                const designId = designIdOf(s);
                return (
                  <tr
                    key={s._id}
                    className={canUpdate || designId ? 'erp-row-clickable' : undefined}
                    onClick={() => { if (canUpdate) setEditing(s); else if (designId) navigate(`/designs/${designId}/edit`); }}
                  >
                    <td>
                      <p className="erp-cell-primary font-mono">{s.skuCode}</p>
                      <p className="text-xs text-erp-text-muted">{s.name}</p>
                    </td>
                    <td className="text-erp-text-secondary">{designLabel(s.designId)}</td>
                    <td className="font-mono">{s.size || '—'}</td>
                    <td>
                      {s.color?.name ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-sm border border-[var(--erp-border)]" style={{ background: s.color.hexCode || 'transparent' }} aria-hidden />
                          {s.color.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="font-mono text-[13px] text-erp-text-secondary">{sampleLabel(s.sampleId)}</td>
                    <td className="erp-num">{formatPrice(s.basePrice)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={(e) => { e.stopPropagation(); setEditing(s); }}>
                            Edit
                          </Button>
                        )}
                        <RowActionsMenu
                          label={`More actions for ${s.skuCode}`}
                          items={[
                            { label: 'Bills of materials', icon: FileStack, onSelect: () => navigate(`/products/boms?search=${encodeURIComponent(s.skuCode)}`) },
                            { label: 'Open design', icon: ExternalLink, hidden: !designId, onSelect: () => navigate(`/designs/${designId}/edit`) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
          <TablePager
            page={page}
            totalPages={meta?.totalPages ?? 0}
            total={meta?.total ?? 0}
            pageSize={PAGE_SIZE}
            itemLabel="SKUs"
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </QueryState>
      </Section>

      {canCreate && <GenerateSkusDrawer open={generateOpen} initialSampleId={generateFor} onClose={() => { setGenerateOpen(false); setGenerateFor(''); }} />}
      {canUpdate && <EditSkuDrawer sku={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
