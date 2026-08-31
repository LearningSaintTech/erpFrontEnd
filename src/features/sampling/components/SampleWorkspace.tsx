import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock, Package, Scissors, Shirt, Truck, X } from 'lucide-react';
import { inventoryApi, sampleApi } from '../../../services/manufacturing';
import { useAuth } from '../../../app/providers/AuthProvider';
import {
  ErpButton, ErpCard, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../../components/erp';
import { AlertBanner } from '../../../components/AlertBanner';
import { ApprovalsHint } from '../../../components/ApprovalsHint';
import { SuccessBanner } from '../../users/SuccessBanner';
import { ConfirmDialog } from '../../users/ConfirmDialog';
import { CommentPrompt } from '../../approvals/components/CommentPrompt';
import { toErrorMessage } from '../../../utils/errors';
import type { FitAnalysis, Material, Sample } from '../../../types/api';
import {
  canEditSampleWorkflow,
  canAdvanceSampleFloor,
  canApproveSample,
  hasSamplingUpdate,
  samplePatternMasterId,
} from '../samplingPermissions';
import { FitAnalysisForm, emptyFitAnalysis } from '../FitAnalysisForm';
import {
  canEditMaterials,
  designIdOf,
  designLabel,
  formatCost,
  materialIdOf,
  materialLabel,
  buildMaterialOptions,
  SAMPLE_MATERIAL_UNITS,
  sampleTypeLabel,
  statusLabel,
  DEFAULT_QC_POINTS,
  SEWING_SEQUENCE_HINT,
} from '../sampleUtils';
import type { SampleWorkflowStepId } from '../sampleWorkflowUtils';
import { inferSampleStep, SAMPLING_HANDOFF_FLOW, SAMPLE_TYPE_GUIDE, sampleNeedsFitTrial } from '../sampleWorkflowUtils';
import { QcMeasurementForm, emptyQcMeasurements, type QcMeasurement } from '../QcMeasurementForm';
import { SampleWorkflowStepper } from './SampleWorkflowStepper';
import {
  getSampleActions, type SampleAction, sampleWaitingHint, sampleStepConfirmMessage, sampleWorkflowSuccessMessage,
} from '../sampleNextActions';
import { SampleNextActionBar } from './SampleNextActionBar';
import { SampleStepGuidance } from './SampleStepGuidance';

const fieldLabel = 'mb-1 block text-[10px] font-medium text-erp-text-muted';
type MatLine = NonNullable<Sample['materialRequirements']>[number];

type CommentAction = {
  step: 'reject-material' | 'qc-fail' | 'reject' | 'revision';
  title: string;
};

export function SampleWorkspace({
  sampleId,
  onClose,
  onUpdated,
}: {
  sampleId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const qc = useQueryClient();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canApprove = canApproveSample(permissions, isSuperAdmin);
  const canInventory = permissions.includes('*') || permissions.includes('inventory.update');
  const canQc = permissions.includes('*') || permissions.includes('quality.update');

  const [step, setStep] = useState<SampleWorkflowStepId>('brief');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [matLines, setMatLines] = useState<MatLine[]>([]);
  const [laborHours, setLaborHours] = useState('');
  const [laborRate, setLaborRate] = useState('');
  const [confirmStep, setConfirmStep] = useState<{ step: string; label: string; message: string } | null>(null);
  const [commentAction, setCommentAction] = useState<CommentAction | null>(null);
  const [fitQcOpen, setFitQcOpen] = useState<'qc-pass' | 'qc-fail' | 'fit-trial' | null>(null);
  const [fitAnalysis, setFitAnalysis] = useState<FitAnalysis>(emptyFitAnalysis());
  const [fitQcComments, setFitQcComments] = useState('');
  const [qcMeasurements, setQcMeasurements] = useState<QcMeasurement[]>(emptyQcMeasurements(DEFAULT_QC_POINTS));
  const hydratedRef = useRef('');

  const { data: sample, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['sample', sampleId],
    queryFn: () => sampleApi.get(sampleId),
    enabled: !!sampleId,
  });

  const patternMasterId = sample ? samplePatternMasterId(sample) : undefined;
  const canEdit = sample
    ? canEditSampleWorkflow(permissions, user?._id, patternMasterId, isSuperAdmin)
    : false;
  const canAdvanceFloor = sample
    ? canAdvanceSampleFloor(permissions, user?._id, patternMasterId, isSuperAdmin)
    : false;

  useEffect(() => {
    if (!sample) return;
    const key = `${sampleId}:${sample.status}:${sample.updatedAt ?? ''}`;
    if (hydratedRef.current === key) return;
    hydratedRef.current = key;
    setMatLines((sample.materialRequirements || []).map((m) => ({
      ...m,
      materialId: materialIdOf(m.materialId),
    })));
    setLaborHours(sample.laborHours != null ? String(sample.laborHours) : '');
    setLaborRate(sample.laborRate != null ? String(sample.laborRate) : '');
    setStep(inferSampleStep(sample));
  }, [sample, sampleId]);

  const { data: materials = [], isLoading: materialsLoading, isError: materialsError } = useQuery({
    queryKey: ['sample-material-options'],
    queryFn: () => sampleApi.materialOptions(),
    enabled: !!sample,
    staleTime: 60_000,
  });

  const materialOptions = useMemo(
    () => buildMaterialOptions(materials, matLines),
    [materials, matLines],
  );

  const invalidate = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['sample', sampleId] }),
      qc.invalidateQueries({ queryKey: ['samples'] }),
      qc.invalidateQueries({ queryKey: ['sample-stats'] }),
      qc.invalidateQueries({ queryKey: ['approvals-pending'] }),
      qc.invalidateQueries({ queryKey: ['inventory-balances'] }),
      qc.invalidateQueries({ queryKey: ['inventory-availability'] }),
      qc.invalidateQueries({ queryKey: ['inventory-stats'] }),
      qc.invalidateQueries({ queryKey: ['material-avail'] }),
      qc.invalidateQueries({ queryKey: ['pattern-developments'] }),
    ]);
    onUpdated?.();
  }, [qc, sampleId, onUpdated]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const saveMaterials = useMutation({
    mutationFn: () => sampleApi.updateMaterials(sampleId, {
      materialRequirements: matLines.map((l) => ({
        materialId: materialIdOf(l.materialId),
        requiredQty: l.requiredQty,
        unit: l.unit || 'PIECES',
      })),
      laborHours: laborHours ? Number(laborHours) : undefined,
      laborRate: laborRate ? Number(laborRate) : undefined,
    }),
    onSuccess: async () => {
      await invalidate();
      showSuccess('Materials and labor saved');
    },
    onError: (e: Error) => setError(e.message),
  });

  const refreshMaterials = useMutation({
    mutationFn: () => sampleApi.refreshMaterials(sampleId),
    onSuccess: async (updated) => {
      setMatLines((updated.materialRequirements || []).map((m) => ({
        ...m,
        materialId: materialIdOf(m.materialId),
      })));
      await invalidate();
      showSuccess('Materials loaded from design BOM');
    },
    onError: (e: Error) => setError(e.message),
  });

  const workflow = useMutation({
    mutationFn: ({ step: wfStep, comments, fit, measurements }: {
      step: string;
      comments?: string;
      fit?: FitAnalysis;
      measurements?: QcMeasurement[];
    }) => {
      switch (wfStep) {
        case 'submit-material': return sampleApi.submitMaterialRequest(sampleId);
        case 'approve-material': return sampleApi.approveMaterialRequest(sampleId);
        case 'reject-material': return sampleApi.rejectMaterialRequest(sampleId, comments);
        case 'reserve': return sampleApi.reserveMaterials(sampleId);
        case 'issue': return sampleApi.issueMaterials(sampleId);
        case 'complete-cutting': return sampleApi.completeCutting(sampleId);
        case 'complete': return sampleApi.complete(sampleId);
        case 'qc-pass': return sampleApi.qcPass(sampleId, { comments, qcMeasurements: measurements });
        case 'qc-fail': return sampleApi.qcFail(sampleId, { comments: comments!, qcMeasurements: measurements });
        case 'fit-trial': return sampleApi.completeFitTrial(sampleId, { comments, fitAnalysis: fit });
        case 'approve': return sampleApi.approve(sampleId);
        case 'reject': return sampleApi.reject(sampleId, comments);
        case 'revision': return sampleApi.revision(sampleId, comments);
        case 'reopen': return sampleApi.reopen(sampleId);
        default: throw new Error('Unknown step');
      }
    },
    onSuccess: async (_data, vars) => {
      setConfirmStep(null);
      setCommentAction(null);
      setFitQcOpen(null);
      setFitAnalysis(emptyFitAnalysis());
      setFitQcComments('');
      await invalidate();
      showSuccess(sampleWorkflowSuccessMessage(vars.step));
    },
    onError: (e: Error) => setError(e.message),
  });

  const previewStatus = sample?.status ?? '';
  const storeLines = sample?.materialRequirements || [];
  const storeMatIds = useMemo(
    () => [...new Set(storeLines.map((l) => materialIdOf(l.materialId)).filter(Boolean))],
    [storeLines],
  );
  const availQueries = useQueries({
    queries: storeMatIds.map((id) => ({
      queryKey: ['inventory-availability', id],
      queryFn: () => inventoryApi.availability(id),
      enabled: !!sample && !!id && ['MATERIAL_REQUEST_APPROVED', 'MATERIAL_RESERVED'].includes(previewStatus),
      staleTime: 30_000,
    })),
  });
  const availByMat = useMemo(() => {
    const map = new Map<string, number>();
    storeMatIds.forEach((id, i) => {
      map.set(id, availQueries[i]?.data?.available ?? 0);
    });
    return map;
  }, [storeMatIds, availQueries]);

  const addMaterialLine = () => {
    const first = materialOptions[0];
    if (!first) return;
    setMatLines((lines) => [...lines, {
      materialId: first._id,
      requiredQty: 1,
      unit: first.unit || 'PIECES',
    }]);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-8 text-center text-[11px] text-erp-text-muted">
        Loading sample workspace…
      </div>
    );
  }

  if (isError || !sample) {
    return (
      <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4">
        <AlertBanner message={toErrorMessage(queryError) || 'Sample not found'} onDismiss={onClose} />
        <ErpButton variant="secondary" className="mt-3 !px-3 !py-1.5 text-[11px]" onClick={onClose}>
          <ArrowLeft size={12} className="mr-1 inline" />Back to queue
        </ErpButton>
      </div>
    );
  }

  const designId = designIdOf(sample);
  const status = sample.status;
  const activeStep = inferSampleStep(sample);
  const needsFit = sampleNeedsFitTrial(sample.sampleType);
  const materialsEditable = canEdit && canEditMaterials(status);
  const canSubmitRm = canEdit && ['CREATED', 'REVISION_REQUESTED'].includes(status) && matLines.length > 0;
  const nextActions = getSampleActions({
    status,
    sampleType: sample.sampleType,
    canEdit,
    canAdvanceFloor,
    canApprove,
    canInventory,
    canQc,
    materialCount: matLines.length,
  });

  const openConfirm = (step: string, label: string) => {
    setConfirmStep({ step, label, message: sampleStepConfirmMessage(step) });
  };

  const handoffActiveId = status === 'MATERIAL_REQUEST_PENDING' ? 'approve'
    : status === 'MATERIAL_REQUEST_APPROVED' ? 'reserve'
      : status === 'MATERIAL_RESERVED' ? 'issue'
        : ['CUTTING', 'IN_PROGRESS'].includes(status) ? 'cutting'
          : status === 'QC_PENDING' ? 'qc'
            : null;

  const reserveShortfall = status === 'MATERIAL_REQUEST_APPROVED' && storeLines.some((l) => {
    const id = materialIdOf(l.materialId);
    const need = (l.requiredQty ?? 0) - (l.reservedQty ?? 0);
    return need > 0 && (availByMat.get(id) ?? 0) < need;
  });

  const goToActiveStep = () => setStep(activeStep);

  const handleActionConfirm = (action: SampleAction) => {
    if (!action.step) return;
    setConfirmStep({
      step: action.step,
      label: action.confirmMessage || action.label,
      message: action.confirmMessage || sampleStepConfirmMessage(action.step),
    });
  };

  const handleActionComment = (action: SampleAction) => {
    if (!action.step) return;
    const stepKey = action.step as CommentAction['step'];
    setCommentAction({ step: stepKey, title: action.commentTitle || action.label });
  };

  const handleActionModal = (action: SampleAction) => {
    if (action.id === 'qc-pass') {
      setFitQcOpen('qc-pass');
      setQcMeasurements(emptyQcMeasurements(DEFAULT_QC_POINTS));
      setFitQcComments('');
      return;
    }
    if (action.id === 'qc-fail') {
      setFitQcOpen('qc-fail');
      setQcMeasurements(emptyQcMeasurements(DEFAULT_QC_POINTS));
      setFitQcComments('');
      return;
    }
    if (action.id === 'fit-trial') {
      setFitQcOpen('fit-trial');
      setFitAnalysis(sample.fitAnalysis || emptyFitAnalysis());
      setFitQcComments('');
    }
  };

  return (
    <div className="sample-workspace rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--erp-border)] p-3">
        <div>
          <button
            type="button"
            onClick={onClose}
            className="mb-1 flex items-center gap-1 text-[10px] text-erp-text-muted hover:text-erp-text-primary"
          >
            <ArrowLeft size={12} /> Back to queue
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-sm font-semibold text-erp-text-primary">{sample.sampleCode}</h2>
            {sample.iteration && sample.iteration > 1 && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700">v{sample.iteration}</span>
            )}
            <ErpStatusBadge status={status} label={statusLabel(status)} />
            <span className="text-[10px] text-erp-text-muted">{sampleTypeLabel(sample.sampleType)}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-erp-text-muted">
            <Link to={`/designs/${designId}/edit`} className="text-[var(--erp-accent)] hover:underline">
              {designLabel(sample.designId)}
            </Link>
            {sample.totalCost != null && sample.totalCost > 0 && (
              <span className="ml-2">· Sample cost {formatCost(sample.totalCost)}</span>
            )}
            <span className="ml-2">
              <Link to="/approvals" className="text-[var(--erp-accent)]">Approvals</Link>
              {' · '}
              <Link to="/inventory" className="text-[var(--erp-accent)]">Inventory</Link>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => refetch()}>
            Refresh
          </ErpButton>
          <button type="button" onClick={onClose} className="rounded p-1 text-erp-text-muted hover:bg-[var(--erp-surface-muted)]" aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {!canEdit && !canAdvanceFloor && !canApprove && hasSamplingUpdate(permissions, isSuperAdmin) && (
        <div className="border-b border-[var(--erp-border)] bg-amber-500/5 px-3 py-2 text-[10px] text-amber-800">
          View only — fabric & RM stay with the assigned pattern master; cutting onward is pattern or sampling team.
        </div>
      )}

      <SampleNextActionBar
        actions={nextActions}
        loading={workflow.isPending || saveMaterials.isPending}
        onConfirm={handleActionConfirm}
        onComment={handleActionComment}
        onModal={handleActionModal}
      />

      {handoffActiveId && (
        <div className="border-b border-[var(--erp-border)] bg-[var(--erp-surface-muted)]/30 px-3 py-2">
          <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-erp-text-muted">RM handoff flow</p>
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            {SAMPLING_HANDOFF_FLOW.map((h, i) => (
              <span key={h.id} className="flex items-center gap-1">
                {i > 0 && <ArrowRight size={10} className="text-erp-text-muted" />}
                <span
                  className={`rounded px-1 py-0.5 ${h.id === handoffActiveId ? 'bg-[var(--erp-accent-muted)] font-medium' : 'text-erp-text-muted'}`}
                  title={h.who}
                >
                  {h.label}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {nextActions.length === 0 && !['APPROVED', 'REJECTED'].includes(status) && (() => {
        const hint = sampleWaitingHint(status);
        return (
          <div className="border-b border-[var(--erp-border)] bg-[var(--erp-surface-muted)]/30 px-3 py-2 text-[10px] text-erp-text-muted">
            <p>
              <strong className="text-erp-text-primary">Next:</strong> {hint.action}
            </p>
            <p className="mt-0.5">
              Waiting on: <strong className="text-erp-text-primary">{hint.who}</strong>
              {' '}· Status: {statusLabel(status)}
            </p>
          </div>
        );
      })()}

      <div className="p-3">
        <SampleWorkflowStepper
          current={step}
          sampleStatus={status}
          sampleType={sample.sampleType}
          onSelect={setStep}
        />

        {step === 'brief' && (
          <ErpCard className="!p-3">
            <SampleStepGuidance
              stepId="brief"
              status={status}
              sampleType={sample.sampleType}
              activeStep={activeStep}
              onGoActive={goToActiveStep}
            />
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Tech pack & sample brief</h3>
            <p className="mt-1 text-[10px] text-erp-text-muted">
              {SAMPLE_TYPE_GUIDE[sample.sampleType || 'PROTOTYPE'] || 'Merchandising review — sample type and labor.'}
            </p>
            <p className="mt-2 text-[10px] text-erp-text-muted">
              Tech pack on file:{' '}
              <Link to={`/designs/${designId}/edit`} className="text-[var(--erp-accent)] hover:underline">
                open design editor
              </Link>
              {' '}(sketch, measurements, fabric, trims, size chart).
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-[11px]">
              <div>
                <dt className="text-erp-text-muted">Type</dt>
                <dd className="font-medium">{sampleTypeLabel(sample.sampleType)}</dd>
              </div>
              <div>
                <dt className="text-erp-text-muted">Labor</dt>
                <dd>{sample.laborHours ?? 0} hrs @ {formatCost(sample.laborRate)}/hr</dd>
              </div>
              {sample.comments && (
                <div className="sm:col-span-2">
                  <dt className="text-erp-text-muted">Comments</dt>
                  <dd>{sample.comments}</dd>
                </div>
              )}
              {sample.revisionComments && (
                <div className="sm:col-span-2 rounded border border-amber-500/30 bg-amber-500/5 p-2">
                  <dt className="text-[10px] font-medium text-amber-800">Revision requested</dt>
                  <dd className="text-amber-900">{sample.revisionComments}</dd>
                </div>
              )}
            </dl>
            {canEdit && status === 'REVISION_REQUESTED' && (
              <div className="mt-3">
                <ErpButton
                  variant="secondary"
                  className="!px-3 !py-1.5 text-[11px]"
                  disabled={workflow.isPending}
                  onClick={() => openConfirm('reopen', 'Reopen sample for rework?')}
                >
                  Reopen for rework
                </ErpButton>
              </div>
            )}
            {canEdit && ['CREATED', 'REVISION_REQUESTED'].includes(status) && (
              <div className="mt-3">
                <ErpButton className="!px-3 !py-1.5 text-[11px]" onClick={() => setStep('materials')}>
                  Continue to fabric & trims →
                </ErpButton>
              </div>
            )}
          </ErpCard>
        )}

        {step === 'materials' && (
          <ErpCard className="!p-3">
            <SampleStepGuidance
              stepId="materials"
              status={status}
              sampleType={sample.sampleType}
              activeStep={activeStep}
              onGoActive={goToActiveStep}
            />
            <div className="mb-2 flex items-center gap-2">
              <Package size={14} className="text-[var(--erp-accent)]" />
              <h3 className="text-[11px] font-semibold text-erp-text-primary">Fabric & trims procurement</h3>
            </div>
            {materialsEditable ? (
              <>
                <p className="mb-2 text-[10px] text-erp-text-muted">
                  Collect fabric, buttons, zippers, labels, thread, interlining — substitutes OK if bulk trims pending.
                </p>
                {matLines.length === 0 && (
                  <div className="mb-2 rounded border border-dashed border-[var(--erp-border)] p-2 text-[10px] text-erp-text-muted">
                    No material lines yet. Pull fabric and trims from the design BOM, or add lines manually.
                    <div className="mt-2">
                      <ErpButton
                        variant="secondary"
                        className="!px-3 !py-1.5 text-[11px]"
                        disabled={refreshMaterials.isPending}
                        onClick={() => refreshMaterials.mutate()}
                      >
                        Load from design BOM
                      </ErpButton>
                    </div>
                  </div>
                )}
                {materialsLoading && (
                  <p className="mb-2 text-[10px] text-erp-text-muted">Loading material catalog…</p>
                )}
                {materialsError && (
                  <p className="mb-2 text-[10px] text-red-600">Could not load materials — refresh the page or check permissions.</p>
                )}
                {!materialsLoading && materialOptions.length === 0 && matLines.length > 0 && (
                  <p className="mb-2 text-[10px] text-amber-700">
                    Material catalog is empty. Seed inventory or add materials in Inventory before changing lines.
                  </p>
                )}
                <div className="space-y-2">
                  {matLines.map((m, i) => {
                    const selectedId = materialIdOf(m.materialId);
                    return (
                    <div key={`${selectedId || 'line'}-${i}`} className="flex flex-wrap items-center gap-2">
                      <ErpSelect
                        className="min-w-[200px] flex-1 !py-1 text-[10px]"
                        value={selectedId}
                        disabled={materialOptions.length === 0}
                        onChange={(e) => {
                          const mat = materialOptions.find((x: Material) => String(x._id) === e.target.value);
                          setMatLines((lines) => lines.map((l, j) => j === i ? {
                            ...l,
                            materialId: e.target.value,
                            unit: mat?.unit || l.unit,
                          } : l));
                        }}
                      >
                        <option value="" disabled>Select material…</option>
                        {selectedId && !materialOptions.some((mat) => String(mat._id) === selectedId) && (
                          <option value={selectedId}>{materialLabel(m.materialId)}</option>
                        )}
                        {materialOptions.map((mat: Material) => (
                          <option key={mat._id} value={String(mat._id)}>{mat.materialCode} — {mat.name}</option>
                        ))}
                      </ErpSelect>
                      <ErpInput
                        type="number"
                        min={0}
                        step="any"
                        className="w-20 !py-1 text-[10px]"
                        value={m.requiredQty}
                        onChange={(e) => setMatLines((lines) => lines.map((l, j) => j === i ? { ...l, requiredQty: Number(e.target.value) } : l))}
                      />
                      <ErpSelect
                        className="w-24 !py-1 text-[10px]"
                        value={m.unit || 'PIECES'}
                        onChange={(e) => setMatLines((lines) => lines.map((l, j) => j === i ? { ...l, unit: e.target.value } : l))}
                      >
                        {SAMPLE_MATERIAL_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </ErpSelect>
                      <ErpButton variant="secondary" className="!px-2 !py-0.5 text-[10px]" onClick={() => setMatLines((lines) => lines.filter((_, j) => j !== i))}>
                        Remove
                      </ErpButton>
                    </div>
                  );})}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="w-20">
                    <label className={fieldLabel}>Labor hrs</label>
                    <ErpInput className="!py-1 text-[10px]" type="number" min={0} value={laborHours} onChange={(e) => setLaborHours(e.target.value)} />
                  </div>
                  <div className="w-24">
                    <label className={fieldLabel}>Rate/hr</label>
                    <ErpInput className="!py-1 text-[10px]" type="number" min={0} value={laborRate} onChange={(e) => setLaborRate(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ErpButton className="!px-3 !py-1.5 text-[11px]" disabled={matLines.length === 0 || saveMaterials.isPending} onClick={() => saveMaterials.mutate()}>
                    Save materials
                  </ErpButton>
                  <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={addMaterialLine} disabled={materialOptions.length === 0}>
                    Add line
                  </ErpButton>
                  {canSubmitRm && (
                    <ErpButton
                      className="!px-3 !py-1.5 text-[11px]"
                      disabled={workflow.isPending || saveMaterials.isPending}
                      onClick={() => openConfirm('submit-material', 'Submit RM request?')}
                    >
                      Submit RM request
                    </ErpButton>
                  )}
                </div>
              </>
            ) : (
              <MaterialSummary lines={sample.materialRequirements} />
            )}
            {status === 'MATERIAL_REQUEST_PENDING' && !canApprove && (
              <div className="mt-3">
                <ApprovalsHint label="SAMPLE_MATERIAL approval" />
                <p className="mt-1 text-[10px] text-erp-text-muted">
                  Approvers: <Link to="/approvals" className="text-[var(--erp-accent)]">Approvals → Inbox</Link>
                </p>
              </div>
            )}
            {canApprove && status === 'MATERIAL_REQUEST_PENDING' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ErpButton className="!px-3 !py-1.5 text-[11px]" onClick={() => openConfirm('approve-material', 'Approve RM request?')}>
                  Approve RM
                </ErpButton>
                <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={() => setCommentAction({ step: 'reject-material', title: 'Reject material request' })}>
                  Reject RM
                </ErpButton>
              </div>
            )}
            {canInventory && status === 'MATERIAL_REQUEST_APPROVED' && (
              <div className="mt-3 rounded border border-[var(--erp-accent)]/30 bg-[var(--erp-accent-muted)]/10 p-2">
                <p className="mb-2 text-[10px] font-medium text-erp-text-primary">Store keeper: reserve stock</p>
                <MaterialSummary lines={sample.materialRequirements} className="mb-2" />
                {reserveShortfall && (
                  <p className="mb-2 text-[10px] text-amber-800">
                    Insufficient available stock for one or more lines — receive via{' '}
                    <Link to="/purchase" className="text-[var(--erp-accent)]">Purchase → GRN → QC</Link>
                    {' '}or check <Link to="/inventory" className="text-[var(--erp-accent)]">Inventory</Link>.
                  </p>
                )}
                <ErpButton
                  className="!px-3 !py-1.5 text-[11px]"
                  disabled={reserveShortfall || workflow.isPending}
                  onClick={() => openConfirm('reserve', 'Reserve stock?')}
                >
                  <Truck size={12} className="mr-1 inline" />Reserve stock
                </ErpButton>
              </div>
            )}
            {status === 'MATERIAL_REQUEST_APPROVED' && !canInventory && (
              <div className="mt-3 rounded border border-dashed border-[var(--erp-border)] p-2 text-[10px] text-erp-text-muted">
                Trims approved. <strong className="text-erp-text-primary">Store keeper</strong> must reserve, then issue to cutting.
                <Link to="/inventory" className="ml-1 text-[var(--erp-accent)]">Inventory →</Link>
              </div>
            )}
            {canInventory && status === 'MATERIAL_RESERVED' && (
              <div className="mt-3 rounded border border-[var(--erp-border)] p-2">
                <p className="mb-2 text-[10px] font-medium text-erp-text-primary">Store keeper: issue to cutting</p>
                <MaterialSummary lines={sample.materialRequirements} className="mb-2" />
                <ErpButton
                  variant="secondary"
                  className="!px-3 !py-1.5 text-[11px]"
                  disabled={workflow.isPending}
                  onClick={() => openConfirm('issue', 'Issue to cutting?')}
                >
                  Issue to cutting → CUTTING
                </ErpButton>
              </div>
            )}
          </ErpCard>
        )}

        {step === 'cutting' && (
          <ErpCard className="!p-3">
            <SampleStepGuidance
              stepId="cutting"
              status={status}
              sampleType={sample.sampleType}
              activeStep={activeStep}
              onGoActive={goToActiveStep}
            />
            <div className="mb-2 flex items-center gap-2">
              <Scissors size={14} className="text-[var(--erp-accent)]" />
              <h3 className="text-[11px] font-semibold text-erp-text-primary">Fabric cutting</h3>
            </div>
            <p className="text-[10px] text-erp-text-muted">
              Cutting master lays marker — front, back, sleeve, collar, cuff — and bundles pieces for the sample tailor.
            </p>
            <MaterialSummary lines={sample.materialRequirements} className="mt-3" />
            {canAdvanceFloor && status === 'CUTTING' && (
              <ErpButton
                className="mt-3 !px-3 !py-1.5 text-[11px]"
                onClick={() => openConfirm('complete-cutting', 'Complete cutting?')}
              >
                Complete cutting → stitching
              </ErpButton>
            )}
            {status === 'CUTTING' && !canAdvanceFloor && (
              <p className="mt-3 text-[10px] text-erp-text-muted">
                Sign in as <strong className="text-erp-text-primary">sampling@demo.local</strong> or the assigned pattern master,
                then click <strong className="text-erp-text-primary">Complete cutting → stitching</strong> at the top of this sample.
              </p>
            )}
          </ErpCard>
        )}

        {step === 'stitching' && (
          <ErpCard className="!p-3">
            <SampleStepGuidance
              stepId="stitching"
              status={status}
              sampleType={sample.sampleType}
              activeStep={activeStep}
              onGoActive={goToActiveStep}
            />
            <div className="mb-2 flex items-center gap-2">
              <Shirt size={14} className="text-[var(--erp-accent)]" />
              <h3 className="text-[11px] font-semibold text-erp-text-primary">Sample tailor — stitching</h3>
            </div>
            <p className="mb-2 text-[10px] text-erp-text-muted">
              Sewing sequence: {SEWING_SEQUENCE_HINT.join(' → ')}.
            </p>
            <MaterialSummary lines={sample.materialRequirements} className="mt-1" />
            {canAdvanceFloor && status === 'IN_PROGRESS' && (
              <ErpButton
                className="mt-3 !px-3 !py-1.5 text-[11px]"
                onClick={() => openConfirm('complete', 'Complete stitching?')}
              >
                Complete stitching → QC
              </ErpButton>
            )}
            {status === 'IN_PROGRESS' && !canAdvanceFloor && (
              <p className="mt-3 text-[10px] text-erp-text-muted">Waiting for pattern master or sampling team to complete stitching.</p>
            )}
          </ErpCard>
        )}

        {step === 'qc' && (
          <ErpCard className="!p-3">
            <SampleStepGuidance
              stepId="qc"
              status={status}
              sampleType={sample.sampleType}
              activeStep={activeStep}
              onGoActive={goToActiveStep}
            />
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Quality inspection</h3>
            <p className="mt-1 text-[10px] text-erp-text-muted">
              QC inspector checks measurements, stitch quality, symmetry, labels, and fabric defects.
              Completing QC here or in Quality advances the sample
              {needsFit ? ' to fit trial' : ' to buyer review'}.
            </p>
            {(() => {
              const insp = sample.qcInspectionId;
              if (!insp || typeof insp === 'string') return null;
              return (
                <p className="mt-2 text-[10px] text-erp-text-muted">
                  Inspection <span className="font-mono">{insp.inspectionNumber}</span>
                  {insp.status ? ` · ${insp.status.replace(/_/g, ' ')}` : ''}
                  {' · '}
                  <Link to="/quality/inspections" className="text-[var(--erp-accent)]">Open Quality →</Link>
                </p>
              );
            })()}
            {status === 'QC_PENDING' && !canQc && (
              <p className="mt-3 text-[10px] text-erp-text-muted">
                Waiting on QC. Sign in as <strong className="text-erp-text-primary">qc@demo.local</strong>
                {' '}and complete the sampling inspection in{' '}
                <Link to="/quality/inspections" className="text-[var(--erp-accent)]">Quality</Link>
                , or Pass / Fail QC on this sample.
              </p>
            )}
            {sample.qcMeasurements && sample.qcMeasurements.length > 0 && (
              <div className="mt-2 overflow-x-auto rounded border border-[var(--erp-border)] p-2 text-[10px]">
                <table className="w-full min-w-[360px]">
                  <thead>
                    <tr className="text-left text-erp-text-muted">
                      <th className="pr-2">Point</th>
                      <th className="pr-2">Required</th>
                      <th className="pr-2">Actual</th>
                      <th>Pass</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sample.qcMeasurements.map((m, i) => (
                      <tr key={i}>
                        <td className="pr-2 font-medium">{m.point}</td>
                        <td className="pr-2">{m.required || '—'}</td>
                        <td className="pr-2">{m.actual || '—'}</td>
                        <td>{m.pass === false ? 'Fail' : 'Pass'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canQc && status === 'QC_PENDING' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ErpButton className="!px-3 !py-1.5 text-[11px]" onClick={() => {
                  setFitQcOpen('qc-pass');
                  setQcMeasurements(emptyQcMeasurements(DEFAULT_QC_POINTS));
                  setFitQcComments('');
                }}>
                  Pass QC {needsFit ? '→ fit trial' : '→ buyer review'}
                </ErpButton>
                <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={() => {
                  setFitQcOpen('qc-fail');
                  setQcMeasurements(emptyQcMeasurements(DEFAULT_QC_POINTS));
                  setFitQcComments('');
                }}>
                  Fail QC
                </ErpButton>
              </div>
            )}
            {status === 'QC_FAILED' && canApprove && (
              <ErpButton
                variant="secondary"
                className="mt-3 !px-3 !py-1.5 text-[11px]"
                onClick={() => setCommentAction({ step: 'revision', title: 'Request revised sample after QC fail' })}
              >
                Request revision
              </ErpButton>
            )}
          </ErpCard>
        )}

        {step === 'fit' && (
          <ErpCard className="!p-3">
            <SampleStepGuidance
              stepId="fit"
              status={status}
              sampleType={sample.sampleType}
              activeStep={activeStep}
              onGoActive={goToActiveStep}
            />
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Fit trial</h3>
            <p className="mt-1 text-[10px] text-erp-text-muted">
              Evaluate on live model, dress form, or with customer rep — comfort, appearance, ease of movement.
            </p>
            {!needsFit && (
              <p className="mt-2 text-[10px] text-erp-text-muted">
                {sampleTypeLabel(sample.sampleType)} samples skip fit trial — proceed to buyer approval after QC.
              </p>
            )}
            {sample.fitAnalysis?.overallResult && (
              <div className="mt-2 rounded border border-[var(--erp-border)] p-2 text-[10px]">
                <p>Result: <strong>{sample.fitAnalysis.overallResult.replace(/_/g, ' ')}</strong></p>
                {sample.fitAnalysis.patternRevisionRequired && (
                  <p className="mt-1 text-amber-700">
                    Pattern correction required —{' '}
                    <Link to={`/pattern?designId=${designId}`} className="text-[var(--erp-accent)] hover:underline">
                      open pattern workspace
                    </Link>
                  </p>
                )}
              </div>
            )}
            {canAdvanceFloor && status === 'FIT_TRIAL' && (
              <ErpButton
                className="mt-3 !px-3 !py-1.5 text-[11px]"
                onClick={() => {
                  setFitQcOpen('fit-trial');
                  setFitAnalysis(sample.fitAnalysis || emptyFitAnalysis());
                  setFitQcComments('');
                }}
              >
                Record fit session → buyer review
              </ErpButton>
            )}
          </ErpCard>
        )}

        {step === 'approval' && (
          <ErpCard className="!p-3">
            <SampleStepGuidance
              stepId="approval"
              status={status}
              sampleType={sample.sampleType}
              activeStep={activeStep}
              onGoActive={goToActiveStep}
            />
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Buyer / customer approval</h3>
            <p className="mt-1 text-[10px] text-erp-text-muted">
              Buyer may approve, request modifications, or reject — revisions loop back to tech pack & materials.
            </p>
            {status === 'APPROVED' && (
              <div className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px] text-emerald-800">
                Sample approved — proceed to{' '}
                <Link to="/products/skus" className="font-medium text-[var(--erp-accent)] hover:underline">SKU workspace</Link>
                {' '}or{' '}
                <Link to={`/designs/${designId}/edit`} className="font-medium text-[var(--erp-accent)] hover:underline">design SKU tab</Link>.
              </div>
            )}
            {status === 'PENDING_APPROVAL' && !canApprove && (
              <div className="mt-3"><ApprovalsHint label="Final approval" /></div>
            )}
            {canApprove && status === 'PENDING_APPROVAL' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ErpButton className="!px-3 !py-1.5 text-[11px]" onClick={() => openConfirm('approve', 'Approve sample?')}>
                  Approve sample
                </ErpButton>
                <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={() => setCommentAction({ step: 'revision', title: 'Request revision' })}>
                  Request revision
                </ErpButton>
                <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={() => setCommentAction({ step: 'reject', title: 'Reject sample' })}>
                  Reject
                </ErpButton>
              </div>
            )}
          </ErpCard>
        )}

        {sample.timeline && sample.timeline.length > 0 && (
          <ErpCard className="mt-3 !p-3">
            <div className="mb-2 flex items-center gap-2">
              <Clock size={14} className="text-erp-text-muted" />
              <h3 className="text-[11px] font-semibold text-erp-text-primary">Activity</h3>
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-[10px]">
              {[...sample.timeline].reverse().map((t, i) => (
                <li key={i} className="flex flex-wrap gap-x-2 text-erp-text-muted">
                  <span>{new Date(t.at).toLocaleString()}</span>
                  <span className="text-erp-text-primary">{t.action?.replace(/_/g, ' ')}</span>
                  {t.fromStatus !== t.toStatus && (
                    <span>{statusLabel(t.fromStatus ?? '')} → {statusLabel(t.toStatus ?? '')}</span>
                  )}
                  {t.note && <span className="italic">"{t.note}"</span>}
                </li>
              ))}
            </ul>
          </ErpCard>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmStep}
        title={confirmStep?.label ?? 'Confirm'}
        message={confirmStep?.message ?? 'This action advances the sample workflow.'}
        confirmLabel="Continue"
        loading={workflow.isPending}
        onCancel={() => setConfirmStep(null)}
        onConfirm={() => {
          if (!confirmStep) return;
          workflow.mutate({ step: confirmStep.step });
        }}
      />

      <CommentPrompt
        open={!!commentAction}
        title={commentAction?.title ?? 'Comments'}
        message="Provide clear feedback for the team (min 3 characters)."
        required
        minLength={3}
        confirmLabel="Submit"
        loading={workflow.isPending}
        onCancel={() => setCommentAction(null)}
        onConfirm={(comments) => {
          if (!commentAction) return;
          workflow.mutate({ step: commentAction.step, comments });
        }}
      />

      {fitQcOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setFitQcOpen(null)}>
          <div
            className="my-4 w-full max-w-lg rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-erp-text-primary">
              {fitQcOpen === 'qc-pass' && 'QC pass — measurement sheet'}
              {fitQcOpen === 'qc-fail' && 'QC fail — defects & measurements'}
              {fitQcOpen === 'fit-trial' && 'Fit trial session'}
            </h3>
            <p className="mt-1 text-[11px] text-erp-text-muted">
              {fitQcOpen === 'fit-trial'
                ? 'Record fit on model / dress form — flag pattern corrections if needed.'
                : 'Record required vs actual measurements before advancing.'}
            </p>
            {fitQcOpen !== 'fit-trial' && (
              <div className="mt-3">
                <QcMeasurementForm value={qcMeasurements} onChange={setQcMeasurements} />
              </div>
            )}
            {fitQcOpen === 'fit-trial' && (
              <div className="mt-3">
                <FitAnalysisForm
                  value={fitAnalysis}
                  onChange={setFitAnalysis}
                  requireRevisionOption
                />
              </div>
            )}
            <label className={`${fieldLabel} mt-3`}>Notes</label>
            <textarea
              className="w-full rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] px-2 py-1.5 text-[11px]"
              rows={2}
              value={fitQcComments}
              onChange={(e) => setFitQcComments(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={() => setFitQcOpen(null)}>Cancel</ErpButton>
              <ErpButton
                className="!px-3 !py-1.5 text-[11px]"
                disabled={workflow.isPending || (fitQcOpen === 'qc-fail' && fitQcComments.trim().length < 3)}
                onClick={() => {
                  if (fitQcOpen === 'fit-trial') {
                    workflow.mutate({ step: 'fit-trial', comments: fitQcComments, fit: fitAnalysis });
                  } else {
                    workflow.mutate({
                      step: fitQcOpen,
                      comments: fitQcComments,
                      measurements: qcMeasurements,
                    });
                  }
                }}
              >
                Submit
              </ErpButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialSummary({
  lines,
  className = '',
}: {
  lines?: Sample['materialRequirements'];
  className?: string;
}) {
  if (!lines?.length) {
    return <p className={`text-[10px] text-erp-text-muted ${className}`}>No material lines yet.</p>;
  }
  return (
    <ul className={`space-y-1 text-[10px] ${className}`}>
      {lines.map((m, i) => (
        <MaterialSummaryLine key={i} line={m} />
      ))}
    </ul>
  );
}

function MaterialSummaryLine({ line: m }: { line: NonNullable<Sample['materialRequirements']>[number] }) {
  const matId = typeof m.materialId === 'string'
    ? m.materialId
    : (m.materialId as { _id?: string } | undefined)?._id;
  const { data: avail } = useQuery({
    queryKey: ['material-avail', matId],
    queryFn: () => inventoryApi.availability(matId!),
    enabled: !!matId,
    staleTime: 30_000,
  });
  return (
    <li className="flex flex-wrap gap-x-2 text-erp-text-muted">
      <span className="font-medium text-erp-text-primary">{materialLabel(m.materialId)}</span>
      <span>{m.requiredQty} {m.unit}</span>
      {avail && (
        <span className={(m.requiredQty ?? 0) > (avail.available ?? 0) && !(m.reservedQty ?? 0)
          ? 'text-red-600'
          : 'text-sky-700'}
        >
          {avail.available ?? 0} avail / need {m.requiredQty}
          {(avail.locations?.length ?? 0) > 0 ? ` · ${avail.locations!.length} bin(s)` : ''}
        </span>
      )}
      {(m.reservedQty ?? 0) > 0 && <span className="text-amber-600">reserved {m.reservedQty}</span>}
      {(m.issuedQty ?? 0) > 0 && <span className="text-emerald-600">issued {m.issuedQty}</span>}
      {(m as MatLine & { cost?: number }).cost != null && (m as MatLine & { cost?: number }).cost! > 0 && (
        <span>issued {formatCost((m as MatLine & { cost?: number }).cost)}</span>
      )}
    </li>
  );
}
