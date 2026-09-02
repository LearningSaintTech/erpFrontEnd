import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookTemplate, Plus, RefreshCw, Tags, X } from 'lucide-react';
import { qualityAdminApi } from '../../services/admin';
import { qualityApi } from '../../services/operations';
import {
  ComposeSection, EmptyRow, ErpButton, ErpDataTable, ErpInput, ErpPageHeader, ErpSelect,
  ErpStatusBadge, ErpTabs, StatTile, TabShell, TabToolbar, btnSm, fieldLabel,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { useAuth } from '../../app/providers/AuthProvider';
import { typeLabel } from './qualityUtils';

type TabId = 'templates' | 'categories';

export function QualityTemplatesPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canConfigure = permissions.includes('*') || permissions.includes('quality.configure');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<TabId>('templates');
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  const [templateForm, setTemplateForm] = useState({
    name: '',
    inspectionType: 'INCOMING',
    checklistItem: '',
    checklist: [] as { item: string; required: boolean }[],
  });

  const [categoryForm, setCategoryForm] = useState({
    code: '',
    name: '',
    severity: 'MINOR',
  });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inspection-templates'] });
    qc.invalidateQueries({ queryKey: ['defect-categories'] });
  };

  const { data: catalog } = useQuery({ queryKey: ['quality-catalog'], queryFn: () => qualityApi.catalog() });

  const { data: templates = [], isFetching: templatesFetching, refetch: refetchTemplates } = useQuery({
    queryKey: ['inspection-templates', typeFilter],
    queryFn: () => qualityAdminApi.listTemplates(typeFilter || undefined),
  });

  const { data: categories = [], isFetching: categoriesFetching, refetch: refetchCategories } = useQuery({
    queryKey: ['defect-categories'],
    queryFn: qualityAdminApi.listDefectCategories,
  });

  const createTemplate = useMutation({
    mutationFn: () => qualityAdminApi.createTemplate({
      name: templateForm.name.trim(),
      inspectionType: templateForm.inspectionType,
      checklist: templateForm.checklist.length ? templateForm.checklist : undefined,
      isActive: true,
    }),
    onSuccess: (t) => {
      setTemplateForm({ name: '', inspectionType: 'INCOMING', checklistItem: '', checklist: [] });
      setShowTemplateForm(false);
      showSuccess(`Template "${t.name}" created`);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const createCategory = useMutation({
    mutationFn: () => qualityAdminApi.createDefectCategory({
      code: categoryForm.code.trim().toUpperCase(),
      name: categoryForm.name.trim(),
      severity: categoryForm.severity,
    }),
    onSuccess: (c) => {
      setCategoryForm({ code: '', name: '', severity: 'MINOR' });
      setShowCategoryForm(false);
      showSuccess(`Category ${c.code} created`);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const addChecklistItem = () => {
    const item = templateForm.checklistItem.trim();
    if (!item) return;
    setTemplateForm((f) => ({
      ...f,
      checklist: [...f.checklist, { item, required: true }],
      checklistItem: '',
    }));
  };

  const isFetching = templatesFetching || categoriesFetching;

  const goTab = (id: TabId) => {
    setTab(id);
    setShowTemplateForm(false);
    setShowCategoryForm(false);
  };

  return (
    <div className="space-y-3">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Templates and defect categories"
        subtitle={(
          <>
            Standardize inspection checklists and defect taxonomy.
            <Link to="/quality/inspections" className="ml-2 text-[var(--erp-accent)]">Inspections -&gt;</Link>
          </>
        )}
        actions={(
          <ErpButton
            variant="secondary"
            className={btnSm}
            onClick={() => { refetchTemplates(); refetchCategories(); }}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </ErpButton>
        )}
      />

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-border)] sm:grid-cols-2">
        <StatTile icon={BookTemplate} label="Templates" value={templates.length} onClick={() => goTab('templates')} />
        <StatTile icon={Tags} label="Defect categories" value={categories.length} onClick={() => goTab('categories')} />
      </div>

      <TabShell
        tabs={(
          <ErpTabs
            tabs={[
              { id: 'templates', label: `Templates (${templates.length})` },
              { id: 'categories', label: `Categories (${categories.length})` },
            ]}
            active={tab}
            onChange={(id) => goTab(id as TabId)}
          />
        )}
      >
        {tab === 'templates' && (
          <>
            {canConfigure && showTemplateForm && (
              <ComposeSection title="New inspection template" hint="Add checklist items, then save. Used when creating inspections of this type.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={fieldLabel}>Name</label>
                    <ErpInput className="!py-1.5 text-[12px]" value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Inspection type</label>
                    <ErpSelect
                      className="!py-1.5 text-[12px]"
                      value={templateForm.inspectionType}
                      onChange={(e) => setTemplateForm((f) => ({ ...f, inspectionType: e.target.value }))}
                    >
                      {(catalog?.templateTypes ?? ['INCOMING', 'IN_PROCESS', 'FINAL', 'SAMPLING']).map((t) => (
                        <option key={t} value={t}>{typeLabel(t)}</option>
                      ))}
                    </ErpSelect>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={fieldLabel}>Checklist items</label>
                    <div className="flex gap-2">
                      <ErpInput
                        className="!py-1.5 text-[12px]"
                        value={templateForm.checklistItem}
                        onChange={(e) => setTemplateForm((f) => ({ ...f, checklistItem: e.target.value }))}
                        placeholder="e.g. Visual inspection"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                      />
                      <ErpButton variant="secondary" className={btnSm} onClick={addChecklistItem}>Add</ErpButton>
                    </div>
                    {templateForm.checklist.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[12px] text-erp-text-muted">
                        {templateForm.checklist.map((c, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span>{c.item}</span>
                            <button
                              type="button"
                              className="text-red-500 hover:underline"
                              onClick={() => setTemplateForm((f) => ({
                                ...f,
                                checklist: f.checklist.filter((_, j) => j !== i),
                              }))}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <ErpButton
                    className={btnSm}
                    disabled={!templateForm.name.trim() || createTemplate.isPending}
                    onClick={() => createTemplate.mutate()}
                  >
                    {createTemplate.isPending ? 'Saving...' : 'Save template'}
                  </ErpButton>
                  <ErpButton variant="secondary" className={btnSm} onClick={() => setShowTemplateForm(false)}>
                    Cancel
                  </ErpButton>
                </div>
              </ComposeSection>
            )}

            <TabToolbar title="Inspection templates" hint="Filter by inspection type.">
              <div className="w-44">
                <label className={fieldLabel}>Type</label>
                <ErpSelect className="!py-1.5 text-[12px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="">All types</option>
                  {(catalog?.templateTypes ?? catalog?.inspectionTypes ?? ['INCOMING', 'IN_PROCESS', 'FINAL']).map((t) => (
                    <option key={t} value={t}>{typeLabel(t)}</option>
                  ))}
                </ErpSelect>
              </div>
              {canConfigure && (
                <ErpButton className={btnSm} onClick={() => setShowTemplateForm((v) => !v)}>
                  {showTemplateForm ? <X className="mr-1 inline h-3.5 w-3.5" /> : <Plus className="mr-1 inline h-3.5 w-3.5" />}
                  {showTemplateForm ? 'Cancel' : 'Add'}
                </ErpButton>
              )}
            </TabToolbar>

            <div className="overflow-x-auto">
              <ErpDataTable className="w-full min-w-[560px] text-[12px]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th className="text-right">Checklist</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t._id}>
                      <td className="font-medium">{t.name}</td>
                      <td>{typeLabel(t.inspectionType ?? '')}</td>
                      <td className="text-right text-erp-text-muted">{t.checklist?.length ?? 0} items</td>
                      <td>
                        <ErpStatusBadge status={t.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && (
                    <EmptyRow colSpan={4}>No templates</EmptyRow>
                  )}
                </tbody>
              </ErpDataTable>
            </div>
          </>
        )}

        {tab === 'categories' && (
          <>
            {canConfigure && showCategoryForm && (
              <ComposeSection title="New defect category" hint="Code and name appear when recording defects on an inspection.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={fieldLabel}>Code</label>
                    <ErpInput
                      className="!py-1.5 font-mono text-[12px]"
                      value={categoryForm.code}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder="STAIN"
                    />
                  </div>
                  <div>
                    <label className={fieldLabel}>Severity default</label>
                    <ErpSelect
                      className="!py-1.5 text-[12px]"
                      value={categoryForm.severity}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, severity: e.target.value }))}
                    >
                      {(catalog?.defectSeverities ?? ['MINOR', 'MAJOR', 'CRITICAL']).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </ErpSelect>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={fieldLabel}>Name</label>
                    <ErpInput
                      className="!py-1.5 text-[12px]"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Fabric stain"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <ErpButton
                    className={btnSm}
                    disabled={!categoryForm.code.trim() || !categoryForm.name.trim() || createCategory.isPending}
                    onClick={() => createCategory.mutate()}
                  >
                    {createCategory.isPending ? 'Saving...' : 'Save category'}
                  </ErpButton>
                  <ErpButton variant="secondary" className={btnSm} onClick={() => setShowCategoryForm(false)}>
                    Cancel
                  </ErpButton>
                </div>
              </ComposeSection>
            )}

            <TabToolbar title="Defect categories" hint="Used when logging defects during inspection.">
              {canConfigure && (
                <ErpButton className={btnSm} onClick={() => setShowCategoryForm((v) => !v)}>
                  {showCategoryForm ? <X className="mr-1 inline h-3.5 w-3.5" /> : <Plus className="mr-1 inline h-3.5 w-3.5" />}
                  {showCategoryForm ? 'Cancel' : 'Add'}
                </ErpButton>
              )}
            </TabToolbar>

            <div className="overflow-x-auto">
              <ErpDataTable className="w-full min-w-[480px] text-[12px]">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c._id}>
                      <td className="whitespace-nowrap font-mono">{c.code}</td>
                      <td>{c.name}</td>
                      <td>
                        <ErpStatusBadge
                          status={c.severity === 'CRITICAL' ? 'REJECTED' : c.severity === 'MAJOR' ? 'IN_REVIEW' : 'PENDING'}
                          label={c.severity || 'MINOR'}
                        />
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <EmptyRow colSpan={3}>No categories</EmptyRow>
                  )}
                </tbody>
              </ErpDataTable>
            </div>
          </>
        )}
      </TabShell>
    </div>
  );
}
