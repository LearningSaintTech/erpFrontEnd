import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { approvalApi } from '../../../services/approvals';
import type { ApprovalWorkflow } from '../../../types/api';
import {
  ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect,
} from '../../../components/erp';
import { ConfirmDialog } from '../../users/ConfirmDialog';
import { documentTypeLabel } from '../approvalUtils';

type LevelForm = {
  approverRole: string;
  slaHours: number;
  approvalType: 'ANY' | 'ALL';
};

export function WorkflowsTab({
  canConfigure,
  documentTypes,
  approverOptions,
  organizationId,
  factoryId,
  onError,
  onSuccess,
}: {
  canConfigure: boolean;
  documentTypes: string[];
  approverOptions: { documentType: string; permission: string; label: string }[];
  organizationId?: string;
  factoryId?: string;
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [form, setForm] = useState({
    documentType: 'DESIGN',
    name: '',
    levels: [{ approverRole: 'design.approve', slaHours: 24, approvalType: 'ANY' as const }] as LevelForm[],
  });

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['approval-workflows', showInactive],
    queryFn: () => approvalApi.listWorkflows({ includeInactive: showInactive }),
  });

  const defaultRole = useMemo(
    () => approverOptions.find((o) => o.documentType === form.documentType)?.permission || 'approval.approve',
    [approverOptions, form.documentType],
  );

  const createMut = useMutation({
    mutationFn: () => approvalApi.createWorkflow({
      organizationId,
      factoryId,
      documentType: form.documentType,
      name: form.name.trim(),
      levels: form.levels.map((l, i) => ({
        level: i + 1,
        approverRoles: [l.approverRole],
        approvalType: l.approvalType,
        slaHours: l.slaHours,
      })),
      isActive: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approval-workflows'] });
      setForm({
        documentType: 'DESIGN',
        name: '',
        levels: [{ approverRole: 'design.approve', slaHours: 24, approvalType: 'ANY' }],
      });
      setFormOpen(false);
      onSuccess('Workflow created');
    },
    onError: (e: Error) => onError(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => approvalApi.deactivateWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approval-workflows'] });
      setDeactivateId(null);
      onSuccess('Workflow deactivated');
    },
    onError: (e: Error) => onError(e.message),
  });

  const roleOptionsForType = (docType: string) =>
    approverOptions.filter((o) => o.documentType === docType || o.documentType === '*');

  const addLevel = () => {
    setForm((f) => ({
      ...f,
      levels: [...f.levels, { approverRole: defaultRole, slaHours: 24, approvalType: 'ANY' }],
    }));
  };

  const updateLevel = (index: number, patch: Partial<LevelForm>) => {
    setForm((f) => ({
      ...f,
      levels: f.levels.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  };

  const removeLevel = (index: number) => {
    setForm((f) => ({ ...f, levels: f.levels.filter((_, i) => i !== index) }));
  };

  return (
    <div className="space-y-3">
      <ErpCard className="!p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Approval workflows</h3>
            <p className="text-[10px] text-erp-text-muted">
              Configure multi-level approval chains per document type. Creating a workflow deactivates the previous one for that type.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-erp-text-muted">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
              Show inactive
            </label>
            {canConfigure && (
              <ErpButton className="!px-2 !py-1.5 text-[11px]" onClick={() => setFormOpen((v) => !v)}>
                <Plus size={12} className="mr-1 inline" /> New workflow
              </ErpButton>
            )}
          </div>
        </div>
      </ErpCard>

      {formOpen && canConfigure && (
        <ErpCard className="!p-3">
          <h4 className="mb-2 text-[11px] font-semibold">Create workflow</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] text-erp-text-muted">Document type</label>
              <ErpSelect
                className="w-full !py-1.5 text-[11px]"
                value={form.documentType}
                onChange={(e) => {
                  const docType = e.target.value;
                  const role = roleOptionsForType(docType)[0]?.permission || 'approval.approve';
                  setForm((f) => ({
                    ...f,
                    documentType: docType,
                    levels: f.levels.map((l) => ({ ...l, approverRole: role })),
                  }));
                }}
              >
                {documentTypes.map((t) => <option key={t} value={t}>{documentTypeLabel(t)}</option>)}
              </ErpSelect>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-erp-text-muted">Workflow name</label>
              <ErpInput className="w-full !py-1.5 text-[11px]" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Approval levels</p>
            {form.levels.map((level, index) => (
              <div key={index} className="grid gap-2 rounded border border-[var(--erp-border)] p-2 sm:grid-cols-4">
                <p className="text-[10px] font-medium text-erp-text-muted sm:col-span-4">Level {index + 1}</p>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] text-erp-text-muted">Approver permission</label>
                  <ErpSelect
                    className="w-full !py-1.5 text-[11px]"
                    value={level.approverRole}
                    onChange={(e) => updateLevel(index, { approverRole: e.target.value })}
                  >
                    {roleOptionsForType(form.documentType).map((o) => (
                      <option key={o.permission} value={o.permission}>{o.label}</option>
                    ))}
                  </ErpSelect>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-erp-text-muted">SLA (hours)</label>
                  <ErpInput type="number" min={1} className="w-full !py-1.5 text-[11px]" value={level.slaHours} onChange={(e) => updateLevel(index, { slaHours: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-erp-text-muted">Quorum</label>
                  <ErpSelect className="w-full !py-1.5 text-[11px]" value={level.approvalType} onChange={(e) => updateLevel(index, { approvalType: e.target.value as 'ANY' | 'ALL' })}>
                    <option value="ANY">Any one</option>
                    <option value="ALL">All required</option>
                  </ErpSelect>
                </div>
                {form.levels.length > 1 && (
                  <div className="sm:col-span-4">
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => removeLevel(index)}>
                      Remove level
                    </ErpButton>
                  </div>
                )}
              </div>
            ))}
            {form.levels.length < 5 && (
              <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={addLevel}>
                <Plus size={12} className="mr-1 inline" /> Add level
              </ErpButton>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <ErpButton
              className="!px-3 !py-1.5 text-[11px]"
              disabled={!form.name.trim() || !factoryId || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Creating…' : 'Create workflow'}
            </ErpButton>
            <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={() => setFormOpen(false)}>Cancel</ErpButton>
          </div>
        </ErpCard>
      )}

      <ErpCard className="overflow-hidden !p-0">
        {isLoading ? (
          <p className="p-4 text-[11px] text-erp-text-muted">Loading workflows…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Document type</th>
                  <th>Levels</th>
                  <th>Status</th>
                  {canConfigure && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {workflows.map((w: ApprovalWorkflow) => (
                  <tr key={w._id}>
                    <td className="text-[11px] font-medium">{w.name}</td>
                    <td className="text-[11px]">{documentTypeLabel(w.documentType)}</td>
                    <td className="text-[10px] text-erp-text-muted">
                      {w.levels?.map((l) => `L${l.level}: ${l.approverRoles?.join('/')}`).join(' → ') || '—'}
                    </td>
                    <td className="text-[11px]">{w.isActive !== false ? 'Active' : 'Inactive'}</td>
                    {canConfigure && (
                      <td className="text-right">
                        {w.isActive !== false && (
                          <ErpButton variant="secondary" className="!px-1.5 !py-1" onClick={() => setDeactivateId(w._id)}>
                            <Trash2 size={11} />
                          </ErpButton>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {workflows.length === 0 && (
                  <tr>
                    <td colSpan={canConfigure ? 5 : 4} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                      No workflows — create one to route approvals automatically
                    </td>
                  </tr>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}
      </ErpCard>

      <ConfirmDialog
        open={!!deactivateId}
        title="Deactivate workflow"
        message="Pending approvals keep their current instance. New submissions will need another active workflow for this document type."
        confirmLabel="Deactivate"
        danger
        loading={deactivateMut.isPending}
        onConfirm={() => deactivateId && deactivateMut.mutate(deactivateId)}
        onCancel={() => setDeactivateId(null)}
      />
    </div>
  );
}
