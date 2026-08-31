import type { Sample } from '../../types/api';
import { WORKFLOW_STEPS, sampleNeedsFitTrial } from './sampleUtils';

export type SampleWorkflowStepId =
  | 'brief'
  | 'materials'
  | 'cutting'
  | 'stitching'
  | 'qc'
  | 'fit'
  | 'approval';

/** Store-handoff segment aligned with backend SAMPLE_MATERIAL → reserve → issue → CUTTING. */
export const SAMPLING_HANDOFF_FLOW: { id: string; label: string; who: string }[] = [
  { id: 'submit', label: 'Submit RM', who: 'Pattern master' },
  { id: 'approve', label: 'SAMPLE_MATERIAL approval', who: 'Merchandiser / manager' },
  { id: 'reserve', label: 'Reserve stock', who: 'Store keeper' },
  { id: 'issue', label: 'Issue to cutting', who: 'Store keeper' },
  { id: 'cutting', label: 'Cutting → stitching', who: 'Pattern master / sampling team' },
  { id: 'qc', label: 'QC inspection', who: 'QC inspector' },
];

export const SAMPLE_WORKFLOW_STEPS: { id: SampleWorkflowStepId; label: string; hint: string }[] = [
  { id: 'brief', label: 'Tech pack', hint: 'Style brief, sample type, merchandising notes' },
  { id: 'materials', label: 'Fabric & trims', hint: 'Procure fabric, buttons, labels, thread' },
  { id: 'cutting', label: 'Cutting', hint: 'Marker lay — cut main, lining, interlining' },
  { id: 'stitching', label: 'Stitching', hint: 'Sample tailor — seam sequence & SPI' },
  { id: 'qc', label: 'QC inspection', hint: 'Measurements, stitch quality, symmetry' },
  { id: 'fit', label: 'Fit trial', hint: 'Model / dress form — comfort & appearance' },
  { id: 'approval', label: 'Buyer approval', hint: 'Customer sign-off for bulk production' },
];

const STEP_ORDER: SampleWorkflowStepId[] = [
  'brief', 'materials', 'cutting', 'stitching', 'qc', 'fit', 'approval',
];

const STATUS_TO_STEP: Record<string, SampleWorkflowStepId> = {
  CREATED: 'materials',
  REVISION_REQUESTED: 'materials',
  MATERIAL_REQUEST_PENDING: 'materials',
  MATERIAL_REQUEST_APPROVED: 'materials',
  MATERIAL_RESERVED: 'materials',
  CUTTING: 'cutting',
  IN_PROGRESS: 'stitching',
  COMPLETED: 'stitching',
  QC_PENDING: 'qc',
  QC_FAILED: 'qc',
  FIT_TRIAL: 'fit',
  PENDING_APPROVAL: 'approval',
  QC_PASSED: 'approval',
  APPROVED: 'approval',
  REJECTED: 'approval',
};

export function inferSampleStep(sample?: Sample): SampleWorkflowStepId {
  if (!sample?.status) return 'brief';
  return STATUS_TO_STEP[sample.status] ?? 'brief';
}

export function isStepDone(stepId: SampleWorkflowStepId, status: string, sampleType?: string): boolean {
  if (['APPROVED', 'REJECTED'].includes(status)) return true;
  const current = inferSampleStep({ status, sampleType } as Sample);
  const currentIdx = STEP_ORDER.indexOf(current);
  const stepIdx = STEP_ORDER.indexOf(stepId);
  if (stepIdx < currentIdx) return true;
  if (stepId === 'fit' && !sampleNeedsFitTrial(sampleType) && current === 'approval') return true;
  if (stepId === 'fit' && status === 'PENDING_APPROVAL' && !sampleNeedsFitTrial(sampleType)) return true;
  return false;
}

export function stepStatus(
  stepId: SampleWorkflowStepId,
  current: SampleWorkflowStepId,
  sampleStatus: string,
  sampleType?: string,
): 'done' | 'current' | 'upcoming' | 'skipped' {
  if (stepId === 'fit' && !sampleNeedsFitTrial(sampleType)) return 'skipped';
  if (['APPROVED', 'REJECTED'].includes(sampleStatus)) return 'done';
  if (stepId === current) return 'current';
  if (isStepDone(stepId, sampleStatus, sampleType)) return 'done';
  return 'upcoming';
}

export function queueSampleProgress(status: string, sampleType?: string) {
  const terminal = ['APPROVED', 'REJECTED'].includes(status);
  const stepId = inferSampleStep({ status, sampleType } as Sample);
  const idx = STEP_ORDER.indexOf(stepId);
  const total = sampleNeedsFitTrial(sampleType) ? STEP_ORDER.length : STEP_ORDER.length - 1;
  let done = terminal ? total : idx + 1;
  if (!sampleNeedsFitTrial(sampleType) && idx > STEP_ORDER.indexOf('fit')) {
    done = Math.max(1, done - 1);
  }
  const stepMeta = SAMPLE_WORKFLOW_STEPS[idx];
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    label: terminal ? 'Bulk ready' : (stepMeta?.label ?? 'Tech pack'),
  };
}

export const SAMPLE_TYPE_GUIDE: Record<string, string> = {
  PROTOTYPE: 'First garment from design — checks feasibility and construction',
  FIT: 'Base-size fit session — measurements & pattern corrections',
  SIZE_SET: 'All sizes (S–XL) to verify grading across the size chart',
  SALESMAN: 'Presentation sample for buyers before order confirmation',
  PHOTO: 'Catalog / website / marketing shoot sample',
  PP: 'Pre-production standard — bulk fabric, trims, and methods',
  TOP: 'Top of production — first pieces off the line for buyer sign-off',
  SHIPMENT: 'Reference sample retained for what was shipped to customer',
};

export const ALL_SAMPLE_STATUSES = [
  ...WORKFLOW_STEPS.flatMap((s) => s.statuses),
  'APPROVED',
  'REJECTED',
];

export { sampleNeedsFitTrial };
