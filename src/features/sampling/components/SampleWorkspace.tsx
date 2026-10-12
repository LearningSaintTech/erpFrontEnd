import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Save, Truck } from 'lucide-react';
import { inventoryApi, sampleApi } from '../../../services/manufacturing';
import { useAuth } from '../../../app/providers/AuthProvider';
import {
  Button, EmptyState, IconButton, InfoBanner, PageHeader, Section, Skeleton, StatusBadge, toast, useConfirm, usePrompt,
} from '../../../components/erp';
import { toErrorMessage } from '../../../utils/errors';
import type { FitAnalysis } from '../../../types/api';
import {
  canEditSampleWorkflow,
  canAdvanceSampleFloor,
  canApproveSample,
  hasSamplingUpdate,
  samplePatternMasterId,
} from '../samplingPermissions';
import {
  canEditMaterials,
  designIdOf,
  designLabel,
  formatCost,
  materialIdOf,
  buildMaterialOptions,
  sampleTypeLabel,
  statusLabel,
} from '../sampleUtils';
import type { SampleWorkflowStepId } from '../sampleWorkflowUtils';
import { inferSampleStep } from '../sampleWorkflowUtils';
import type { QcMeasurement } from '../QcMeasurementForm';
import { SampleWorkflowStepper } from './SampleWorkflowStepper';
import {
  getSampleActions, type SampleAction, sampleWaitingHint, sampleWorkflowSuccessMessage, SAMPLE_CLOSED_STATUSES,
} from '../sampleNextActions';
import { SampleNextActionBar } from './SampleNextActionBar';
import { SampleStepGuidance } from './SampleStepGuidance';
import { SampleMaterialsEditor, type MatLine } from './SampleMaterialsEditor';
import { SampleMaterialSummary } from './SampleMaterialSummary';
import { SampleQcFitModal, type QcFitMode } from './SampleQcFitModal';
import {
  ApprovalPanel, BriefPanel, FitPanel, FloorPanel, QcPanel, SampleActivity,
} from './SampleStepPanels';
import { StickyActionBar, SaveState } from '../../design/components/StickyActionBar';

function linesKey(lines: MatLine[], hours: string, rate: string) {
  return JSON.stringify({
    l: lines.map((l) => [materialIdOf(l.materialId), Number(l.requiredQty) || 0]),
    hours: hours || '',
    rate: rate || '',
  });
}

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
  const navigate = useNavigate();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canApprove = canApproveSample(permissions, isSuperAdmin);
  const canInventory = permissions.includes('*') || permissions.includes('inventory.update');
  const canQc = permissions.includes('*') || permissions.includes('quality.update');
  const canCancel = permissions.includes('*') || permissions.includes('sampling.approve')
    || permissions.includes('sampling.create') || isSuperAdmin;

  const [step, setStep] = useState<SampleWorkflowStepId>('brief');
  const [matLines, setMatLines] = useState<MatLine[]>([]);
  const [laborHours, setLaborHours] = useState('');
  const [laborRate, setLaborRate] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [modal, setModal] = useState<QcFitMode | null>(null);
  const hydratedRef = useRef('');

  const { data: sample, isLoading, isError, error: queryError, refetch, isFetching } = useQuery({
    queryKey: ['sample', sampleId],
    queryFn: () => sampleApi.get(sampleId),
    enabled: !!sampleId,
  });

  const patternMasterId = sample ? samplePatternMasterId(sample) : undefined;
  const canEdit = sample ? canEditSampleWorkflow(permissions, user?._id, patternMasterId, isSuperAdmin) : false;
  const canAdvanceFloor = sample ? canAdvanceSampleFloor(permissions, user?._id, patternMasterId, isSuperAdmin) : false;

  useEffect(() => {
    if (!sample) return;
    const key = `${sampleId}:${sample.status}:${sample.updatedAt ?? ''}`;
    if (hydratedRef.current === key) return;
    hydratedRef.current = key;
    const lines = (sample.materialRequirements || []).map((m) => ({ ...m, materialId: materialIdOf(m.materialId) }));
    const hours = sample.laborHours != null ? String(sample.laborHours) : '';
    const rate = sample.laborRate != null ? String(sample.laborRate) : '';
    setMatLines(lines);
    setLaborHours(hours);
    setLaborRate(rate);
    setSavedKey(linesKey(lines, hours, rate));
    setStep(inferSampleStep(sample));
  }, [sample, sampleId]);

  const { data: materials = [], isLoading: materialsLoading, isError: materialsError } = useQuery({
    queryKey: ['sample-material-options'],
    queryFn: () => sampleApi.materialOptions(),
    enabled: !!sample,
    staleTime: 60_000,
  });

  const materialOptions = useMemo(() => buildMaterialOptions(materials, matLines), [materials, matLines]);

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

  const saveMaterials = useMutation({
    mutationFn: () => sampleApi.updateMaterials(sampleId, {
      materialRequirements: matLines.map((l) => {
        const id = materialIdOf(l.materialId);
        // The store reserves/issues in the material's own unit — never send a different one.
        const matUnit = materialOptions.find((m) => String(m._id) === id)?.unit;
        return { materialId: id, requiredQty: l.requiredQty, unit: matUnit || l.unit || 'PIECES' };
      }),
      laborHours: laborHours ? Number(laborHours) : undefined,
      laborRate: laborRate ? Number(laborRate) : undefined,
    }),
    onSuccess: async () => {
      setSavedKey(linesKey(matLines, laborHours, laborRate));
      await invalidate();
    },
  });

  const refreshMaterials = useMutation({
    mutationFn: () => sampleApi.refreshMaterials(sampleId),
    meta: { successMessage: 'Materials loaded from the pattern tech pack' },
    onSuccess: async (updated) => {
      const lines = (updated.materialRequirements || []).map((m) => ({ ...m, materialId: materialIdOf(m.materialId) }));
      setMatLines(lines);
      setSavedKey(linesKey(lines, laborHours, laborRate));
      await invalidate();
    },
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
        case 'request-material-changes': return sampleApi.requestMaterialChanges(sampleId, comments!);
        case 'cancel': return sampleApi.cancel(sampleId, comments ?? '');
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
      setModal(null);
      await invalidate();
      toast.success(sampleWorkflowSuccessMessage(vars.step));
    },
  });

  const storeLines = useMemo(() => sample?.materialRequirements || [], [sample]);
  const storeMatIds = useMemo(
    () => [...new Set(storeLines.map((l) => materialIdOf(l.materialId)).filter(Boolean))],
    [storeLines],
  );
  const previewStatus = sample?.status ?? '';
  const availQueries = useQueries({
    queries: storeMatIds.map((id) => ({
      queryKey: ['inventory-availability', id],
      queryFn: () => inventoryApi.availability(id),
      enabled: canInventory && !!sample && !!id && ['MATERIAL_REQUEST_APPROVED', 'MATERIAL_RESERVED'].includes(previewStatus),
      staleTime: 30_000,
    })),
  });
  const availByMat = useMemo(() => {
    const map = new Map<string, number>();
    storeMatIds.forEach((id, i) => map.set(id, availQueries[i]?.data?.available ?? 0));
    return map;
  }, [storeMatIds, availQueries]);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton height={28} width="40%" />
        <Skeleton height={64} />
        <Skeleton height={56} />
        <Skeleton height={280} />
      </div>
    );
  }

  const backButton = (
    <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onClose} className="mb-2 -ml-2">
      Samples
    </Button>
  );

  if (isError || !sample) {
    return (
      <>
        {backButton}
        <Section>
          <EmptyState
            title="Sample not found"
            description={toErrorMessage(queryError) || 'It may have been removed, or you may not have access.'}
            action={<Button variant="secondary" onClick={onClose}>Back to samples</Button>}
          />
        </Section>
      </>
    );
  }

  const designId = designIdOf(sample);
  const status = sample.status;
  const activeStep = inferSampleStep(sample);
  const materialsEditable = canEdit && canEditMaterials(status);
  const materialsDirty = materialsEditable && linesKey(matLines, laborHours, laborRate) !== savedKey;
  const nextActions = getSampleActions({
    status,
    sampleType: sample.sampleType,
    canEdit,
    canAdvanceFloor,
    canApprove,
    canInventory,
    canQc,
    materialCount: matLines.length,
    canCancel,
  });

  const reserveShortfall = status === 'MATERIAL_REQUEST_APPROVED' && storeLines.some((l) => {
    const id = materialIdOf(l.materialId);
    const need = (l.requiredQty ?? 0) - (l.reservedQty ?? 0);
    return need > 0 && (availByMat.get(id) ?? 0) < need;
  });

  const runAction = async (action: SampleAction) => {
    if (action.kind === 'modal-qc-pass') { setModal('qc-pass'); return; }
    if (action.kind === 'modal-qc-fail') { setModal('qc-fail'); return; }
    if (action.kind === 'modal-fit-trial') { setModal('fit-trial'); return; }
    if (!action.step) return;

    if (action.kind === 'comment') {
      const danger = !!action.danger;
      const comments = await prompt({
        title: action.commentTitle || action.label,
        label: danger ? 'Reason' : 'What needs to change',
        minLength: 3,
        tone: danger ? 'danger' : 'primary',
        confirmLabel: action.label,
      });
      if (comments != null) workflow.mutate({ step: action.step, comments });
      return;
    }

    if (action.step === 'reserve' && reserveShortfall) {
      toast.warning('Not enough stock to reserve every line', { description: 'Receive the shortfall through purchase, or check inventory.' });
    }
    const unsaved = action.step === 'submit-material' && materialsDirty;
    const ok = await confirm({
      title: `${action.label}?`,
      message: unsaved
        ? `Your unsaved material changes are saved first. ${action.confirmMessage ?? ''}`
        : action.confirmMessage,
      confirmLabel: action.label,
      tone: action.danger ? 'danger' : 'primary',
    });
    if (!ok) return;
    try {
      if (unsaved) await saveMaterials.mutateAsync();
      workflow.mutate({ step: action.step, comments: action.step === 'cancel' ? '' : undefined });
    } catch {
      // toast from the mutation
    }
  };

  const waiting = !SAMPLE_CLOSED_STATUSES.includes(status) ? sampleWaitingHint(status) : null;
  const readOnlyNote = !canEdit && !canAdvanceFloor && !canApprove && hasSamplingUpdate(permissions, isSuperAdmin);
  const showStockFor = canInventory && ['MATERIAL_REQUEST_APPROVED', 'MATERIAL_RESERVED', 'MATERIAL_REQUEST_PENDING', 'CREATED'].includes(status);

  return (
    <div className="sample-workspace">
      {backButton}
      <PageHeader
        title={(
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{sample.sampleCode}</span>
            <StatusBadge status={status} label={statusLabel(status)} />
          </span>
        )}
        description={(
          <>
            {sampleTypeLabel(sample.sampleType)} for{' '}
            <button type="button" className="font-medium text-[var(--erp-accent)] hover:underline" onClick={() => navigate(`/designs/${designId}/edit`)}>
              {designLabel(sample.designId)}
            </button>
          </>
        )}
        meta={(
          <span className="flex flex-wrap items-center gap-2 text-[13px] text-erp-text-muted">
            {sample.iteration && sample.iteration > 1 && <span>Revision {sample.iteration}</span>}
            {sample.totalCost != null && sample.totalCost > 0 && <span>Sample cost {formatCost(sample.totalCost)}</span>}
          </span>
        )}
        secondaryActions={(
          <IconButton aria-label="Refresh sample" outlined loading={isFetching} onClick={() => refetch()}>
            <RefreshCw size={16} />
          </IconButton>
        )}
      />

      {readOnlyNote && (
        <InfoBanner inset={false} tone="muted" className="mb-4">
          View only — the assigned pattern master handles materials; the sampling team runs cutting onward.
        </InfoBanner>
      )}

      <SampleNextActionBar
        actions={nextActions}
        loading={workflow.isPending || saveMaterials.isPending}
        waiting={waiting}
        onAction={runAction}
      />

      <Section className="mb-4">
        <SampleWorkflowStepper current={step} sampleStatus={status} sampleType={sample.sampleType} onSelect={setStep} />
      </Section>

      <SampleStepGuidance
        stepId={step}
        status={status}
        sampleType={sample.sampleType}
        activeStep={activeStep}
        onGoActive={() => setStep(activeStep)}
      />

      {step === 'brief' && <BriefPanel sample={sample} designId={designId} />}

      {step === 'materials' && (
        materialsEditable ? (
          <>
            <SampleMaterialsEditor
              lines={matLines}
              onLinesChange={(fn) => setMatLines(fn)}
              materialOptions={materialOptions}
              materialsLoading={materialsLoading}
              materialsError={materialsError}
              laborHours={laborHours}
              laborRate={laborRate}
              onLaborHoursChange={setLaborHours}
              onLaborRateChange={setLaborRate}
              onLoadFromBom={() => refreshMaterials.mutate()}
              loadingFromBom={refreshMaterials.isPending}
            />
            <StickyActionBar status={<SaveState dirty={materialsDirty} saving={saveMaterials.isPending} />}>
              <Button
                variant={materialsDirty ? 'primary' : 'secondary'}
                icon={<Save size={16} />}
                disabled={!materialsDirty || matLines.length === 0}
                loading={saveMaterials.isPending}
                onClick={() => saveMaterials.mutate(undefined, { onSuccess: () => toast.success('Materials and labour saved') })}
              >
                Save materials
              </Button>
            </StickyActionBar>
          </>
        ) : (
          <div className="space-y-4">
            {canInventory && status === 'MATERIAL_REQUEST_APPROVED' && reserveShortfall && (
              <InfoBanner
                inset={false}
                tone="warn"
                icon={<Truck size={16} />}
                action={<Button size="sm" variant="secondary" onClick={() => navigate('/purchase')}>Open purchase</Button>}
              >
                Some lines do not have enough stock. Receive the shortfall through purchase before reserving.
              </InfoBanner>
            )}
            <Section title="Fabric and trims" description={status === 'MATERIAL_REQUEST_PENDING' ? 'Waiting for approval.' : undefined} flush>
              <SampleMaterialSummary lines={sample.materialRequirements} showStock={showStockFor} />
            </Section>
          </div>
        )
      )}

      {step === 'cutting' && <FloorPanel sample={sample} kind="cutting" />}
      {step === 'stitching' && <FloorPanel sample={sample} kind="stitching" />}
      {step === 'qc' && <QcPanel sample={sample} />}
      {step === 'fit' && <FitPanel sample={sample} designId={designId} />}
      {step === 'approval' && <ApprovalPanel sample={sample} />}

      <SampleActivity timeline={sample.timeline} />

      <SampleQcFitModal
        mode={modal}
        initialFit={sample.fitAnalysis}
        loading={workflow.isPending}
        onClose={() => setModal(null)}
        onSubmit={({ comments, measurements, fit }) => {
          if (!modal) return;
          if (modal === 'fit-trial') workflow.mutate({ step: 'fit-trial', comments, fit });
          else workflow.mutate({ step: modal, comments, measurements });
        }}
      />
    </div>
  );
}
