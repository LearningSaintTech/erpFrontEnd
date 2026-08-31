import type { PatternDevelopment, PatternTechPack } from '../../types/api';

export type WorkflowStepId = 'techpack' | 'marker' | 'grading' | 'verify';

export const WORKFLOW_STEPS: { id: WorkflowStepId; label: string; hint: string }[] = [
  { id: 'techpack', label: 'Tech pack', hint: 'POM chart, fabric technicals, trims, construction' },
  { id: 'marker', label: 'Marker', hint: 'Nest length, pieces, cuttable width, efficiency' },
  { id: 'grading', label: 'Base size', hint: 'Mother pattern size against the POM chart' },
  { id: 'verify', label: 'Sign-off', hint: 'Confirm spec, consumption, and sample BOM' },
];

export function calcMetersPerGarment(
  markerLength: number,
  piecesPerMarker: number,
  wastagePercent = 0,
): number | null {
  if (!markerLength || !piecesPerMarker || piecesPerMarker <= 0) return null;
  const base = markerLength / piecesPerMarker;
  return Math.round(base * (1 + wastagePercent / 100) * 1000) / 1000;
}

export function isMarkerStepComplete(pd?: PatternDevelopment) {
  return !!(pd?.marker?.length && pd?.calculatedConsumption?.metersPerGarment);
}

export function isGradingStepComplete(pd?: PatternDevelopment) {
  return !!pd?.grading?.baseSize;
}

export function isVerifyStepComplete(pd?: PatternDevelopment) {
  return pd?.status === 'COMPLETED';
}

export function isStepComplete(
  stepId: WorkflowStepId,
  pd?: PatternDevelopment,
  techPack?: PatternTechPack,
): boolean {
  switch (stepId) {
    case 'techpack':
      return !!(techPack?.evidence?.hasSizeChart && techPack?.evidence?.hasConsumption && techPack?.evidence?.hasBom);
    case 'marker':
      return isMarkerStepComplete(pd);
    case 'grading':
      return isGradingStepComplete(pd);
    case 'verify':
      return isVerifyStepComplete(pd);
    default:
      return false;
  }
}

export function canAccessStep(
  stepId: WorkflowStepId,
  pd?: PatternDevelopment,
  techPack?: PatternTechPack,
): boolean {
  if (stepId === 'techpack') return true;
  if (stepId === 'marker') return isStepComplete('techpack', pd, techPack);
  if (stepId === 'grading') return isMarkerStepComplete(pd);
  if (stepId === 'verify') return isGradingStepComplete(pd);
  return false;
}

export function validateMarkerForm(form: {
  markerLength: string;
  piecesPerMarker: string;
}): string | null {
  const length = Number(form.markerLength);
  const pieces = Number(form.piecesPerMarker);
  if (!form.markerLength || Number.isNaN(length) || length <= 0) {
    return 'Marker length (m) is required and must be greater than 0';
  }
  if (!form.piecesPerMarker || Number.isNaN(pieces) || pieces < 1) {
    return 'Pieces per marker is required (minimum 1)';
  }
  if (calcMetersPerGarment(length, pieces) == null) {
    return 'Cannot calculate consumption — check marker length and pieces per marker';
  }
  return null;
}

export function canCompletePattern(pd?: PatternDevelopment, techPack?: PatternTechPack): string | null {
  if (!isStepComplete('techpack', pd, techPack)) {
    return 'Tech pack must include POM chart, fabric consumption, and trims (sample BOM)';
  }
  if (!isMarkerStepComplete(pd)) {
    return 'Save marker dimensions and consumption before completing';
  }
  if (!isGradingStepComplete(pd)) {
    return 'Save grading plan (base size) before completing';
  }
  return null;
}

/** Pick the step the user should work on next. */
export function inferWorkflowStep(
  pd?: PatternDevelopment,
  techPack?: PatternTechPack,
): WorkflowStepId {
  if (pd?.status === 'COMPLETED') return 'verify';
  if (!isStepComplete('techpack', pd, techPack)) return 'techpack';
  if (!isMarkerStepComplete(pd)) return 'marker';
  if (!isGradingStepComplete(pd)) return 'grading';
  return 'verify';
}

export function stepStatus(
  stepId: WorkflowStepId,
  current: WorkflowStepId,
  pd?: PatternDevelopment,
  techPack?: PatternTechPack,
): 'done' | 'current' | 'upcoming' {
  if (stepId === current) return 'current';
  if (isStepComplete(stepId, pd, techPack)) return 'done';

  const order: WorkflowStepId[] = ['techpack', 'marker', 'grading', 'verify'];
  const ci = order.indexOf(current);
  const si = order.indexOf(stepId);
  return si < ci ? 'done' : 'upcoming';
}

export function workflowStageLabel(pd: PatternDevelopment, techPack?: PatternTechPack): string {
  if (pd.status === 'COMPLETED') return 'Complete';
  const step = inferWorkflowStep(pd, techPack);
  return WORKFLOW_STEPS.find((s) => s.id === step)?.label ?? 'In progress';
}

export function workflowProgress(pd: PatternDevelopment, techPack?: PatternTechPack) {
  const steps: WorkflowStepId[] = ['techpack', 'marker', 'grading', 'verify'];
  const done = steps.filter((id) => isStepComplete(id, pd, techPack)).length;
  return { done, total: 4, percent: Math.round((done / 4) * 100) };
}

/** Progress for queue rows (no tech-pack payload). */
export function queueProgress(pd: PatternDevelopment) {
  if (pd.status === 'COMPLETED') {
    return { done: 4, total: 4, percent: 100, label: 'Complete' };
  }
  const verifyDone = !!(pd.sizeChartVerified && pd.consumptionVerified && pd.sampleBomVerified);
  const techPackReviewed = isMarkerStepComplete(pd) || isGradingStepComplete(pd) || verifyDone;
  const stepsDone = [
    techPackReviewed,
    isMarkerStepComplete(pd),
    isGradingStepComplete(pd),
    verifyDone,
  ].filter(Boolean).length;
  const next = WORKFLOW_STEPS[Math.min(stepsDone, 3)];
  return {
    done: stepsDone,
    total: 4,
    percent: Math.round((stepsDone / 4) * 100),
    label: next?.label ?? 'Tech pack',
  };
}

export const FIT_AREAS = [
  'CHEST', 'WAIST', 'HIP', 'SHOULDER', 'SLEEVE', 'ARMHOLE', 'NECK',
  'INSEAM', 'OUTSEAM', 'HEM', 'COLLAR', 'CUFF', 'GENERAL',
] as const;

export const FIT_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

export const FIT_RESULTS = ['PASS', 'MINOR_ISSUES', 'MAJOR_ISSUES', 'FAIL'] as const;

export const FIT_MODES = ['MANNEQUIN', 'LIVE_MODEL', 'FLAT_MEASURE'] as const;
