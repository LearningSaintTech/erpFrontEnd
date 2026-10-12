import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Save, Scissors,
} from 'lucide-react';
import { patternApi } from '../../../services/manufacturing';
import { useAuth } from '../../../app/providers/AuthProvider';
import {
  Button, EmptyState, InfoBanner, PageHeader, Section, Skeleton, StatusBadge, Tooltip, toast, useConfirm,
} from '../../../components/erp';
import { toErrorMessage } from '../../../utils/errors';
import { designLabel, masterLabel } from '../patternUtils';
import type { WorkflowStepId } from '../patternWorkflowUtils';
import {
  inferWorkflowStep,
  canAccessStep,
  validateMarkerForm,
  canCompletePattern,
  isStepComplete,
  WORKFLOW_STEPS,
} from '../patternWorkflowUtils';
import { PatternWorkflowStepper } from './PatternWorkflowStepper';
import { PatternTechPackPanel, PatternDesignBrief } from './PatternTechPackPanel';
import { PatternTechPackEditor, type TechPackPayload } from './PatternTechPackEditor';
import { PatternMarkerPanel, emptyMarkerForm, type MarkerFormState } from './PatternMarkerPanel';
import { PatternGradingPanel, emptyGradingForm, type GradingFormState } from './PatternGradingPanel';
import { PatternVerificationPanel, type VerifyFormState } from './PatternVerificationPanel';
import { PatternNotAssigned } from './PatternNotAssigned';
import { canEditPatternWorkflow, canAssignPattern, canReopenPattern, patternCapabilities } from '../patternPermissions';
import { StickyActionBar, SaveState } from '../../design/components/StickyActionBar';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1]! : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const emptyVerify = (): VerifyFormState => ({
  sizeChartVerified: false,
  consumptionVerified: false,
  sampleBomVerified: false,
  patternNotes: '',
});

export function PatternWorkspace({
  designId,
  onClose,
  onCompleted,
}: {
  designId: string;
  onClose: () => void;
  onCompleted?: (designId: string) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canAssign = canAssignPattern(permissions, isSuperAdmin);
  const canReopen = canReopenPattern(permissions, isSuperAdmin);
  const { myWorkOnly } = patternCapabilities(permissions, isSuperAdmin);
  const [step, setStep] = useState<WorkflowStepId>('techpack');
  const [markerForm, setMarkerForm] = useState<MarkerFormState>(emptyMarkerForm());
  const [markerBase, setMarkerBase] = useState<MarkerFormState>(emptyMarkerForm());
  const [gradingForm, setGradingForm] = useState<GradingFormState>(emptyGradingForm());
  const [gradingBase, setGradingBase] = useState<GradingFormState>(emptyGradingForm());
  const [verifyForm, setVerifyForm] = useState<VerifyFormState>(emptyVerify());
  const [verifyBase, setVerifyBase] = useState<VerifyFormState>(emptyVerify());
  const [showMarkerErrors, setShowMarkerErrors] = useState(false);
  const [showGradingErrors, setShowGradingErrors] = useState(false);
  const hydratedRef = useRef('');

  const { data: pd, isLoading: pdLoading, isError: pdError, error: pdQueryError } = useQuery({
    queryKey: ['pattern-development', designId],
    queryFn: () => patternApi.get(designId),
    enabled: !!designId,
    retry: false,
  });

  const { data: techPack, isLoading: tpLoading, isError: tpError, refetch: refetchTechPack } = useQuery({
    queryKey: ['pattern-tech-pack', designId],
    queryFn: () => patternApi.getTechPack(designId),
    enabled: !!designId && !!pd,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['pattern-material-options'],
    queryFn: () => patternApi.materialOptions(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!pd || !techPack) return;
    const key = `${designId}:${pd._id}:${pd.status}:${pd.completedAt ?? ''}`;
    if (hydratedRef.current === key) return;
    hydratedRef.current = key;

    const marker = emptyMarkerForm(pd, techPack.techPack?.fabricSpecs?.fabricWidth);
    const grading = emptyGradingForm(pd, techPack);
    const verify: VerifyFormState = {
      sizeChartVerified: !!pd.sizeChartVerified,
      consumptionVerified: !!pd.consumptionVerified,
      sampleBomVerified: !!pd.sampleBomVerified,
      patternNotes: pd.patternNotes || '',
    };
    setMarkerForm(marker);
    setMarkerBase(marker);
    setGradingForm(grading);
    setGradingBase(grading);
    setVerifyForm(verify);
    setVerifyBase(verify);
    setStep(inferWorkflowStep(pd, techPack));
  }, [pd, techPack, designId]);

  const invalidate = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['pattern-development', designId] }),
      qc.invalidateQueries({ queryKey: ['pattern-tech-pack', designId] }),
      qc.invalidateQueries({ queryKey: ['pattern-developments'] }),
      qc.invalidateQueries({ queryKey: ['pattern-stats'] }),
      qc.invalidateQueries({ queryKey: ['sample-eligible-designs'] }),
    ]);
  }, [qc, designId]);

  const saveTechPackMutation = useMutation({
    mutationFn: (payload: TechPackPayload) => patternApi.update(designId, payload),
    meta: { successMessage: 'Tech pack saved' },
    onSuccess: async () => {
      await invalidate();
      hydratedRef.current = '';
    },
  });

  const saveMarkerMutation = useMutation({
    mutationFn: () => {
      const err = validateMarkerForm(markerForm);
      if (err) throw new Error(err);
      return patternApi.update(designId, {
        marker: {
          length: markerForm.markerLength ? Number(markerForm.markerLength) : undefined,
          fabricWidth: markerForm.fabricWidth ? Number(markerForm.fabricWidth) : undefined,
          piecesPerMarker: markerForm.piecesPerMarker ? Number(markerForm.piecesPerMarker) : undefined,
          efficiencyPercent: markerForm.efficiencyPercent ? Number(markerForm.efficiencyPercent) : undefined,
          notes: markerForm.markerNotes || undefined,
        },
        calculatedConsumption: {
          wastagePercent: markerForm.wastagePercent ? Number(markerForm.wastagePercent) : undefined,
          derivedFromMarker: true,
          notes: 'Calculated from marker layout',
        },
      });
    },
    meta: { successMessage: 'Marker and consumption saved' },
    onSuccess: async () => {
      setShowMarkerErrors(false);
      setMarkerBase(markerForm);
      await invalidate();
      hydratedRef.current = '';
      setStep('grading');
    },
  });

  const uploadMarkerMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Marker file must be 10 MB or smaller');
      }
      const contentBase64 = await fileToBase64(file);
      return patternApi.uploadMarker(designId, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64,
      });
    },
    meta: { successMessage: 'Marker file uploaded' },
    onSuccess: () => { invalidate(); },
  });

  const saveGradingMutation = useMutation({
    mutationFn: () => {
      const sizes = techPack?.techPack?.sizeChartData?.sizeLabels
        ?? techPack?.design.sizeChartData?.sizeLabels
        ?? gradingForm.gradedSizes.split(',').map((s) => s.trim()).filter(Boolean);
      return patternApi.update(designId, {
        grading: {
          baseSize: gradingForm.baseSize,
          gradedSizes: sizes,
          notes: gradingForm.notes || undefined,
        },
      });
    },
    meta: { successMessage: 'Base size saved' },
    onSuccess: async () => {
      setGradingBase(gradingForm);
      await invalidate();
      hydratedRef.current = '';
      setStep('verify');
    },
  });

  const saveVerifyMutation = useMutation({
    mutationFn: () => patternApi.update(designId, {
      patternNotes: verifyForm.patternNotes || undefined,
      sizeChartVerified: verifyForm.sizeChartVerified,
      consumptionVerified: verifyForm.consumptionVerified,
      sampleBomVerified: verifyForm.sampleBomVerified,
    }),
    onSuccess: async () => {
      setVerifyBase(verifyForm);
      await invalidate();
      hydratedRef.current = '';
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => patternApi.complete(designId),
    meta: { successMessage: 'Pattern development complete', successDescription: 'Opening sampling for this design.' },
    onSuccess: async () => {
      await invalidate();
      hydratedRef.current = '';
      setStep('verify');
      onCompleted?.(designId);
      navigate(`/samples?designId=${designId}&from=pattern`);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => patternApi.reopen(designId),
    meta: { successMessage: 'Pattern reopened', successDescription: 'The pattern master can edit and sign off again.' },
    onSuccess: async () => {
      await invalidate();
      hydratedRef.current = '';
    },
  });

  if (pdLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton height={28} width="45%" />
        <Skeleton height={56} />
        <Skeleton height={320} />
      </div>
    );
  }

  const pdStatus = (pdQueryError as { response?: { status?: number } })?.response?.status;
  const isNotAssigned = pdError && pdStatus === 404;

  const backButton = (
    <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onClose} className="mb-2 -ml-2">
      Pattern queue
    </Button>
  );

  if (pdError && !isNotAssigned) {
    return (
      <>
        {backButton}
        <Section>
          <EmptyState
            title="Could not load this pattern"
            description={toErrorMessage(pdQueryError)}
            action={<Button variant="secondary" onClick={onClose}>Back to queue</Button>}
          />
        </Section>
      </>
    );
  }

  if (isNotAssigned || !pd) {
    return (
      <>
        {backButton}
        <PatternNotAssigned designId={designId} onClose={onClose} canAssign={canAssign} />
      </>
    );
  }

  const isComplete = pd.status === 'COMPLETED';
  const canWorkflowEdit = canEditPatternWorkflow(permissions, user?._id, pd.patternMasterId, isSuperAdmin);
  const effectiveReadOnly = !canWorkflowEdit || isComplete;
  const completeBlockReason = canCompletePattern(pd, techPack);
  const techPackReady = isStepComplete('techpack', pd, techPack);
  const allChecked = verifyForm.sizeChartVerified && verifyForm.consumptionVerified && verifyForm.sampleBomVerified;

  const markerDirty = JSON.stringify(markerForm) !== JSON.stringify(markerBase);
  const gradingDirty = JSON.stringify(gradingForm) !== JSON.stringify(gradingBase);
  const verifyDirty = JSON.stringify(verifyForm) !== JSON.stringify(verifyBase);

  const goToStep = (next: WorkflowStepId) => {
    if (canAccessStep(next, pd, techPack)) {
      setStep(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      toast.info('Finish the previous step first');
    }
  };

  const reopen = async () => {
    const ok = await confirm({
      title: 'Reopen pattern development?',
      message: `Sign-offs are cleared and new samples are blocked until ${masterLabel(pd.patternMasterId)} completes it again.`,
      confirmLabel: 'Reopen',
      tone: 'danger',
    });
    if (ok) reopenMutation.mutate();
  };

  const handleComplete = async () => {
    const block = canCompletePattern(pd, techPack);
    if (block) {
      toast.warning(block);
      return;
    }
    const ok = await confirm({
      title: 'Complete pattern development?',
      message: 'The pattern is locked and sampling opens for this design. A design manager can reopen it later if corrections are needed.',
      confirmLabel: 'Complete',
      tone: 'primary',
    });
    if (!ok) return;
    try {
      await saveVerifyMutation.mutateAsync();
      await completeMutation.mutateAsync();
    } catch {
      // errors surfaced as toasts by the mutations
    }
  };

  const stepLabel = WORKFLOW_STEPS.find((s) => s.id === step)?.label ?? '';
  const sizeLabels = techPack?.techPack?.sizeChartData?.sizeLabels ?? techPack?.design.sizeChartData?.sizeLabels ?? [];

  let bar: ReactNode = null;
  if (isComplete) {
    bar = (
      <StickyActionBar status="Pattern complete — sampling is open for this design.">
        {canReopen && (
          <Button variant="secondary" icon={<RotateCcw size={16} />} loading={reopenMutation.isPending} onClick={reopen}>
            Reopen for corrections
          </Button>
        )}
        <Button icon={<Scissors size={16} />} onClick={() => navigate(`/samples?designId=${designId}&from=pattern`)}>Go to sampling</Button>
      </StickyActionBar>
    );
  } else if (!effectiveReadOnly && step === 'marker') {
    const complete = isStepComplete('marker', pd, techPack);
    const markerError = validateMarkerForm(markerForm);
    bar = (
      <StickyActionBar
        status={(
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <SaveState dirty={markerDirty} saving={saveMarkerMutation.isPending} />
            {showMarkerErrors && markerError && <span className="text-[var(--erp-danger-text)]">{markerError}</span>}
          </span>
        )}
      >
        {complete && !markerDirty ? (
          <Button iconRight={<ArrowRight size={16} />} onClick={() => goToStep('grading')}>Continue to base size</Button>
        ) : (
          <Button
            icon={<Save size={16} />}
            loading={saveMarkerMutation.isPending}
            onClick={() => {
              if (markerError) { setShowMarkerErrors(true); return; }
              saveMarkerMutation.mutate();
            }}
          >
            Save and continue
          </Button>
        )}
      </StickyActionBar>
    );
  } else if (!effectiveReadOnly && step === 'grading') {
    const complete = isStepComplete('grading', pd, techPack);
    bar = (
      <StickyActionBar status={<SaveState dirty={gradingDirty} saving={saveGradingMutation.isPending} />}>
        {complete && !gradingDirty ? (
          <Button iconRight={<ArrowRight size={16} />} onClick={() => goToStep('verify')}>Continue to sign-off</Button>
        ) : (
          <Button
            icon={<Save size={16} />}
            loading={saveGradingMutation.isPending}
            onClick={() => {
              if (!gradingForm.baseSize) { setShowGradingErrors(true); return; }
              saveGradingMutation.mutate();
            }}
          >
            Save and continue
          </Button>
        )}
      </StickyActionBar>
    );
  } else if (!effectiveReadOnly && step === 'verify') {
    const reason = completeBlockReason || (!allChecked ? 'Tick all three checks to complete.' : '');
    const completeBtn = (
      <Button
        icon={<CheckCircle2 size={16} />}
        loading={completeMutation.isPending || (saveVerifyMutation.isPending && !verifyDirty)}
        disabled={!!reason}
        onClick={handleComplete}
      >
        Complete pattern
      </Button>
    );
    bar = (
      <StickyActionBar
        status={(
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <SaveState dirty={verifyDirty} saving={saveVerifyMutation.isPending} />
            {reason && <span className="text-erp-text-muted">{reason}</span>}
          </span>
        )}
      >
        <Button
          variant="secondary"
          disabled={!verifyDirty}
          loading={saveVerifyMutation.isPending}
          onClick={() => saveVerifyMutation.mutate(undefined, { onSuccess: () => toast.success('Checks saved') })}
        >
          Save checks
        </Button>
        {reason ? <Tooltip content={reason}><span>{completeBtn}</span></Tooltip> : completeBtn}
      </StickyActionBar>
    );
  } else if (effectiveReadOnly && step !== 'techpack') {
    const idx = WORKFLOW_STEPS.findIndex((s) => s.id === step);
    const next = WORKFLOW_STEPS[idx + 1];
    bar = next && canAccessStep(next.id, pd, techPack) ? (
      <StickyActionBar status={`Viewing ${stepLabel.toLowerCase()} — read-only.`}>
        <Button variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => goToStep(next.id)}>{next.label}</Button>
      </StickyActionBar>
    ) : null;
  }

  return (
    <div className="pattern-workspace">
      {backButton}
      <PageHeader
        title={designLabel(pd.designId)}
        description={canWorkflowEdit && !isComplete
          ? 'Work through the four steps below, then sign off to open sampling.'
          : 'Pattern tech pack, marker and grading for this design.'}
        meta={(
          <span className="flex flex-wrap items-center gap-2 text-[13px] text-erp-text-muted">
            <StatusBadge status={pd.status || 'ASSIGNED'} label={pd.status === 'ASSIGNED' ? 'Not started' : undefined} />
            <span className="font-mono">{pd.patternDevelopmentCode}</span>
            {!myWorkOnly && <span>· {masterLabel(pd.patternMasterId)}</span>}
          </span>
        )}
      />

      {!canWorkflowEdit && !isComplete && (
        <InfoBanner inset={false} tone="muted" className="mb-4">
          View only — {masterLabel(pd.patternMasterId)} edits the marker, grading and sign-off.
        </InfoBanner>
      )}
      {isComplete && canWorkflowEdit && !canReopen && (
        <InfoBanner inset={false} tone="muted" className="mb-4">
          This pattern is complete and locked. Ask a design manager to reopen it if corrections are needed.
        </InfoBanner>
      )}

      <Section className="mb-4">
        <PatternWorkflowStepper current={step} pd={pd} techPack={techPack} onSelect={goToStep} />
      </Section>

      {tpError && (
        <InfoBanner
          inset={false}
          tone="danger"
          className="mb-4"
          action={<Button size="sm" variant="secondary" onClick={() => refetchTechPack()}>Retry</Button>}
        >
          The tech pack could not be loaded.
        </InfoBanner>
      )}

      {step === 'techpack' && (
        <>
          {tpLoading && <Skeleton height={320} />}
          {techPack && !effectiveReadOnly && (
            <div className="space-y-4">
              <PatternDesignBrief techPack={techPack} designId={designId} />
              <PatternTechPackEditor
                designId={designId}
                techPack={techPack}
                materials={materials}
                readOnly={effectiveReadOnly}
                saving={saveTechPackMutation.isPending}
                onSave={(payload) => saveTechPackMutation.mutateAsync(payload)}
                canContinue={techPackReady}
                onContinue={() => goToStep('marker')}
              />
            </div>
          )}
          {techPack && effectiveReadOnly && (
            <>
              <PatternTechPackPanel techPack={techPack} designId={designId} />
              {!isComplete && canAccessStep('marker', pd, techPack) && (
                <StickyActionBar status="Viewing the tech pack — read-only.">
                  <Button variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => goToStep('marker')}>Marker</Button>
                </StickyActionBar>
              )}
            </>
          )}
        </>
      )}

      {step === 'marker' && (
        <PatternMarkerPanel
          pd={pd}
          form={markerForm}
          onChange={(p) => setMarkerForm((f) => ({ ...f, ...p }))}
          onUpload={(f) => uploadMarkerMutation.mutate(f)}
          uploading={uploadMarkerMutation.isPending}
          readOnly={effectiveReadOnly}
          showErrors={showMarkerErrors}
        />
      )}

      {step === 'grading' && (
        <PatternGradingPanel
          form={gradingForm}
          sizeLabels={sizeLabels}
          onChange={(p) => setGradingForm((f) => ({ ...f, ...p }))}
          readOnly={effectiveReadOnly}
          showErrors={showGradingErrors}
        />
      )}

      {step === 'verify' && (
        <PatternVerificationPanel
          pd={pd}
          evidence={techPack?.evidence ?? pd.evidence}
          form={verifyForm}
          onChange={(p) => setVerifyForm((f) => ({ ...f, ...p }))}
          readOnly={effectiveReadOnly}
        />
      )}

      {bar}
    </div>
  );
}
