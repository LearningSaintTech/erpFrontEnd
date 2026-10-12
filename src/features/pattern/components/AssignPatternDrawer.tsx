import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { designApi, patternApi } from '../../../services/manufacturing';
import {
  Button, Drawer, ErpSearchSelect, Field, InfoBanner,
} from '../../../components/erp';
import type { Design } from '../../../types/api';
import { designIdOf } from '../patternUtils';

/** Assign a released design to a pattern master (design manager). */
export function AssignPatternDrawer({
  open,
  initialDesignId = '',
  onClose,
  onAssigned,
}: {
  open: boolean;
  initialDesignId?: string;
  onClose: () => void;
  onAssigned: (designId: string) => void;
}) {
  const qc = useQueryClient();
  const [designId, setDesignId] = useState('');
  const [masterId, setMasterId] = useState('');
  const [errors, setErrors] = useState<{ design?: string; master?: string }>({});

  useEffect(() => {
    if (open) {
      setDesignId(initialDesignId);
      setMasterId('');
      setErrors({});
    }
  }, [open, initialDesignId]);

  const { data: allPatterns = [] } = useQuery({
    queryKey: ['pattern-developments-all-ids'],
    queryFn: () => patternApi.list(),
    enabled: open,
  });
  const { data: designs = [], isLoading: designsLoading } = useQuery({
    queryKey: ['designs-released'],
    queryFn: () => designApi.list({ status: 'RELEASED' }),
    enabled: open,
  });
  const { data: masters = [], isLoading: mastersLoading } = useQuery({
    queryKey: ['pattern-masters'],
    queryFn: patternApi.listMasters,
    enabled: open,
  });

  const assigned = new Set(allPatterns.map(designIdOf));
  const unassigned = designs.filter((d: Design) => !assigned.has(d._id));

  const assign = useMutation({
    mutationFn: () => patternApi.assign({ designId, patternMasterId: masterId }),
    meta: { successMessage: 'Pattern master assigned', successDescription: 'Opening the pattern workspace.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pattern-developments'] });
      qc.invalidateQueries({ queryKey: ['pattern-developments-all-ids'] });
      qc.invalidateQueries({ queryKey: ['pattern-stats'] });
      qc.invalidateQueries({ queryKey: ['pattern-development', designId] });
      onAssigned(designId);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!designId) next.design = 'Choose a released design.';
    if (!masterId) next.master = 'Choose who will develop the pattern.';
    setErrors(next);
    if (!next.design && !next.master) assign.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      title="Assign pattern master"
      description="Only released designs without a pattern master are listed."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assign-pattern-form" loading={assign.isPending}>Assign and open</Button>
        </>
      )}
    >
      <form id="assign-pattern-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Released design" required error={errors.design} htmlFor="assign-design">
          <ErpSearchSelect
            id="assign-design"
            className="w-full"
            value={designId}
            loading={designsLoading}
            placeholder="Select design…"
            searchPlaceholder="Search code, title or style #…"
            emptyText="No released designs are waiting"
            options={unassigned.map((d: Design) => ({
              value: d._id,
              label: `${d.designCode} — ${d.title}`,
              keywords: `${d.designCode} ${d.title} ${d.styleNumber || ''}`,
            }))}
            onChange={(id) => { setDesignId(id); setErrors((x) => ({ ...x, design: undefined })); }}
          />
        </Field>
        <Field label="Pattern master" required error={errors.master} htmlFor="assign-master">
          <ErpSearchSelect
            id="assign-master"
            className="w-full"
            value={masterId}
            loading={mastersLoading}
            placeholder="Select pattern master…"
            searchPlaceholder="Search name or email…"
            options={masters.map((u) => ({
              value: u._id,
              label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Pattern master',
              keywords: `${u.firstName} ${u.lastName} ${u.email || ''}`,
            }))}
            onChange={(id) => { setMasterId(id); setErrors((x) => ({ ...x, master: undefined })); }}
          />
        </Field>
        {!designsLoading && unassigned.length === 0 && (
          <InfoBanner inset={false} tone="muted">
            Every released design already has a pattern master. Release more designs from the design library.
          </InfoBanner>
        )}
      </form>
    </Drawer>
  );
}
