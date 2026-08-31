import type { Design, Material, Sample } from '../../types/api';

export const SAMPLE_TYPE_LABELS: Record<string, string> = {
  PROTOTYPE: 'Proto sample',
  FIT: 'Fit sample',
  SIZE_SET: 'Size set',
  SALESMAN: 'Salesman sample',
  PHOTO: 'Photo sample',
  PP: 'Pre-production (PP)',
  TOP: 'TOP sample',
  SHIPMENT: 'Shipment sample',
};

export const SAMPLE_STATUS_LABELS: Record<string, string> = {
  CREATED: 'Tech pack received',
  REVISION_REQUESTED: 'Revision requested',
  MATERIAL_REQUEST_PENDING: 'Trims approval pending',
  MATERIAL_REQUEST_APPROVED: 'Trims approved',
  MATERIAL_RESERVED: 'Fabric reserved',
  CUTTING: 'Cutting',
  IN_PROGRESS: 'Sample stitching',
  QC_PENDING: 'Quality inspection',
  QC_FAILED: 'QC failed',
  FIT_TRIAL: 'Fit trial',
  PENDING_APPROVAL: 'Buyer review',
  QC_PASSED: 'QC passed',
  APPROVED: 'Buyer approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Stitching complete',
};

/** Seven industry workflow steps (post pattern-development). */
export const WORKFLOW_STEPS: { id: string; label: string; statuses: string[] }[] = [
  { id: 'brief', label: 'Tech pack', statuses: [] },
  { id: 'materials', label: 'Fabric & trims', statuses: ['CREATED', 'REVISION_REQUESTED', 'MATERIAL_REQUEST_PENDING', 'MATERIAL_REQUEST_APPROVED', 'MATERIAL_RESERVED'] },
  { id: 'cutting', label: 'Cutting', statuses: ['CUTTING'] },
  { id: 'stitching', label: 'Stitching', statuses: ['IN_PROGRESS', 'COMPLETED'] },
  { id: 'qc', label: 'QC inspection', statuses: ['QC_PENDING', 'QC_FAILED'] },
  { id: 'fit', label: 'Fit trial', statuses: ['FIT_TRIAL'] },
  { id: 'approval', label: 'Buyer approval', statuses: ['PENDING_APPROVAL', 'QC_PASSED'] },
];

export const WORKFLOW_PHASES = [
  ...WORKFLOW_STEPS,
  { id: 'done', label: 'Bulk ready', statuses: ['APPROVED', 'REJECTED'] },
];

export const SAMPLE_TYPES_NEEDING_FIT_TRIAL = [
  'PROTOTYPE', 'FIT', 'SIZE_SET', 'SALESMAN', 'PHOTO',
];

export function sampleNeedsFitTrial(sampleType?: string) {
  return !!sampleType && SAMPLE_TYPES_NEEDING_FIT_TRIAL.includes(sampleType);
}

export function designLabel(designId: Sample['designId']) {
  if (!designId || typeof designId === 'string') return designId || '—';
  const d = designId;
  return `${d.designCode} — ${d.title}`;
}

export function designIdOf(sample: Sample | { designId: Sample['designId'] }) {
  return typeof sample.designId === 'string' ? sample.designId : sample.designId._id;
}

export function materialLabel(materialId: NonNullable<Sample['materialRequirements']>[number]['materialId']) {
  if (!materialId || typeof materialId === 'string') return materialId || '—';
  const m = materialId as Material;
  return m.materialCode || m.name || '—';
}

export function materialIdOf(materialId: string | { _id?: string } | null | undefined): string {
  if (!materialId) return '';
  if (typeof materialId === 'string') return materialId;
  return materialId._id != null ? String(materialId._id) : '';
}

export function buildMaterialOptions(
  catalog: Material[],
  lines: NonNullable<Sample['materialRequirements']>,
): Material[] {
  const map = new Map<string, Material>();
  for (const m of catalog) {
    if (m?._id) map.set(String(m._id), m);
  }
  for (const line of lines) {
    const id = materialIdOf(line.materialId);
    if (!id || map.has(id)) continue;
    const raw = line.materialId;
    if (raw && typeof raw === 'object' && 'materialCode' in raw) {
      map.set(id, raw as Material);
    }
  }
  return [...map.values()].sort((a, b) => a.materialCode.localeCompare(b.materialCode));
}

export const SAMPLE_MATERIAL_UNITS = ['METERS', 'PIECES', 'YARDS', 'KG', 'ROLLS', 'CONE'];

export function statusLabel(status: string) {
  return SAMPLE_STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

export function sampleTypeLabel(type?: string) {
  if (!type) return '—';
  return SAMPLE_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

export function workflowPhaseIndex(status: string) {
  const stepIdx = WORKFLOW_STEPS.findIndex((p) => p.statuses.includes(status));
  if (stepIdx >= 0) return stepIdx;
  if (['APPROVED', 'REJECTED'].includes(status)) return WORKFLOW_STEPS.length;
  return 0;
}

export function workflowProgress(status: string) {
  const terminal = ['APPROVED', 'REJECTED'].includes(status);
  const idx = workflowPhaseIndex(status);
  const total = WORKFLOW_STEPS.length;
  const done = terminal ? total : Math.min(idx + 1, total);
  const phase = terminal ? 'Bulk ready' : (WORKFLOW_STEPS[idx]?.label ?? 'Tech pack');
  const percent = Math.round((done / total) * 100);
  return { phase, index: idx, percent };
}

export function canEditMaterials(status: string) {
  return ['CREATED', 'REVISION_REQUESTED'].includes(status);
}

export function formatCost(value?: number) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export const DEFAULT_QC_POINTS = ['Chest', 'Waist', 'Hip', 'Sleeve', 'Collar', 'Length'];

export const SEWING_SEQUENCE_HINT = [
  'Join shoulder',
  'Attach sleeve',
  'Attach collar',
  'Side seam',
  'Hem',
  'Buttons / trims',
  'Final pressing',
];
