import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, GitBranch, Plus, Trash2 } from 'lucide-react';
import { approvalApi } from '../../../services/approvals';
import type { ApprovalWorkflow } from '../../../types/api';
import {
  Badge, Button, Drawer, EmptyRow, ErpDataTable, ErpInput, ErpSelect, Field, FilterBar, IconButton,
  RowActionsMenu, Section, StatusBadge, TableSkeleton, useConfirm,
} from '../../../components/erp';
import { documentTypeLabel } from '../approvalUtils';

type LevelForm = {
  approverRole: string;
  slaHours: number;
  approvalType: 'ANY' | 'ALL';
};

type ApproverOption = { documentType: string; permission: string; label: string };

function roleOptionsForType(options: ApproverOption[], docType: string) {
  return options.filter((o) => o.documentType === docType || o.documentType === '*');
}

export function WorkflowsTab({
  canConfigure,
  documentTypes,
  approverOptions,
  organizationId,
  factoryId,
  createOpen,
  onCreateOpenChange,
}: {
  canConfigure: boolean;
  documentTypes: string[];
  approverOptions: ApproverOption[];
  organizationId?: string;
  factoryId?: string;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showInactive, setShowInactive] = useState(false);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['approval-workflows', showInactive],
    queryFn: () => approvalApi.listWorkflows({ includeInactive: showInactive }),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => approvalApi.deactivateWorkflow(id),
    meta: { successMessage: 'Workflow deactivated' },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-workflows'] }),
  });

  const roleLabel = (perm: string) => approverOptions.find((o) => o.permission === perm)?.label || perm;

  const deactivate = async (w: ApprovalWorkflow) => {
    const ok = await confirm({
      title: `Deactivate "${w.name}"?`,
      message: 'Pending approvals keep their current workflow. New submissions for this document type will need another active workflow.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (ok) deactivateMut.mutate(w._id);
  };

  return (
    <>
      <Section flush>
        <FilterBar
          filters={(
            <label className="flex items-center gap-2 text-[13px] text-erp-text-secondary">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 rounded" />
              Show inactive workflows
            </label>
          )}
        />
        <ErpDataTable>
          <thead>
            <tr>
              <th>Name</th>
              <th>Document type</th>
              <th>Approval chain</th>
              <th>Status</th>
              {canConfigure && <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton asRows rows={4} columns={canConfigure ? 5 : 4} />
            ) : workflows.length === 0 ? (
              <EmptyRow
                colSpan={canConfigure ? 5 : 4}
                icon={GitBranch}
                title="No approval workflows yet"
                action={canConfigure ? <Button size="sm" icon={<Plus size={16} />} onClick={() => onCreateOpenChange(true)}>New workflow</Button> : undefined}
              >
                Without a workflow, documents use the default approver for their type.
              </EmptyRow>
            ) : workflows.map((w: ApprovalWorkflow) => (
              <tr key={w._id}>
                <td className="erp-cell-primary">{w.name}</td>
                <td>{documentTypeLabel(w.documentType)}</td>
                <td>
                  <ol className="flex flex-wrap items-center gap-1.5">
                    {(w.levels ?? []).map((l, i) => (
                      <li key={l.level} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-erp-text-muted" aria-hidden="true">›</span>}
                        <Badge dot={false} tone="neutral">
                          L{l.level}: {(l.approverRoles ?? (l.approverRole ? [l.approverRole] : [])).map(roleLabel).join(' / ') || '—'}
                          {l.slaHours ? ` · ${l.slaHours}h` : ''}
                        </Badge>
                      </li>
                    ))}
                  </ol>
                </td>
                <td><StatusBadge status={w.isActive !== false ? 'ACTIVE' : 'INACTIVE'} /></td>
                {canConfigure && (
                  <td className="erp-cell-actions">
                    <RowActionsMenu
                      items={[
                        { label: 'Deactivate', icon: Ban, danger: true, hidden: w.isActive === false, onSelect: () => deactivate(w) },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </ErpDataTable>
      </Section>

      {canConfigure && (
        <WorkflowFormDrawer
          open={createOpen}
          onClose={() => onCreateOpenChange(false)}
          documentTypes={documentTypes}
          approverOptions={approverOptions}
          organizationId={organizationId}
          factoryId={factoryId}
        />
      )}
    </>
  );
}

function WorkflowFormDrawer({
  open, onClose, documentTypes, approverOptions, organizationId, factoryId,
}: {
  open: boolean;
  onClose: () => void;
  documentTypes: string[];
  approverOptions: ApproverOption[];
  organizationId?: string;
  factoryId?: string;
}) {
  const qc = useQueryClient();
  const initial = () => {
    const docType = documentTypes.includes('DESIGN') ? 'DESIGN' : documentTypes[0] ?? 'DESIGN';
    const role = roleOptionsForType(approverOptions, docType)[0]?.permission || 'approval.approve';
    return { documentType: docType, name: '', levels: [{ approverRole: role, slaHours: 24, approvalType: 'ANY' as const }] as LevelForm[] };
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setForm(initial()); setErrors({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    meta: { successMessage: 'Workflow created', successDescription: 'It replaces the previous workflow for this document type.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approval-workflows'] });
      onClose();
    },
  });

  const options = roleOptionsForType(approverOptions, form.documentType);
  const updateLevel = (index: number, patch: Partial<LevelForm>) => {
    setForm((f) => ({ ...f, levels: f.levels.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter a name, for example "Design two-step approval".';
    if (!factoryId) next.name = 'Select a factory in the header before creating a workflow.';
    form.levels.forEach((l, i) => {
      if (!l.slaHours || l.slaHours < 1) next[`sla${i}`] = 'SLA must be at least 1 hour.';
    });
    setErrors(next);
    if (Object.keys(next).length === 0) createMut.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={false}
      title="New approval workflow"
      description="Creating a workflow replaces the active one for that document type."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="workflow-form" loading={createMut.isPending}>Create workflow</Button>
        </>
      )}
    >
      <form id="workflow-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Document type" required>
            <ErpSelect
              value={form.documentType}
              onChange={(e) => {
                const docType = e.target.value;
                const role = roleOptionsForType(approverOptions, docType)[0]?.permission || 'approval.approve';
                setForm((f) => ({ ...f, documentType: docType, levels: f.levels.map((l) => ({ ...l, approverRole: role })) }));
              }}
            >
              {documentTypes.map((t) => <option key={t} value={t}>{documentTypeLabel(t)}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Workflow name" required error={errors.name}>
            <ErpInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Design two-step approval" />
          </Field>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold text-erp-text-primary">Approval levels</h3>
          <p className="mb-3 text-[13px] text-erp-text-muted">Each level must approve before the next one is asked. Up to five levels.</p>
          <ol className="space-y-3">
            {form.levels.map((level, index) => (
              <li key={index} className="rounded-lg border border-[var(--erp-border)] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-erp-text-primary">Level {index + 1}</span>
                  {form.levels.length > 1 && (
                    <IconButton
                      aria-label={`Remove level ${index + 1}`}
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, levels: f.levels.filter((_, i) => i !== index) }))}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Who approves" className="sm:col-span-2">
                    <ErpSelect value={level.approverRole} onChange={(e) => updateLevel(index, { approverRole: e.target.value })}>
                      {options.length === 0 && <option value={level.approverRole}>{level.approverRole}</option>}
                      {options.map((o) => <option key={o.permission} value={o.permission}>{o.label}</option>)}
                    </ErpSelect>
                  </Field>
                  <Field label="SLA (hours)" error={errors[`sla${index}`]}>
                    <ErpInput type="number" min={1} value={level.slaHours} onChange={(e) => updateLevel(index, { slaHours: Number(e.target.value) })} />
                  </Field>
                  <Field label="Needs">
                    <ErpSelect value={level.approvalType} onChange={(e) => updateLevel(index, { approvalType: e.target.value as 'ANY' | 'ALL' })}>
                      <option value="ANY">Any one</option>
                      <option value="ALL">Everyone</option>
                    </ErpSelect>
                  </Field>
                </div>
              </li>
            ))}
          </ol>
          {form.levels.length < 5 && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              icon={<Plus size={16} />}
              onClick={() => setForm((f) => ({
                ...f,
                levels: [...f.levels, { approverRole: options[0]?.permission || 'approval.approve', slaHours: 24, approvalType: 'ANY' }],
              }))}
            >
              Add level
            </Button>
          )}
        </div>
      </form>
    </Drawer>
  );
}
