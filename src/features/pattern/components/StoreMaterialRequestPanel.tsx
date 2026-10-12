import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus } from 'lucide-react';
import { inventoryApi } from '../../../services/manufacturing';
import {
  Badge, Button, ErpInput, ErpSelect, Field, Modal,
} from '../../../components/erp';
import type { MaterialMasterRequest } from '../../../types/api';

const UNITS = ['METERS', 'YARDS', 'PIECES', 'CONES', 'KG'] as const;

function materialSnapshot(r: MaterialMasterRequest) {
  const m = r.materialId;
  if (!m) return null;
  if (typeof m === 'string') return { _id: m, materialCode: r.proposedCode || '', name: r.name, unit: r.unit || 'METERS', category: r.category, unitCost: r.unitCost };
  return {
    _id: m._id,
    materialCode: m.materialCode,
    name: m.name,
    unit: m.unit || r.unit || 'METERS',
    category: m.category || r.category,
    unitCost: m.unitCost ?? r.unitCost ?? 0,
  };
}

/** "Not in the store list?" — ask the store keeper to add a fabric; approved items attach to the tech pack. */
export function StoreMaterialRequestPanel({
  designId,
  defaultName = '',
  category = 'FABRIC',
  readOnly,
  onApproved,
}: {
  designId: string;
  defaultName?: string;
  category?: string;
  readOnly?: boolean;
  onApproved?: (items: Array<{
    _id: string;
    materialCode: string;
    name: string;
    unit: string;
    category?: string;
    unitCost?: number;
  }>) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [proposedCode, setProposedCode] = useState('');
  const [unit, setUnit] = useState('METERS');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState('');
  const lastNotified = useRef('');

  const { data } = useQuery({
    queryKey: ['material-master-requests', designId],
    queryFn: () => inventoryApi.listMaterialMasterRequests({ designId, limit: 50 }).then((r) => r.items),
    enabled: !!designId,
    refetchInterval: (q) => ((q.state.data || []).some((r) => r.status === 'PENDING') ? 15000 : false),
  });
  const requests = data ?? [];
  const pending = requests.filter((r) => r.status === 'PENDING' && (r.category || 'FABRIC') === category);
  const rejected = requests.filter((r) => r.status === 'REJECTED' && (r.category || 'FABRIC') === category).slice(0, 3);
  const approved = useMemo(
    () => requests.filter((r) => r.status === 'APPROVED' && r.materialId && (r.category || 'FABRIC') === category),
    [requests, category],
  );

  useEffect(() => {
    const snaps = approved.map(materialSnapshot).filter(Boolean) as Array<{
      _id: string; materialCode: string; name: string; unit: string; category?: string; unitCost?: number;
    }>;
    const key = snaps.map((s) => s._id).sort().join(',');
    if (!key || key === lastNotified.current) return;
    lastNotified.current = key;
    onApproved?.(snaps);
    qc.invalidateQueries({ queryKey: ['pattern-material-options'] });
  }, [approved, onApproved, qc]);

  const create = useMutation({
    mutationFn: () => inventoryApi.createMaterialMasterRequest({
      name: name.trim(),
      proposedCode: proposedCode.trim() || undefined,
      category,
      unit,
      notes: notes.trim() || undefined,
      designId,
    }),
    meta: { successMessage: 'Request sent to the store', successDescription: 'It is added to this tech pack once they approve it.' },
    onSuccess: () => {
      setName(defaultName);
      setProposedCode('');
      setNotes('');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['material-master-requests', designId] });
    },
  });

  if (readOnly && !pending.length && !rejected.length) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Enter the fabric name so the store can find or create it.');
      return;
    }
    create.mutate();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--erp-border)] px-4 py-3 text-[13px]">
      {pending.map((r) => (
        <Badge key={r._id} tone="warning">Waiting on store · {r.name}{r.proposedCode ? ` (${r.proposedCode})` : ''}</Badge>
      ))}
      {rejected.map((r) => (
        <Badge key={r._id} tone="danger">Declined · {r.name}{r.reviewNotes ? ` — ${r.reviewNotes}` : ''}</Badge>
      ))}
      {!readOnly && (
        <>
          <span className="text-erp-text-muted">Fabric not in the store list?</span>
          <Button size="sm" variant="link" icon={<PackagePlus size={14} />} onClick={() => { setName((n) => n || defaultName); setNameError(''); setOpen(true); }}>
            Request it from the store
          </Button>
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Request a new fabric"
        description="The store keeper adds it to the material list. Once approved it appears on this tech pack."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="store-material-request" loading={create.isPending}>Send to store</Button>
          </>
        )}
      >
        <form id="store-material-request" className="space-y-4" onSubmit={submit} noValidate>
          <Field label="Fabric name" required error={nameError}>
            <ErpInput value={name} onChange={(e) => { setName(e.target.value); setNameError(''); }} placeholder="e.g. 180 GSM cotton jersey" invalid={!!nameError} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Suggested code" hint="Optional">
              <ErpInput value={proposedCode} onChange={(e) => setProposedCode(e.target.value)} />
            </Field>
            <Field label="Stock unit">
              <ErpSelect value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u.charAt(0) + u.slice(1).toLowerCase()}</option>)}
              </ErpSelect>
            </Field>
          </div>
          <Field label="Note for the store">
            <ErpInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="GSM, mill, colourway…" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
