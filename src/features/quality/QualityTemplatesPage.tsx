import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookTemplate, ClipboardCheck, Plus, RefreshCw, Tags, X } from 'lucide-react';
import { qualityAdminApi } from '../../services/admin';
import { qualityApi } from '../../services/operations';
import type { InspectionTemplate } from '../../types/api.extended';
import {
  Badge, Button, Drawer, EmptyRow, ErpDataTable, ErpInput, ErpSelect, Field, FilterBar, IconButton, PageHeader, Section,
  StatusBadge, TableSkeleton, Tabs, humanizeStatus, toast,
} from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import { typeLabel } from './qualityUtils';
import { QueryErrorRow } from '../production/QueryErrorRow';

type TabId = 'templates' | 'categories';
type Errors = Record<string, string>;

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['inspection-templates'] });
    qc.invalidateQueries({ queryKey: ['defect-categories'] });
  };
}

function severityTone(s?: string) {
  return s === 'CRITICAL' ? 'danger' as const : s === 'MAJOR' ? 'warning' as const : 'neutral' as const;
}

function TemplateFormDrawer({ open, onClose, types }: { open: boolean; onClose: () => void; types: string[] }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState('');
  const [inspectionType, setInspectionType] = useState('INCOMING');
  const [item, setItem] = useState('');
  const [checklist, setChecklist] = useState<{ item: string; required: boolean }[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { if (open) { setName(''); setInspectionType('INCOMING'); setItem(''); setChecklist([]); setErrors({}); } }, [open]);

  const save = useMutation({
    mutationFn: () => qualityAdminApi.createTemplate({
      name: name.trim(),
      inspectionType,
      checklist: checklist.length ? checklist : undefined,
      isActive: true,
    }),
    onSuccess: (t) => { toast.success(`Template "${t.name}" created`); invalidate(); onClose(); },
  });

  const addItem = () => {
    const v = item.trim();
    if (!v) return;
    setChecklist((c) => [...c, { item: v, required: true }]);
    setItem('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = 'Give the template a name, e.g. "Fabric incoming check".';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title="New inspection template"
      description="A checklist inspectors follow for one inspection type."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="template-form" loading={save.isPending}>Save template</Button>
        </>
      )}
    >
      <form id="template-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" required error={errors.name}>
          <ErpInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Inspection type">
          <ErpSelect value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </ErpSelect>
        </Field>
        <Field label="Checklist items" hint="Press Enter to add each item.">
          <div className="flex gap-2">
            <ErpInput
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="e.g. Shade matches approved swatch"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            />
            <Button variant="secondary" onClick={addItem} disabled={!item.trim()}>Add</Button>
          </div>
        </Field>
        {checklist.length > 0 && (
          <ol className="divide-y divide-[var(--erp-border)] rounded-lg border border-[var(--erp-border)]">
            {checklist.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span><span className="mr-2 text-erp-text-muted">{i + 1}.</span>{c.item}</span>
                <IconButton aria-label={`Remove ${c.item}`} size="sm" onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))}><X size={14} /></IconButton>
              </li>
            ))}
          </ol>
        )}
      </form>
    </Drawer>
  );
}

function CategoryFormDrawer({ open, onClose, severities }: { open: boolean; onClose: () => void; severities: string[] }) {
  const invalidate = useInvalidate();
  const [form, setForm] = useState({ code: '', name: '', severity: 'MINOR' });
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { if (open) { setForm({ code: '', name: '', severity: 'MINOR' }); setErrors({}); } }, [open]);
  const save = useMutation({
    mutationFn: () => qualityAdminApi.createDefectCategory({ code: form.code.trim().toUpperCase(), name: form.name.trim(), severity: form.severity }),
    onSuccess: (c) => { toast.success(`Category ${c.code} created`); invalidate(); onClose(); },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.code.trim()) next.code = 'Enter a short code, e.g. STAIN.';
    if (!form.name.trim()) next.name = 'Enter the category name.';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={false}
      title="New defect category"
      description="Shown when inspectors log defects."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="category-form" loading={save.isPending}>Save category</Button>
        </>
      )}
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Code" required error={errors.code}>
          <ErpInput className="font-mono uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="STAIN" />
        </Field>
        <Field label="Name" required error={errors.name}>
          <ErpInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fabric stain" />
        </Field>
        <Field label="Default severity">
          <ErpSelect value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {severities.map((s) => <option key={s} value={s}>{humanizeStatus(s)}</option>)}
          </ErpSelect>
        </Field>
      </form>
    </Drawer>
  );
}

function TemplateDetailDrawer({ template, onClose }: { template: InspectionTemplate | null; onClose: () => void }) {
  if (!template) return null;
  const items = template.checklist ?? [];
  return (
    <Drawer
      open
      onClose={onClose}
      size="sm"
      title={template.name}
      description={`${typeLabel(template.inspectionType ?? '')} inspection`}
      headerExtra={<div className="mt-2"><StatusBadge status={template.isActive === false ? 'INACTIVE' : 'ACTIVE'} /></div>}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-erp-text-muted">This template has no checklist items.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((c, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--erp-surface-muted)] text-xs font-semibold">{i + 1}</span>
              <span className="pt-0.5">{c.item}{c.required !== false && <Badge tone="neutral" dot={false} className="ml-2">Required</Badge>}</span>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

export function QualityTemplatesPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canConfigure = permissions.includes('*') || permissions.includes('quality.configure');

  const [tab, setTab] = useState<TabId>('templates');
  const [typeFilter, setTypeFilter] = useState('');
  const [creating, setCreating] = useState<TabId | null>(null);
  const [selected, setSelected] = useState<InspectionTemplate | null>(null);

  const { data: catalog } = useQuery({ queryKey: ['quality-catalog'], queryFn: () => qualityApi.catalog() });
  const templatesQ = useQuery({
    queryKey: ['inspection-templates', typeFilter],
    queryFn: () => qualityAdminApi.listTemplates(typeFilter || undefined),
  });
  const categoriesQ = useQuery({ queryKey: ['defect-categories'], queryFn: qualityAdminApi.listDefectCategories });
  const templates = templatesQ.data ?? [];
  const categories = categoriesQ.data ?? [];
  const types = catalog?.templateTypes ?? catalog?.inspectionTypes ?? ['INCOMING', 'IN_PROCESS', 'FINAL', 'SAMPLING'];
  const severities = catalog?.defectSeverities ?? ['MINOR', 'MAJOR', 'CRITICAL'];

  return (
    <>
      <PageHeader
        title="Inspection templates"
        description="Standard checklists and the defect categories inspectors log against."
        secondaryActions={(
          <>
            <IconButton aria-label="Refresh" loading={templatesQ.isFetching || categoriesQ.isFetching} onClick={() => { templatesQ.refetch(); categoriesQ.refetch(); }}>
              <RefreshCw size={16} />
            </IconButton>
            <Button variant="secondary" icon={<ClipboardCheck size={16} />} onClick={() => navigate('/quality/inspections')}>Inspections</Button>
          </>
        )}
        primaryAction={canConfigure ? (
          <Button icon={<Plus size={16} />} onClick={() => setCreating(tab)}>{tab === 'templates' ? 'New template' : 'New category'}</Button>
        ) : undefined}
      />

      <Section flush>
        <div className="px-3">
          <Tabs
            ariaLabel="Quality setup"
            tabs={[
              { id: 'templates', label: 'Templates', count: templatesQ.data ? templates.length : undefined },
              { id: 'categories', label: 'Defect categories', count: categoriesQ.data ? categories.length : undefined },
            ]}
            active={tab}
            onChange={(id) => setTab(id as TabId)}
          />
        </div>

        {tab === 'templates' && (
          <>
            <FilterBar
              filters={(
                <ErpSelect inputSize="sm" aria-label="Inspection type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="">All types</option>
                  {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
                </ErpSelect>
              )}
              onClear={typeFilter ? () => setTypeFilter('') : undefined}
            />
            <ErpDataTable className="min-w-[560px]">
              <thead><tr><th>Name</th><th>Type</th><th className="erp-num">Checklist items</th><th>Status</th></tr></thead>
              <tbody>
                {templatesQ.isLoading ? <TableSkeleton asRows rows={4} columns={4} /> : templatesQ.isError ? <QueryErrorRow colSpan={4} error={templatesQ.error} onRetry={() => templatesQ.refetch()} /> : templates.length === 0 ? (
                  <EmptyRow
                    colSpan={4}
                    icon={BookTemplate}
                    title={typeFilter ? 'No templates for this type' : 'No templates yet'}
                    action={canConfigure && !typeFilter ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating('templates')}>New template</Button> : undefined}
                  >
                    {typeFilter ? undefined : 'Templates give inspectors the same checklist every time.'}
                  </EmptyRow>
                ) : templates.map((t) => (
                  <tr key={t._id} className="erp-row-clickable" onClick={() => setSelected(t)}>
                    <td className="erp-cell-primary">{t.name}</td>
                    <td>{typeLabel(t.inspectionType ?? '')}</td>
                    <td className="erp-num">{t.checklist?.length ?? 0}</td>
                    <td><StatusBadge status={t.isActive === false ? 'INACTIVE' : 'ACTIVE'} /></td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </>
        )}

        {tab === 'categories' && (
          <ErpDataTable className="min-w-[480px]">
            <thead><tr><th>Code</th><th>Name</th><th>Default severity</th></tr></thead>
            <tbody>
              {categoriesQ.isLoading ? <TableSkeleton asRows rows={4} columns={3} /> : categoriesQ.isError ? <QueryErrorRow colSpan={3} error={categoriesQ.error} onRetry={() => categoriesQ.refetch()} /> : categories.length === 0 ? (
                <EmptyRow
                  colSpan={3}
                  icon={Tags}
                  title="No defect categories yet"
                  action={canConfigure ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating('categories')}>New category</Button> : undefined}
                >
                  Categories keep defect reporting consistent across inspectors.
                </EmptyRow>
              ) : categories.map((c) => (
                <tr key={c._id}>
                  <td className="erp-cell-primary whitespace-nowrap font-mono">{c.code}</td>
                  <td>{c.name}</td>
                  <td><Badge tone={severityTone(c.severity)}>{humanizeStatus(c.severity || 'MINOR')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        )}
      </Section>

      <TemplateFormDrawer open={creating === 'templates'} onClose={() => setCreating(null)} types={types} />
      <CategoryFormDrawer open={creating === 'categories'} onClose={() => setCreating(null)} severities={severities} />
      <TemplateDetailDrawer template={selected} onClose={() => setSelected(null)} />
    </>
  );
}
