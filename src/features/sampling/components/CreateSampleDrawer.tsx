import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sampleApi } from '../../../services/manufacturing';
import {
  Button, Drawer, ErpInput, ErpSearchSelect, ErpSelect, Field, InfoBanner,
} from '../../../components/erp';
import { SAMPLE_TYPE_LABELS, formatCost } from '../sampleUtils';
import { SAMPLE_TYPE_GUIDE } from '../sampleWorkflowUtils';

/** New sample for a released design whose pattern development is complete. */
export function CreateSampleDrawer({
  open,
  initialDesignId = '',
  onClose,
  onCreated,
}: {
  open: boolean;
  initialDesignId?: string;
  onClose: () => void;
  onCreated: (sampleId: string) => void;
}) {
  const qc = useQueryClient();
  const [designId, setDesignId] = useState('');
  const [sampleType, setSampleType] = useState('PROTOTYPE');
  const [laborHours, setLaborHours] = useState('4');
  const [laborRate, setLaborRate] = useState('150');
  const [designError, setDesignError] = useState('');

  useEffect(() => {
    if (open) {
      setDesignId(initialDesignId);
      setSampleType('PROTOTYPE');
      setLaborHours('4');
      setLaborRate('150');
      setDesignError('');
    }
  }, [open, initialDesignId]);

  const { data: eligibleDesigns = [], isLoading } = useQuery({
    queryKey: ['sample-eligible-designs'],
    queryFn: () => sampleApi.eligibleDesigns(),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () => sampleApi.create({
      designId,
      sampleType,
      laborHours: Number(laborHours) || 0,
      laborRate: Number(laborRate) || 0,
    }),
    meta: { successMessage: 'Sample created', successDescription: 'The pattern master adds fabric and trims next.' },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['samples'] });
      qc.invalidateQueries({ queryKey: ['sample-stats'] });
      qc.invalidateQueries({ queryKey: ['sample-eligible-designs'] });
      qc.invalidateQueries({ queryKey: ['approvals-pending'] });
      if (created?._id) onCreated(created._id);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!designId) {
      setDesignError('Choose the design to sample.');
      return;
    }
    create.mutate();
  };

  const labour = (Number(laborHours) || 0) * (Number(laborRate) || 0);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title="New sample"
      description="Only released designs with completed pattern development can be sampled. One active sample per design."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-sample-form" loading={create.isPending}>Create and open</Button>
        </>
      )}
    >
      <form id="create-sample-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Design" required error={designError} htmlFor="sample-design">
          <ErpSearchSelect
            id="sample-design"
            className="w-full"
            value={designId}
            loading={isLoading}
            placeholder="Select design…"
            searchPlaceholder="Search code or title…"
            emptyText="No designs are ready for sampling"
            options={eligibleDesigns.map((d) => ({ value: d._id, label: `${d.designCode} — ${d.title}`, keywords: `${d.designCode} ${d.title}` }))}
            onChange={(id) => { setDesignId(id); setDesignError(''); }}
          />
        </Field>
        {!isLoading && eligibleDesigns.length === 0 && (
          <InfoBanner inset={false} tone="muted">
            No designs are ready. A design needs completed pattern development and no active sample.
          </InfoBanner>
        )}
        <Field label="Sample type" hint={SAMPLE_TYPE_GUIDE[sampleType]}>
          <ErpSelect value={sampleType} onChange={(e) => setSampleType(e.target.value)}>
            {Object.entries(SAMPLE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </ErpSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Labour hours">
            <ErpInput type="number" min={0} className="tabular-nums" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} />
          </Field>
          <Field label="Rate per hour">
            <ErpInput type="number" min={0} className="tabular-nums" value={laborRate} onChange={(e) => setLaborRate(e.target.value)} />
          </Field>
        </div>
        <p className="text-[13px] text-erp-text-secondary">Estimated labour: <span className="font-medium tabular-nums">{formatCost(labour)}</span></p>
      </form>
    </Drawer>
  );
}
