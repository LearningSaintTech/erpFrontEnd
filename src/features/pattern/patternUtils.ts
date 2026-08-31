import type { Design, PatternDevelopment, PatternVerificationEvidence } from '../../types/api';

export function designLabel(designId: PatternDevelopment['designId']) {
  if (!designId || typeof designId === 'string') return designId || '—';
  const d = designId as Design;
  return `${d.designCode} — ${d.title}`;
}

export function designIdOf(pd: PatternDevelopment) {
  return typeof pd.designId === 'string' ? pd.designId : pd.designId._id;
}

export function patternMasterIdOf(pm: PatternDevelopment['patternMasterId']) {
  if (!pm) return '';
  return typeof pm === 'string' ? pm : pm._id;
}

export function masterLabel(pm: PatternDevelopment['patternMasterId']) {
  if (!pm || typeof pm === 'string') return '—';
  return `${pm.firstName || ''} ${pm.lastName || ''}`.trim() || pm.email || '—';
}

export function statusLabel(status?: string) {
  return (status ?? '—').replace(/_/g, ' ');
}

export function verificationProgress(
  checks: { sizeChartVerified?: boolean; consumptionVerified?: boolean; sampleBomVerified?: boolean },
) {
  const flags = [checks.sizeChartVerified, checks.consumptionVerified, checks.sampleBomVerified];
  const done = flags.filter(Boolean).length;
  return { done, total: 3, percent: Math.round((done / 3) * 100) };
}

export function evidenceLabel(key: 'sizeChart' | 'consumption' | 'bom', evidence?: PatternVerificationEvidence) {
  if (!evidence) return 'Unknown';
  if (key === 'sizeChart') return evidence.hasSizeChart ? `Ready (${evidence.sizeChartRowCount} rows)` : 'Missing POM chart';
  if (key === 'consumption') return evidence.hasConsumption ? `Ready (${evidence.consumptionLineCount} lines)` : 'Missing fabric consumption';
  return evidence.hasBom ? `Ready (${evidence.bomLineCount} lines)` : 'Missing fabric or trims';
}

export function canVerifyFlag(
  key: 'sizeChartVerified' | 'consumptionVerified' | 'sampleBomVerified',
  evidence?: PatternVerificationEvidence,
) {
  if (!evidence) return false;
  if (key === 'sizeChartVerified') return evidence.hasSizeChart;
  if (key === 'consumptionVerified') return evidence.hasConsumption;
  return evidence.hasBom;
}
