import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button, Drawer, ErpSearchSelect, Field, IconButton, InfoBanner, toast, type ErpSearchOption,
} from '../../components/erp';
import api from '../../services/api';
import { inventoryApi } from '../../services/manufacturing';
import { purchaseApi } from '../../services/operations';
import type { Material, PurchaseRequisition } from '../../types/api';
import { unitLabel } from '../inventory/inventoryUtils';
import { formatCurrency, materialIdOf } from './purchaseUtils';
import { lineQty, UnitInput, useInvalidatePurchase } from './purchaseShared';

type Line = { key: number; materialId: string; qty: string; cost: string };

let lineSeq = 1;
const emptyLine = (): Line => ({ key: lineSeq++, materialId: '', qty: '', cost: '' });

type PrLinesBody = { lines: { materialId: string; requiredQty: number; unit?: string; estimatedUnitCost?: number }[] };
/** PATCH a DRAFT / REJECTED requisition's lines (requester revising after "Request changes"). */
const updatePR = (id: string, body: PrLinesBody) =>
  api.patch<{ data: PurchaseRequisition }>(`/purchase-requisitions/${id}`, body).then((r) => r.data.data);

const linesFromPr = (pr: PurchaseRequisition): Line[] => (pr.lines || []).map((l) => ({
  key: lineSeq++,
  materialId: materialIdOf(l),
  qty: String(lineQty(l)),
  cost: l.estimatedUnitCost != null ? String(l.estimatedUnitCost) : '',
}));

export type EditablePr = PurchaseRequisition & { revisionComments?: string; rejectionComments?: string };

/**
 * "New purchase requisition" — multi-line editor.
 * Footer: Save as draft · Create & submit (the common case).
 * With `editing`, revises a DRAFT / REJECTED requisition: Save changes · Save & resubmit.
 */
export function PrFormDrawer({
  open, onClose, onCreated, editing,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (pr: PurchaseRequisition) => void;
  editing?: EditablePr | null;
}) {
  const invalidate = useInvalidatePurchase();
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitAfter, setSubmitAfter] = useState(true);

  useEffect(() => {
    if (open) {
      setLines(editing?.lines?.length ? linesFromPr(editing) : [emptyLine()]);
      setErrors({});
    }
  }, [open, editing]);

  const { data: materials = [], isLoading: materialsLoading, isError: materialsError } = useQuery({
    queryKey: ['materials'],
    queryFn: () => inventoryApi.listMaterials(),
    enabled: open,
  });
  const byId = useMemo(() => new Map(materials.map((m: Material) => [m._id, m])), [materials]);
  const options: ErpSearchOption[] = useMemo(
    () => materials.map((m: Material) => ({ value: m._id, label: `${m.materialCode} — ${m.name}`, keywords: m.category })),
    [materials],
  );

  const create = useMutation({
    mutationFn: async (submit: boolean) => {
      const body: PrLinesBody = {
        lines: lines.map((l) => {
          const m = byId.get(l.materialId);
          return {
            materialId: l.materialId,
            requiredQty: Number(l.qty),
            unit: m?.unit,
            estimatedUnitCost: l.cost === '' ? (m?.unitCost ?? 0) : Number(l.cost),
          };
        }),
      };
      const pr = editing ? await updatePR(editing._id, body) : await purchaseApi.createPR(body);
      return submit ? purchaseApi.submitPR(pr._id) : pr;
    },
    onSuccess: (pr, submitted) => {
      invalidate();
      toast.success(submitted ? `${pr.prNumber} sent for approval` : `${pr.prNumber} ${editing ? 'saved' : 'saved as draft'}`, {
        description: submitted ? 'The factory admin will approve or send it back.' : 'Submit it from the list when you are ready.',
      });
      onCreated?.(pr);
      onClose();
    },
  });

  const setLine = (key: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[`${key}.${k === 'materialId' ? 'material' : k}`]);
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    const seen = new Set<string>();
    lines.forEach((l) => {
      if (!l.materialId) next[`${l.key}.material`] = 'Choose a material.';
      else if (seen.has(l.materialId)) next[`${l.key}.material`] = 'This material is already on another line — change that line\'s quantity instead.';
      seen.add(l.materialId);
      const q = Number(l.qty);
      if (!l.qty || !Number.isFinite(q) || q <= 0) next[`${l.key}.qty`] = 'Enter a quantity above 0.';
      if (l.cost !== '' && (!Number.isFinite(Number(l.cost)) || Number(l.cost) < 0)) next[`${l.key}.cost`] = 'Enter 0 or more.';
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const go = (submitNow: boolean) => {
    setSubmitAfter(submitNow);
    if (validate()) create.mutate(submitNow);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(true);
  };

  const total = lines.reduce((sum, l) => {
    const m = byId.get(l.materialId);
    const cost = l.cost === '' ? (m?.unitCost ?? 0) : Number(l.cost) || 0;
    return sum + (Number(l.qty) || 0) * cost;
  }, 0);
  const ready = lines.length > 0 && lines.every((l) => l.materialId && Number(l.qty) > 0);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={false}
      title={editing ? `Edit ${editing.prNumber}` : 'New purchase requisition'}
      description={editing
        ? 'Change the materials or quantities, then resubmit it for approval.'
        : 'List the materials you need. The factory admin approves it before a payment is made.'}
      footer={(
        <>
          <span className="mr-auto hidden text-[13px] text-erp-text-muted sm:inline">
            Estimated total <span className="erp-tabular font-semibold text-erp-text-primary">{formatCurrency(total)}</span>
          </span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="secondary"
            disabled={!ready || create.isPending}
            loading={create.isPending && !submitAfter}
            onClick={() => go(false)}
          >
            {editing ? 'Save changes' : 'Save as draft'}
          </Button>
          <Button
            disabled={!ready || create.isPending}
            loading={create.isPending && submitAfter}
            onClick={() => go(true)}
          >
            {editing ? 'Save & resubmit' : <>Create &amp; submit</>}
          </Button>
        </>
      )}
    >
      <form id="pr-form" onSubmit={submit} noValidate className="space-y-4">
        {editing?.status === 'DRAFT' && editing.revisionComments && (
          <InfoBanner inset={false} tone="warn" title="Changes requested">{editing.revisionComments}</InfoBanner>
        )}
        {editing?.status === 'REJECTED' && editing.rejectionComments && (
          <InfoBanner inset={false} tone="danger" title="Rejected">{editing.rejectionComments}</InfoBanner>
        )}
        {materialsError && (
          <InfoBanner inset={false} tone="danger">Could not load materials. Check your factory access and try again.</InfoBanner>
        )}
        {!materialsLoading && !materialsError && materials.length === 0 && (
          <InfoBanner inset={false} tone="warn">
            No materials exist in this factory yet.
            <Link to="/inventory?tab=materials" className="font-medium text-[var(--erp-accent)] hover:underline">Add materials in Inventory</Link>
          </InfoBanner>
        )}

        <div className="space-y-3">
          {lines.map((l, idx) => {
            const m = byId.get(l.materialId);
            return (
              <div key={l.key} className="rounded-lg border border-[var(--erp-border)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-erp-text-muted">Line {idx + 1}</span>
                  <IconButton
                    size="sm"
                    aria-label={`Remove line ${idx + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_150px]">
                  <Field label="Material" required error={errors[`${l.key}.material`]}>
                    <ErpSearchSelect
                      className="w-full"
                      value={l.materialId}
                      onChange={(v) => {
                        const mat = byId.get(v);
                        setLine(l.key, { materialId: v, cost: mat ? String(mat.unitCost ?? 0) : '' });
                      }}
                      options={options}
                      loading={materialsLoading}
                      placeholder="Search code or name…"
                      searchPlaceholder="Type to search materials…"
                    />
                  </Field>
                  <Field label="Quantity" required error={errors[`${l.key}.qty`]}>
                    <UnitInput
                      min={0}
                      step="any"
                      unit={m ? unitLabel(m.unit) : undefined}
                      value={l.qty}
                      onChange={(e) => setLine(l.key, { qty: e.target.value })}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Est. unit cost" error={errors[`${l.key}.cost`]}>
                    <UnitInput
                      min={0}
                      step="0.01"
                      unit="₹"
                      value={l.cost}
                      onChange={(e) => setLine(l.key, { cost: e.target.value })}
                      placeholder="0"
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => setLines((ls) => [...ls, emptyLine()])}
        >
          Add another material
        </Button>
        {!editing && (
          <p className="text-[13px] text-erp-text-muted">
            <strong className="font-medium text-erp-text-secondary">Create &amp; submit</strong> sends it for approval straight away.
            Save as draft if you still need to check quantities.
          </p>
        )}
      </form>
    </Drawer>
  );
}
