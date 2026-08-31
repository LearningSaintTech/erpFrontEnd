import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { designApi, patternApi } from '../../services/manufacturing';
import type { DesignAsset } from '../../types/api';
import { DesignFormProvider } from './DesignFormContext';
import {
  TAB_GROUPS, TabId, TabGroupId, designToFormState, formStateToPayload, fileToBase64, hasImageAsset,
  getWizardSteps, findWizardIndex,
  getDesignSubmitGaps, isReadyForSubmit, designSubmitHint, designTabProgress,
  type DesignFormState, emptyColor, defaultSizeChartData, defaultProductSpecs,
} from './designFormUtils';
import { BasicDetailsTab } from './tabs/BasicDetailsTab';
import { ProductSpecsTab } from './tabs/ProductSpecsTab';
import { ColorVariantsTab } from './tabs/ColorVariantsTab';
import { FilesTab } from './tabs/FilesTab';
import { SamplingTab } from './tabs/SamplingTab';
import { DesignReviewTab } from './tabs/DesignReviewTab';
import { VersionHistoryTab } from './tabs/VersionHistoryTab';
import { SkuMatrixTab } from './tabs/SkuMatrixTab';
import type { PendingUpload } from './DesignFormContext';
import { ErpButton, ErpPageHeader, ErpStatusBadge, ErpCard } from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import { hasPermission } from '../../utils/permissions';
import { canCreateDesign, canEditDesign, canShowDesignApproverUi, isDesignAdmin } from './designUtils';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { CommentPrompt } from '../approvals/components/CommentPrompt';
import { RevisionFeedbackBanner, RejectionFeedbackBanner } from './RevisionFeedbackBanner';
import { toErrorMessage } from '../../utils/errors';
import { DesignPipelineCard } from './components/DesignPipelineCard';
import { DesignWizardNav } from './components/DesignWizardNav';
import { DesignFormNav } from './components/DesignFormNav';
import { ApproverActionDropdown, type ApproverDecision } from './components/ApproverActionDropdown';
import { ReleasePatternMasterModal } from './components/ReleasePatternMasterModal';
import { buildDesignPipeline } from './designFlowUtils';

const emptyForm = (): DesignFormState => ({
  title: '',
  description: '',
  skuPrefix: '',
  styleNumber: '',
  category: '',
  subCategory: '',
  section: '',
  gender: '',
  ageGroup: '',
  fit: '',
  sleeveType: '',
  neckType: '',
  pattern: '',
  occasion: '',
  tags: [],
  collectionCode: '',
  seasonCode: '',
  collectionId: '',
  seasonId: '',
  sizeChartId: '',
  targetPrice: '',
  currency: 'INR',
  productSpecs: defaultProductSpecs(),
  colors: [emptyColor()],
  sizeChartData: defaultSizeChartData(),
});

function TabPanel({
  tab,
  active,
  onJumpTo,
}: {
  tab: TabId;
  active: TabId;
  onJumpTo?: (groupId: TabGroupId, tabId: TabId) => void;
}) {
  if (tab !== active) return null;
  const panels: Record<TabId, ReactNode> = {
    basic: <BasicDetailsTab />,
    specs: <ProductSpecsTab />,
    colors: <ColorVariantsTab />,
    files: <FilesTab />,
    sampling: <SamplingTab />,
    skus: <SkuMatrixTab />,
    review: <DesignReviewTab onJumpTo={onJumpTo} />,
    versions: <VersionHistoryTab />,
  };
  return <div>{panels[tab]}</div>;
}

export function DesignFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeGroup, setActiveGroup] = useState<TabGroupId>('overview');
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [form, setForm] = useState<DesignFormState>(emptyForm);
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewPrompt, setReviewPrompt] = useState<'reject' | 'revision' | null>(null);
  const [releasePrompt, setReleasePrompt] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const { data: lookups } = useQuery({ queryKey: ['design-lookups'], queryFn: designApi.getLookups });
  const { data: materials = [] } = useQuery({ queryKey: ['design-material-options'], queryFn: designApi.listMaterialOptions });
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: designApi.listCollections });
  const { data: seasons = [] } = useQuery({ queryKey: ['seasons'], queryFn: designApi.listSeasons });

  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const isAdmin = isDesignAdmin(permissions, isSuperAdmin);
  const canCreate = canCreateDesign(permissions, isSuperAdmin);
  const canRead = hasPermission(permissions, 'design.read', isSuperAdmin) || isAdmin;
  // Approver UI: review-only admins — never designers (create/update authors)
  const showApproverActions = canShowDesignApproverUi(permissions, isSuperAdmin);
  const canPattern = !isAdmin && hasPermission(permissions, 'pattern.read', isSuperAdmin);
  const canSample = !isAdmin && hasPermission(permissions, 'sampling.read', isSuperAdmin);

  const { data: design, isLoading } = useQuery({
    queryKey: ['design', id],
    queryFn: () => designApi.get(id!),
    enabled: isEdit,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ['design-versions', id],
    queryFn: () => designApi.getVersions(id!),
    enabled: isEdit,
  });

  const { data: samples = [] } = useQuery({
    queryKey: ['design-samples', id],
    queryFn: () => designApi.getSamples(id!),
    enabled: isEdit,
  });

  const showPipeline = isEdit && design
    && !['DRAFT', 'REVISION_REQUESTED'].includes(design.status)
    && (showApproverActions || design.status !== 'IN_REVIEW');

  const { data: patternDev } = useQuery({
    queryKey: ['pattern-development', id],
    queryFn: () => patternApi.get(id!),
    enabled: showPipeline && (design?.status === 'RELEASED' || samples.length > 0),
    retry: false,
  });

  const pipelineSteps = useMemo(
    () => (design && id ? buildDesignPipeline(design, patternDev ?? null, samples, id, {
      canApprove: false,
      canPattern: !isAdmin && canPattern,
      canSample: !isAdmin && canSample,
    }) : []),
    [design, patternDev, samples, id, isAdmin, canPattern, canSample],
  );

  useEffect(() => {
    if (!design) return;
    setForm(designToFormState(design));
    setAssets(design.assets || []);
  }, [design]);

  const editable = !isAdmin && (isEdit
    ? canEditDesign(permissions, isSuperAdmin, design?.status)
    : canCreate);

  const wizardSteps = useMemo(
    () => getWizardSteps({ includeHistory: isEdit && !editable }),
    [isEdit, editable],
  );

  const wizardIndex = findWizardIndex(wizardSteps, activeGroup, activeTab);
  const currentWizardStep = wizardSteps[wizardIndex] ?? wizardSteps[0];
  const isLastWizardStep = wizardIndex >= wizardSteps.length - 1;
  const isReviewStep = activeTab === 'review';

  const goToWizardStep = (index: number) => {
    const step = wizardSteps[index];
    if (!step) return;
    setActiveGroup(step.groupId);
    setActiveTab(step.tabId);
  };

  const jumpToSection = (groupId: TabGroupId, tabId: TabId) => {
    setActiveGroup(groupId);
    setActiveTab(tabId);
  };

  const imageOk = hasImageAsset(assets) || pendingUploads.some((p) =>
    ['FRONT_IMAGE', 'BACK_IMAGE', 'SIDE_IMAGE', 'ZOOM_IMAGE', 'TECHNICAL_SKETCH', 'IMAGE', 'SKETCH'].includes(p.assetType),
  );
  const submitGaps = getDesignSubmitGaps({ hasImage: imageOk, sizeChartData: form.sizeChartData });
  const canSubmit = isReadyForSubmit(submitGaps);
  const submitHint = designSubmitHint(submitGaps);

  const visibleGroups = useMemo(
    () => TAB_GROUPS.filter((g) => {
      if (g.id === 'history') return isEdit;
      if (g.id === 'submit') return editable || (!isAdmin && activeGroup === 'submit');
      return true;
    }),
    [isEdit, editable, isAdmin, activeGroup],
  );

  const tabProgress = useMemo(() => {
    const map: Partial<Record<TabId, ReturnType<typeof designTabProgress>>> = {};
    for (const g of TAB_GROUPS) {
      for (const t of g.tabs) {
        map[t.id as TabId] = designTabProgress(t.id as TabId, form, { hasImage: imageOk });
      }
    }
    return map;
  }, [form, imageOk]);

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) => designApi.deleteAsset(id!, assetId),
    onSuccess: (_, assetId) => setAssets((prev) => prev.filter((a) => a._id !== assetId)),
  });

  const uploadPending = async (designId: string) => {
    for (const pf of pendingUploads) {
      const contentBase64 = await fileToBase64(pf.file);
      const asset = await designApi.uploadAsset(designId, {
        fileName: pf.file.name,
        mimeType: pf.file.type || 'application/octet-stream',
        contentBase64,
        assetType: pf.assetType,
      });
      setAssets((prev) => [...prev.filter((a) => a.assetType !== pf.assetType), asset]);
    }
    setPendingUploads([]);
  };

  const saveMutation = useMutation({
    mutationFn: async (andSubmit: boolean) => {
      setError('');
      const payload = formStateToPayload(form);
      if (!payload.title) throw new Error('Title is required');
      if (!payload.collectionCode) throw new Error('Collection is required');
      if (!payload.styleNumber?.trim()) throw new Error('Style number is required');
      if (andSubmit && !canSubmit) {
        throw new Error(submitHint || 'Design is not ready for submit');
      }

      let savedId = id;
      if (isEdit && id) {
        await designApi.update(id, payload);
      } else {
        const created = await designApi.create(payload);
        savedId = created._id;
      }
      if (savedId && pendingUploads.length) await uploadPending(savedId);
      if (andSubmit && savedId) await designApi.submit(savedId);
      return { savedId, andSubmit };
    },
    onSuccess: ({ savedId, andSubmit }) => {
      qc.invalidateQueries({ queryKey: ['designs-page'] });
      qc.invalidateQueries({ queryKey: ['designs'] });
      qc.invalidateQueries({ queryKey: ['design-stats'] });
      if (savedId) {
        qc.invalidateQueries({ queryKey: ['design', savedId] });
        qc.invalidateQueries({ queryKey: ['design-versions', savedId] });
        qc.invalidateQueries({ queryKey: ['design-timeline', savedId] });
      }
      if (andSubmit) {
        showSuccess('Design submitted for approval');
        qc.invalidateQueries({ queryKey: ['approvals-pending'] });
        qc.invalidateQueries({ queryKey: ['notifications-unread'] });
        navigate('/designs');
      } else {
        showSuccess('Draft saved');
        if (!isEdit && savedId) navigate(`/designs/${savedId}/edit`);
        else if (id) qc.invalidateQueries({ queryKey: ['design', id] });
      }
    },
    onError: (e: unknown) => setError(toErrorMessage(e) || 'Save failed'),
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (vars: { action: 'approve' | 'release'; patternMasterId?: string }) => {
      if (!id) throw new Error('No design id');
      if (vars.action === 'approve') return designApi.approve(id);
      return designApi.release(id, { patternMasterId: vars.patternMasterId });
    },
    onSuccess: (_, vars) => {
      if (vars.action === 'release') setReleasePrompt(false);
      qc.invalidateQueries({ queryKey: ['design', id] });
      qc.invalidateQueries({ queryKey: ['design-timeline', id] });
      qc.invalidateQueries({ queryKey: ['designs-page'] });
      qc.invalidateQueries({ queryKey: ['design-stats'] });
      qc.invalidateQueries({ queryKey: ['approvals-pending'] });
      qc.invalidateQueries({ queryKey: ['approvals-stats'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications-recent'] });
      showSuccess(vars.action === 'approve' ? 'Design approved' : 'Design released and assigned to pattern master');
      if (vars.action === 'release') {
        qc.invalidateQueries({ queryKey: ['pattern-development', id] });
        qc.invalidateQueries({ queryKey: ['pattern-developments'] });
        qc.invalidateQueries({ queryKey: ['pattern-stats'] });
        qc.invalidateQueries({ queryKey: ['designs-released'] });
      }
      if (vars.action === 'approve') navigate('/designs');
    },
    onError: (e: unknown) => setError(toErrorMessage(e) || 'Action failed'),
  });

  const reviewMutation = useMutation({
    mutationFn: (comments: string) => {
      if (!id || !reviewPrompt) throw new Error('No design');
      return reviewPrompt === 'reject' ? designApi.reject(id, comments) : designApi.revision(id, comments);
    },
    onSuccess: () => {
      const action = reviewPrompt;
      setReviewPrompt(null);
      qc.invalidateQueries({ queryKey: ['design', id] });
      qc.invalidateQueries({ queryKey: ['design-timeline', id] });
      qc.invalidateQueries({ queryKey: ['designs-page'] });
      qc.invalidateQueries({ queryKey: ['design-stats'] });
      qc.invalidateQueries({ queryKey: ['approvals-pending'] });
      qc.invalidateQueries({ queryKey: ['approvals-stats'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications-recent'] });
      showSuccess(action === 'reject' ? 'Design rejected' : 'Revision requested');
      navigate('/designs');
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const ctxValue = {
    form,
    setForm,
    editable,
    design,
    designId: id,
    materials,
    lookups,
    collections,
    seasons,
    assets,
    setAssets,
    pendingUploads,
    setPendingUploads,
    versions,
    samples,
    onDeleteAsset: (assetId: string) => deleteAssetMutation.mutate(assetId),
  };

  if (!isEdit && !canCreate) return <Navigate to="/designs" replace />;
  if (isEdit && !canRead && !editable) {
    return <Navigate to="/designs" replace />;
  }

  if (isEdit && isLoading) return <p className="p-4 text-[11px] text-erp-text-muted">Loading design…</p>;

  return (
    <DesignFormProvider value={ctxValue}>
      <div className="design-form-page mx-auto max-w-6xl text-xs leading-snug">
        <AlertBanner message={error} onDismiss={() => setError('')} />
        <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

        <ErpPageHeader
          title={isEdit ? (design?.title || 'Design') : 'New design tech pack'}
          subtitle={(
            <>
              <Link to="/designs" className="text-[var(--erp-accent)]">← Design library</Link>
              {design && (
                <span className="ml-2 font-mono text-[10px] text-erp-text-muted">{design.designCode}</span>
              )}
              {editable && (
                <span className="ml-2 text-[10px] text-erp-text-muted">Designer workspace — edit and use Next through each section</span>
              )}
              {isAdmin && (
                <span className="ml-2 text-[10px] text-erp-text-muted">Admin view — details only; use review decision below</span>
              )}
              {!editable && !isAdmin && design?.status === 'IN_REVIEW' && (
                <span className="ml-2 text-[10px] text-erp-text-muted">Submitted — waiting for review</span>
              )}
              {editable && (design?.status === 'DRAFT' || design?.status === 'REVISION_REQUESTED') && (
                <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700">
                  Editable
                </span>
              )}
            </>
          )}
          actions={
            design ? (
              <div className="flex items-center gap-2">
                <ErpStatusBadge status={design.status} />
                <span className="text-[10px] text-erp-text-muted">v{design.currentVersion ?? 1}</span>
              </div>
            ) : undefined
          }
        />

        {design?.status === 'REVISION_REQUESTED' && design.revisionComments && (
          <RevisionFeedbackBanner comments={design.revisionComments} />
        )}

        {design?.status === 'REJECTED' && design.rejectionComments && (
          <RejectionFeedbackBanner comments={design.rejectionComments} />
        )}

        {showPipeline && pipelineSteps.length > 0 && (
          <DesignPipelineCard steps={pipelineSteps} />
        )}

        {design && !editable && (
          <ErpCard className="mb-3 !border-amber-500/30 !bg-amber-500/5 !p-3">
            <p className="text-[11px]" style={{ color: 'var(--erp-warning-text)' }}>
              {isAdmin
                ? (
                  <>
                    Read-only details.
                    {design.status === 'IN_REVIEW' && ' Choose Approve, Request revision, or Reject below.'}
                    {design.status === 'APPROVED' && ' Release below when ready for pattern development.'}
                  </>
                )
                : design.status === 'IN_REVIEW'
                  ? 'This design is submitted for review. You cannot edit it until an admin requests a revision or it is returned.'
                  : (
                    <>
                      This design is locked while in <strong>{design.status.replace(/_/g, ' ')}</strong>.
                    </>
                  )}
            </p>
          </ErpCard>
        )}

        <DesignFormNav
          groups={visibleGroups}
          activeGroup={activeGroup}
          activeTab={activeTab}
          progress={tabProgress}
          onGroupChange={(gid) => {
            const group = TAB_GROUPS.find((g) => g.id === gid);
            setActiveGroup(gid);
            if (group?.tabs[0]) setActiveTab(group.tabs[0].id as TabId);
          }}
          onTabChange={(tid) => setActiveTab(tid)}
        />

        <ErpCard className="!p-4">
          <TabPanel tab={activeTab} active={activeTab} onJumpTo={jumpToSection} />
        </ErpCard>

        <DesignWizardNav
          stepIndex={wizardIndex}
          stepCount={wizardSteps.length}
          groupLabel={currentWizardStep?.groupLabel ?? ''}
          tabLabel={currentWizardStep?.tabLabel ?? ''}
          canGoBack={wizardIndex > 0}
          canGoNext={!isLastWizardStep}
          isLast={isLastWizardStep || isReviewStep}
          editable={editable && !isAdmin}
          saving={saveMutation.isPending}
          canSubmit={canSubmit}
          submitHint={submitHint || undefined}
          nextLabel={wizardSteps[wizardIndex + 1]?.tabId === 'review' ? 'Go to check & submit' : undefined}
          onBack={() => goToWizardStep(wizardIndex - 1)}
          onNext={() => goToWizardStep(wizardIndex + 1)}
          onSaveDraft={() => saveMutation.mutate(false)}
          onSubmit={() => saveMutation.mutate(true)}
        />

        {showApproverActions && design && (design.status === 'IN_REVIEW' || design.status === 'APPROVED') && (
          <ErpCard className="mt-3 !p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Review decision</p>
            <ApproverActionDropdown
              allowed={showApproverActions}
              status={design.status}
              disabled={lifecycleMutation.isPending || reviewMutation.isPending}
              loading={lifecycleMutation.isPending || reviewMutation.isPending}
              onDecide={(decision: ApproverDecision) => {
                if (decision === 'approve') {
                  lifecycleMutation.mutate({ action: 'approve' });
                  return;
                }
                if (decision === 'release') {
                  setReleasePrompt(true);
                  return;
                }
                setReviewPrompt(decision);
              }}
            />
          </ErpCard>
        )}

        {!isAdmin && design?.status === 'RELEASED' && canPattern && (
          <ErpCard className="mt-3 !p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Next step</p>
            <Link to={`/pattern?designId=${id}`} className="erp-btn-primary inline-flex items-center px-3 py-1.5 text-[11px]">
              Continue to pattern development →
            </Link>
          </ErpCard>
        )}

        {showApproverActions && (
          <>
            <CommentPrompt
              open={!!reviewPrompt}
              title={reviewPrompt === 'reject' ? 'Reject design' : 'Request revision'}
              message="Comments are required so the designer knows what to fix."
              required
              minLength={3}
              confirmLabel={reviewPrompt === 'reject' ? 'Reject' : 'Send back'}
              loading={reviewMutation.isPending}
              onCancel={() => setReviewPrompt(null)}
              onConfirm={(comments) => reviewMutation.mutate(comments)}
            />
            <ReleasePatternMasterModal
              open={releasePrompt}
              designLabel={design ? `${design.designCode} — ${design.title}` : undefined}
              loading={lifecycleMutation.isPending}
              onCancel={() => setReleasePrompt(false)}
              onConfirm={(patternMasterId) => lifecycleMutation.mutate({ action: 'release', patternMasterId })}
            />
          </>
        )}
      </div>
    </DesignFormProvider>
  );
}
