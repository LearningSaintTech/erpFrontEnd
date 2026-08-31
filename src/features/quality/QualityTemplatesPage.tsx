import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookTemplate, Plus, RefreshCw, Tags } from 'lucide-react';
import { qualityAdminApi } from '../../services/admin';
import { qualityApi } from '../../services/operations';
import {
  ErpPageHeader, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { useAuth } from '../../app/providers/AuthProvider';
import { typeLabel } from './qualityUtils';

const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

export function QualityTemplatesPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canConfigure = permissions.includes('*') || permissions.includes('quality.configure');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  return (
    <div>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Templates & defect categories"
        subtitle="Standardize inspection checklists and defect taxonomy"
        actions={(
          <ErpButton
            variant="secondary"
            onClick={() => { refetchTemplates(); refetchCategories(); }}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </ErpButton>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ErpCard className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookTemplate className="h-4 w-4 text-erp-text-muted" />
              <h3 className="text-sm font-medium">Inspection templates</h3>
            </div>
            {canConfigure && (
              <ErpButton variant="secondary" className={btnSm} onClick={() => setShowTemplateForm((v) => !v)}>
                <Plus className="mr-1 inline h-3 w-3" />
                Add
              </ErpButton>
            )}
          </div>

          <label className="mb-3 block">
            <span className={fieldLabel}>Filter by type</span>
            <ErpSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {(catalog?.templateTypes ?? catalog?.inspectionTypes ?? ['INCOMING', 'IN_PROCESS', 'FINAL']).map((t) => (
                <option key={t} value={t}>{typeLabel(t)}</option>
              ))}
            </ErpSelect>
          </label>

          {showTemplateForm && canConfigure && (
            <div className="mb-4 rounded border border-erp-border/60 p-3">
              <div className="grid gap-2">
                <label>
                  <span className={fieldLabel}>Name</span>
                  <ErpInput value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} />
                </label>
                <label>
                  <span className={fieldLabel}>Inspection type</span>
                  <ErpSelect
                    value={templateForm.inspectionType}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, inspectionType: e.target.value }))}
                  >
                    {(catalog?.templateTypes ?? ['INCOMING', 'IN_PROCESS', 'FINAL', 'SAMPLING']).map((t) => (
                      <option key={t} value={t}>{typeLabel(t)}</option>
                    ))}
                  </ErpSelect>
                </label>
                <div>
                  <span className={fieldLabel}>Checklist items</span>
                  <div className="flex gap-2">
                    <ErpInput
                      value={templateForm.checklistItem}
                      onChange={(e) => setTemplateForm((f) => ({ ...f, checklistItem: e.target.value }))}
                      placeholder="e.g. Visual inspection"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                    />
                    <ErpButton variant="secondary" className={btnSm} onClick={addChecklistItem}>Add</ErpButton>
                  </div>
                  {templateForm.checklist.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-erp-text-muted">
                      {templateForm.checklist.map((c, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{c.item}</span>
                          <button
                            type="button"
                            className="text-red-400 hover:underline"
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
                  Save template
                </ErpButton>
                <ErpButton variant="secondary" className={btnSm} onClick={() => setShowTemplateForm(false)}>
                  Cancel
                </ErpButton>
              </div>
            </div>
          )}

          <ErpDataTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Checklist</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t._id}>
                  <td>{t.name}</td>
                  <td>{typeLabel(t.inspectionType ?? '')}</td>
                  <td className="text-xs text-erp-text-muted">{t.checklist?.length ?? 0} items</td>
                  <td>
                    <ErpStatusBadge status={t.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-erp-text-muted">No templates</td></tr>
              )}
            </tbody>
          </ErpDataTable>
        </ErpCard>

        <ErpCard className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-erp-text-muted" />
              <h3 className="text-sm font-medium">Defect categories</h3>
            </div>
            {canConfigure && (
              <ErpButton variant="secondary" className={btnSm} onClick={() => setShowCategoryForm((v) => !v)}>
                <Plus className="mr-1 inline h-3 w-3" />
                Add
              </ErpButton>
            )}
          </div>

          {showCategoryForm && canConfigure && (
            <div className="mb-4 rounded border border-erp-border/60 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label>
                  <span className={fieldLabel}>Code</span>
                  <ErpInput
                    value={categoryForm.code}
                    onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="STAIN"
                  />
                </label>
                <label>
                  <span className={fieldLabel}>Severity default</span>
                  <ErpSelect
                    value={categoryForm.severity}
                    onChange={(e) => setCategoryForm((f) => ({ ...f, severity: e.target.value }))}
                  >
                    {(catalog?.defectSeverities ?? ['MINOR', 'MAJOR', 'CRITICAL']).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </ErpSelect>
                </label>
                <label className="sm:col-span-2">
                  <span className={fieldLabel}>Name</span>
                  <ErpInput
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Fabric stain"
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <ErpButton
                  className={btnSm}
                  disabled={!categoryForm.code.trim() || !categoryForm.name.trim() || createCategory.isPending}
                  onClick={() => createCategory.mutate()}
                >
                  Save category
                </ErpButton>
                <ErpButton variant="secondary" className={btnSm} onClick={() => setShowCategoryForm(false)}>
                  Cancel
                </ErpButton>
              </div>
            </div>
          )}

          <ErpDataTable>
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
                  <td className="font-mono text-xs">{c.code}</td>
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
                <tr><td colSpan={3} className="py-6 text-center text-erp-text-muted">No categories</td></tr>
              )}
            </tbody>
          </ErpDataTable>
        </ErpCard>
      </div>
    </div>
  );
}
