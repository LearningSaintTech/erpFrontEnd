import { useEffect, useState } from 'react';
import { Button, Field, Modal, Textarea } from '../../../components/erp';
import type { FitAnalysis } from '../../../types/api';
import { FitAnalysisForm, emptyFitAnalysis } from '../FitAnalysisForm';
import { QcMeasurementForm, emptyQcMeasurements, type QcMeasurement } from '../QcMeasurementForm';
import { DEFAULT_QC_POINTS } from '../sampleUtils';

export type QcFitMode = 'qc-pass' | 'qc-fail' | 'fit-trial';

const TITLES: Record<QcFitMode, string> = {
  'qc-pass': 'Pass QC',
  'qc-fail': 'Fail QC',
  'fit-trial': 'Record fit session',
};

const DESCRIPTIONS: Record<QcFitMode, string> = {
  'qc-pass': 'Record the measurements you checked. The sample then moves on.',
  'qc-fail': 'Record what failed so the team can fix it.',
  'fit-trial': 'Record how the sample fits. Flag pattern corrections if they are needed.',
};

/** QC pass / fail measurement sheet, or fit-trial analysis, in one modal. */
export function SampleQcFitModal({
  mode,
  initialFit,
  loading,
  onClose,
  onSubmit,
}: {
  mode: QcFitMode | null;
  initialFit?: FitAnalysis;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: { comments: string; measurements?: QcMeasurement[]; fit?: FitAnalysis }) => void;
}) {
  const [measurements, setMeasurements] = useState<QcMeasurement[]>(emptyQcMeasurements(DEFAULT_QC_POINTS));
  const [fit, setFit] = useState<FitAnalysis>(emptyFitAnalysis());
  const [comments, setComments] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setMeasurements(emptyQcMeasurements(DEFAULT_QC_POINTS));
    setFit(initialFit || emptyFitAnalysis());
    setComments('');
    setTouched(false);
  }, [mode, initialFit]);

  const needsReason = mode === 'qc-fail';
  const reasonError = needsReason && touched && comments.trim().length < 3 ? 'Describe the defects (at least 3 characters).' : undefined;

  const submit = () => {
    setTouched(true);
    if (needsReason && comments.trim().length < 3) return;
    if (mode === 'fit-trial') onSubmit({ comments: fit.notes || comments, fit });
    else onSubmit({ comments, measurements });
  };

  return (
    <Modal
      open={!!mode}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={false}
      title={mode ? TITLES[mode] : ''}
      description={mode ? DESCRIPTIONS[mode] : undefined}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={mode === 'qc-fail' ? 'danger-solid' : 'primary'} loading={loading} onClick={submit}>
            {mode ? TITLES[mode] : 'Submit'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        {mode === 'fit-trial'
          ? <FitAnalysisForm value={fit} onChange={setFit} requireRevisionOption />
          : <QcMeasurementForm value={measurements} onChange={setMeasurements} />}
        {/* The fit form has its own "Fit notes" — a second free-text box there only confused people. */}
        {mode !== 'fit-trial' && (
          <Field label={needsReason ? 'Defects found' : 'Notes'} required={needsReason} error={reasonError}>
            <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} invalid={!!reasonError} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
