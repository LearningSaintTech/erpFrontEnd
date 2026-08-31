import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../../services/manufacturing';
import type { MaterialMasterRequest } from '../../../types/api';

const label = 'mb-1 block text-[10px] font-medium text-erp-text-muted';
const input = 'w-full rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] px-2 py-1 text-[11px] disabled:opacity-60';

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
  const [error, setError] = useState('');
  const [sentMsg, setSentMsg] = useState('');
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
    onSuccess: (created) => {
      setError('');
      setSentMsg(`${created.requestNumber} sent to store. It will appear on this tech pack after they approve.`);
      setName(defaultName);
      setProposedCode('');
      setNotes('');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['material-master-requests', designId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (readOnly && !pending.length && !rejected.length && !approved.length) return null;

  return (
    <div className="mt-2 rounded border border-dashed border-[var(--erp-border)] p-2">
      <p className="text-[10px] text-erp-text-muted">
        Not in the store list? Ask the store keeper to add it. After they approve, it lands on this tech pack.
      </p>
      {sentMsg && <p className="mt-1 text-[10px] text-emerald-700">{sentMsg}</p>}
      {pending.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {pending.map((r) => (
            <li key={r._id} className="text-[10px] text-amber-800">
              Waiting on store · {r.requestNumber} · {r.name}
              {r.proposedCode ? ` (${r.proposedCode})` : ''}
            </li>
          ))}
        </ul>
      )}
      {rejected.map((r) => (
        <p key={r._id} className="mt-1 text-[10px] text-red-700">
          Declined · {r.name}{r.reviewNotes ? ` — ${r.reviewNotes}` : ''}
        </p>
      ))}
      {!readOnly && (
        open ? (
          <div className="mt-2 grid grid-cols-12 gap-2">
            <div className="col-span-5">
              <span className={label}>Fabric name</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 180 GSM cotton jersey" />
            </div>
            <div className="col-span-3">
              <span className={label}>Suggested code</span>
              <input className={input} value={proposedCode} onChange={(e) => setProposedCode(e.target.value)} placeholder="Optional" />
            </div>
            <div className="col-span-2">
              <span className={label}>Unit</span>
              <select className={input} value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-12">
              <span className={label}>Note for store</span>
              <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="GSM, mill, colourway…" />
            </div>
            {error && <p className="col-span-12 text-[10px] text-red-700">{error}</p>}
            <div className="col-span-12 flex gap-2">
              <button
                type="button"
                className="text-[10px] text-[var(--erp-accent)] disabled:opacity-50"
                disabled={!name.trim() || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? 'Sending…' : 'Send to store'}
              </button>
              <button type="button" className="text-[10px] text-erp-text-muted" onClick={() => { setOpen(false); setError(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="mt-1.5 text-[10px] text-[var(--erp-accent)]" onClick={() => { setOpen(true); setName((n) => n || defaultName); }}>
            Request from store
          </button>
        )
      )}
    </div>
  );
}
