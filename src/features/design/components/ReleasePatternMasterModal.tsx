import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, ErpSearchSelect, Field, InfoBanner, Modal } from '../../../components/erp';
import { patternApi } from '../../../services/manufacturing';
import type { ErpUser } from '../../../types/api';

function masterOptionLabel(u: ErpUser) {
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  if (name && u.email) return `${name} (${u.email})`;
  return name || u.email || 'Pattern master';
}

type Props = {
  open: boolean;
  designLabel?: string;
  loading?: boolean;
  onConfirm: (patternMasterId: string) => void;
  onCancel: () => void;
};

/** Release an approved design and hand it to a pattern master. */
export function ReleasePatternMasterModal({
  open,
  designLabel,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const [patternMasterId, setPatternMasterId] = useState('');
  const [touched, setTouched] = useState(false);

  const { data: masters = [], isLoading, isError } = useQuery({
    queryKey: ['pattern-masters'],
    queryFn: patternApi.listMasters,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setPatternMasterId('');
      setTouched(false);
    }
  }, [open]);

  // Only one pattern master at this factory: pick them so release is a single click.
  useEffect(() => {
    if (open && !patternMasterId && masters.length === 1) setPatternMasterId(String(masters[0]._id));
  }, [open, masters, patternMasterId]);

  const noMasters = !isLoading && masters.length === 0;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      title="Release to pattern"
      description={designLabel
        ? `${designLabel} will be locked and assigned to a pattern master for pattern, marker and grading.`
        : 'The design will be locked and assigned to a pattern master.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button
            loading={loading}
            disabled={isLoading || noMasters}
            onClick={() => {
              setTouched(true);
              if (patternMasterId) onConfirm(patternMasterId);
            }}
          >
            Release and assign
          </Button>
        </>
      )}
    >
      <Field
        label="Pattern master"
        required
        htmlFor="release-pattern-master"
        error={touched && !patternMasterId ? 'Choose who will develop the pattern.' : undefined}
      >
        <ErpSearchSelect
          id="release-pattern-master"
          className="w-full"
          value={patternMasterId}
          disabled={loading || isLoading}
          loading={isLoading}
          placeholder={isLoading ? 'Loading pattern masters…' : 'Select pattern master…'}
          searchPlaceholder="Search pattern master…"
          emptyText="No pattern masters match"
          onChange={(id) => setPatternMasterId(id)}
          options={masters.map((u) => ({
            value: u._id,
            label: masterOptionLabel(u),
            keywords: `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`,
          }))}
        />
      </Field>
      {noMasters && (
        <InfoBanner inset={false} tone="warn" className="mt-3">
          No one in this factory has the Pattern Master role yet. Assign it in Users first.
        </InfoBanner>
      )}
      {isError && (
        <InfoBanner inset={false} tone="danger" className="mt-3">Could not load pattern masters. Try again.</InfoBanner>
      )}
    </Modal>
  );
}
