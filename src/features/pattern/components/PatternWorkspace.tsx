import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, X } from 'lucide-react';
import { patternApi } from '../../../services/manufacturing';
import { useAuth } from '../../../app/providers/AuthProvider';
import { ErpButton, ErpCard, ErpPageHeader, ErpStatusBadge } from '../../../components/erp';
import { AlertBanner } from '../../../components/AlertBanner';
import { SuccessBanner } from '../../users/SuccessBanner';
import { toErrorMessage } from '../../../utils/errors';
import { designLabel, masterLabel, statusLabel } from '../patternUtils';
import type { WorkflowStepId } from '../patternWorkflowUtils';
import {
  inferWorkflowStep,
  canAccessStep,
  validateMarkerForm,
  canCompletePattern,
  isStepComplete,
} from '../patternWorkflowUtils';
import { PatternWorkflowStepper } from './PatternWorkflowStepper';
import { PatternTechPackPanel, PatternDesignBrief } from './PatternTechPackPanel';
import { PatternTechPackEditor, techPackFormToPayload } from './PatternTechPackEditor';
import { PatternMarkerPanel, emptyMarkerForm, type MarkerFormState } from './PatternMarkerPanel';
import { PatternGradingPanel, emptyGradingForm, type GradingFormState } from './PatternGradingPanel';
import { PatternVerificationPanel, type VerifyFormState } from './PatternVerificationPanel';
import { PatternNotAssigned } from './PatternNotAssigned';
import { canEditPatternWorkflow, canAssignPattern, canReopenPattern, patternCapabilities } from '../patternPermissions';

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
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canAssign = canAssignPattern(permissions, isSuperAdmin);
  const canReopen = canReopenPattern(permissions, isSuperAdmin);
  const { myWorkOnly } = patternCapabilities(permissions, isSuperAdmin);
  const [step, setStep] = useState<WorkflowStepId>('techpack');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [markerForm, setMarkerForm] = useState<MarkerFormState>(emptyMarkerForm());
  const [gradingForm, setGradingForm] = useState<GradingFormState>(emptyGradingForm());
  const [verifyForm, setVerifyForm] = useState<VerifyFormState>({
    sizeChartVerified: false,
    consumptionVerified: false,
    sampleBomVerified: false,
    patternNotes: '',
  });
  const [markerValidation, setMarkerValidation] = useState('');
  const hydratedRef = useRef('');

  const { data: pd, isLoading: pdLoading, isError: pdError, error: pdQueryError } = useQuery({
    queryKey: ['pattern-development', designId],
    queryFn: () => patternApi.get(designId),
    enabled: !!designId,
    retry: false,
  });

  const { data: techPack, isLoading: tpLoading, isError: tpError } = useQuery({
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

    setMarkerForm(emptyMarkerForm(pd, techPack.techPack?.fabricSpecs?.fabricWidth));
    setGradingForm(emptyGradingForm(pd, techPack));
    setVerifyForm({
      sizeChartVerified: !!pd.sizeChartVerified,
      consumptionVerified: !!pd.consumptionVerified,
      sampleBomVerified: !!pd.sampleBomVerified,
      patternNotes: pd.patternNotes || '',
    });
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

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const saveTechPackMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof techPackFormToPayload>) => patternApi.update(designId, payload),
    onSuccess: async () => {
      await invalidate();
      hydratedRef.current = '';
      showSuccess('Tech pack saved');
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
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
    onSuccess: async () => {
      setMarkerValidation('');
      await invalidate();
      hydratedRef.current = '';
      showSuccess('Marker and consumption saved');
      setStep('grading');
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const uploadMarkerMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Marker file must be 10MB or smaller');
      }
      const contentBase64 = await fileToBase64(file);
      return patternApi.uploadMarker(designId, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64,
      });
    },
    onSuccess: () => {
      invalidate();
      showSuccess('Marker file uploaded');
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
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
    onSuccess: async () => {
      await invalidate();
      hydratedRef.current = '';
      showSuccess('Grading plan saved');
      setStep('verify');
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const saveVerifyMutation = useMutation({
    mutationFn: () => patternApi.update(designId, {
      patternNotes: verifyForm.patternNotes || undefined,
      sizeChartVerified: verifyForm.sizeChartVerified,
      consumptionVerified: verifyForm.consumptionVerified,
      sampleBomVerified: verifyForm.sampleBomVerified,
    }),
    onSuccess: async () => {
      await invalidate();
      hydratedRef.current = '';
      showSuccess('Verification saved');
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const completeMutation = useMutation({
    mutationFn: () => patternApi.complete(designId),
    onSuccess: async () => {
      await invalidate();
      hydratedRef.current = '';
      setStep('verify');
      showSuccess('Pattern development completed — opening sampling…');
      onCompleted?.(designId);
      navigate(`/samples?designId=${designId}&from=pattern`);
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const reopenMutation = useMutation({
    mutationFn: () => patternApi.reopen(designId),
    onSuccess: async () => {
      await invalidate();
      hydratedRef.current = '';
      showSuccess('Pattern reopened — you can edit and re-verify');
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const handleComplete = async () => {
    setError('');
    const block = canCompletePattern(pd, techPack);
    if (block) {
      setError(block);
      return;
    }
    try {
      await saveVerifyMutation.mutateAsync();
      await completeMutation.mutateAsync();
    } catch {
      // errors surfaced by mutations
    }
  };

  if (pdLoading) {
    return <p className="p-4 text-[11px] text-erp-text-muted">Loading pattern workspace…</p>;
  }

  const pdStatus = (pdQueryError as { response?: { status?: number } })?.response?.status;
  const isNotAssigned = pdError && pdStatus === 404;

  if (pdError && !isNotAssigned) {
    return (
      <ErpCard className="!p-4">
        <p className="text-[11px] text-red-600">{toErrorMessage(pdQueryError)}</p>
        <ErpButton variant="secondary" className="mt-2 !px-3 !py-1.5 text-[11px]" onClick={onClose}>
          Back to queue
        </ErpButton>
      </ErpCard>
    );
  }

  if (isNotAssigned || !pd) {
    return <PatternNotAssigned designId={designId} onClose={onClose} canAssign={canAssign} />;
  }

  const isComplete = pd.status === 'COMPLETED';
  const canWorkflowEdit = canEditPatternWorkflow(
    permissions,
    user?._id,
    pd.patternMasterId,
    isSuperAdmin,
  );
  const effectiveReadOnly = !canWorkflowEdit || isComplete;
  const completeBlockReason = canCompletePattern(pd, techPack);
  const techPackReady = isStepComplete('techpack', pd, techPack);

  const goToStep = (next: WorkflowStepId) => {
    if (canAccessStep(next, pd, techPack)) setStep(next);
    else setError('Complete the previous workflow step before continuing');
  };

  return (
    <div className="pattern-workspace">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      {isComplete && canReopen && !canWorkflowEdit && (
        <ErpCard className="mb-3 !border-amber-500/30 !bg-amber-500/5 !p-3">
          <p className="text-[11px] text-erp-text-primary">
            Pattern is complete. Reopen to send corrections back to {masterLabel(pd.patternMasterId)}.
          </p>
          <ErpButton
            variant="secondary"
            className="mt-2 !px-3 !py-1.5 text-[11px]"
            disabled={reopenMutation.isPending}
            onClick={() => reopenMutation.mutate()}
          >
            Reopen for pattern master
          </ErpButton>
        </ErpCard>
      )}

      {isComplete && canWorkflowEdit && (
        <ErpCard className="mb-3 !border-amber-500/30 !bg-amber-500/5 !p-3">
          <p className="text-[11px] text-erp-text-primary">
            This pattern is complete and locked. Ask a design manager to reopen if further corrections are needed.
          </p>
        </ErpCard>
      )}

      {!canWorkflowEdit && !isComplete && (
        <ErpCard className="mb-3 !border-[var(--erp-border)] !p-3">
          <p className="text-[11px] text-erp-text-muted">
            View only — marker, grading, and sign-off are edited by the assigned pattern master ({masterLabel(pd.patternMasterId)}).
          </p>
        </ErpCard>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={onClose}>
          <ArrowLeft size={12} className="mr-1 inline" />
          Back to queue
        </ErpButton>
        <button type="button" onClick={onClose} className="text-erp-text-muted hover:text-erp-text-primary" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <ErpPageHeader
        title={designLabel(pd.designId)}
        subtitle={(
          <>
            <span className="font-mono">{pd.patternDevelopmentCode}</span>
            {!myWorkOnly && (
              <>
                <span className="mx-2">·</span>
                Pattern master: {masterLabel(pd.patternMasterId)}
              </>
            )}
          </>
        )}
        actions={(
          <ErpStatusBadge status={pd.status || 'ASSIGNED'} label={statusLabel(pd.status)} />
        )}
      />

      <PatternWorkflowStepper
        current={step}
        pd={pd}
        techPack={techPack}
        onSelect={(s) => goToStep(s)}
      />

      {tpError && (
        <ErpCard className="mb-3 !border-red-500/30 !bg-red-500/5 !p-3">
          <p className="text-[11px] text-red-700">Failed to load tech pack. Try refreshing the page.</p>
        </ErpCard>
      )}

      {step === 'techpack' && (
        <>
          {tpLoading && <p className="text-[11px] text-erp-text-muted">Loading tech pack…</p>}
          {techPack && !effectiveReadOnly && (
            <div className="space-y-3">
              <PatternDesignBrief techPack={techPack} designId={designId} />
              <PatternTechPackEditor
                designId={designId}
                techPack={techPack}
                materials={materials}
                readOnly={effectiveReadOnly}
                saving={saveTechPackMutation.isPending}
                onSave={(payload) => saveTechPackMutation.mutate(payload)}
              />
            </div>
          )}
          {techPack && effectiveReadOnly && <PatternTechPackPanel techPack={techPack} designId={designId} />}
          {!techPackReady && techPack && (
            <ErpCard className="mt-3 !border-amber-500/30 !bg-amber-500/5 !p-3">
              <p className="text-[11px] text-amber-800">
                Tech pack incomplete — graded POM chart, fabric consumption, and trims (sample BOM)
                are required before sign-off. Marker wastage and mill rate are not entered here.
              </p>
            </ErpCard>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <ErpButton
              className="!px-4 !py-1.5 text-[11px]"
              disabled={!techPackReady}
              onClick={() => goToStep('marker')}
            >
              Continue to marker →
            </ErpButton>
            {isComplete && (
              <Link to={`/samples?designId=${designId}&from=pattern`} className="erp-btn-primary inline-flex px-3 py-1.5 text-[11px]">
                Go to sampling →
              </Link>
            )}
          </div>
        </>
      )}

      {step === 'marker' && (
        <>
          <PatternMarkerPanel
            pd={pd}
            form={markerForm}
            onChange={(p) => setMarkerForm((f) => ({ ...f, ...p }))}
            onSave={() => saveMarkerMutation.mutate()}
            onUpload={(f) => uploadMarkerMutation.mutate(f)}
            saving={saveMarkerMutation.isPending}
            uploading={uploadMarkerMutation.isPending}
            readOnly={effectiveReadOnly}
            validationError={markerValidation}
          />
          {!effectiveReadOnly && (
            <ErpButton
              variant="secondary"
              className="mt-2 !px-4 !py-1.5 text-[11px]"
              disabled={!isStepComplete('marker', pd, techPack)}
              onClick={() => goToStep('grading')}
            >
              Continue to grading →
            </ErpButton>
          )}
        </>
      )}

      {step === 'grading' && (
        <>
          <PatternGradingPanel
            form={gradingForm}
            sizeLabels={techPack?.techPack?.sizeChartData?.sizeLabels ?? techPack?.design.sizeChartData?.sizeLabels ?? []}
            onChange={(p) => setGradingForm((f) => ({ ...f, ...p }))}
            onSave={() => saveGradingMutation.mutate()}
            saving={saveGradingMutation.isPending}
            readOnly={effectiveReadOnly}
          />
          <ErpButton
            variant="secondary"
            className="mt-2 !px-4 !py-1.5 text-[11px]"
            disabled={!isStepComplete('grading', pd, techPack)}
            onClick={() => goToStep('verify')}
          >
            Continue to sign-off →
          </ErpButton>
        </>
      )}

      {step === 'verify' && (
        <>
          <PatternVerificationPanel
            pd={pd}
            evidence={techPack?.evidence ?? pd.evidence}
            form={verifyForm}
            onChange={(p) => setVerifyForm((f) => ({ ...f, ...p }))}
            onSave={() => saveVerifyMutation.mutate()}
            onComplete={handleComplete}
            saving={saveVerifyMutation.isPending}
            completing={completeMutation.isPending}
            readOnly={effectiveReadOnly}
            completeBlockReason={completeBlockReason}
          />
          {isComplete && (
            <ErpCard className="mt-3 !p-3">
              <p className="mb-2 text-[11px] text-erp-text-primary">Next: create a fit or prototype sample.</p>
              <Link
                to={`/samples?designId=${designId}&from=pattern`}
                className="erp-btn-primary inline-flex px-3 py-1.5 text-[11px]"
              >
                Continue to sampling →
              </Link>
            </ErpCard>
          )}
        </>
      )}
    </div>
  );
}
