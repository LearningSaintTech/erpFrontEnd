import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban, CheckCircle2, ChevronLeft, ChevronRight, Copy, MessageSquareWarning, Rocket, Ruler, Send,
} from 'lucide-react';
import { designApi, patternApi, skuApi } from '../../services/manufacturing';
import type { DesignAsset } from '../../types/api';
import { DesignFormProvider, type DesignFieldErrors } from './DesignFormContext';
import {
  TAB_GROUPS, TabId, TabGroupId, designToFormState, formStateToPayload, fileToBase64, hasImageAsset,
  getDesignSubmitGaps, isReadyForSubmit, designSubmitHint, designTabProgress,
  type DesignFormState, emptyColor, defaultSizeChartData, defaultProductSpecs, designerName,
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
import {
  Button, IconButton, PageHeader, Section, Skeleton, StatusBadge, Tooltip, toast,
} from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import { hasPermission } from '../../utils/permissions';
import { canCreateDesign, canEditDesign, canShowDesignApproverUi, isDesignAdmin } from './designUtils';
import { RevisionFeedbackBanner, RejectionFeedbackBanner } from './RevisionFeedbackBanner';
import { DesignFormNav } from './components/DesignFormNav';
import { DesignLifecycle } from './components/DesignLifecycle';
import { StickyActionBar, SaveState, Completeness } from './components/StickyActionBar';
import { buildDesignPipeline } from './designFlowUtils';
import { useDesignDecisions } from './useDesignDecisions';

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

const REQUIRED_SECTIONS: TabId[] = ['basic', 'files', 'colors', 'skus'];
const IMAGE_TYPES = ['FRONT_IMAGE', 'BACK_IMAGE', 'SIDE_IMAGE', 'ZOOM_IMAGE', 'TECHNICAL_SKETCH', 'IMAGE', 'SKETCH'];

function TabPanel({ tab, onJumpTo }: { tab: TabId; onJumpTo?: (groupId: TabGroupId, tabId: TabId) => void }) {
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
  return <>{panels[tab]}</>;
}

export function DesignFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeGroup, setActiveGroup] = useState<TabGroupId>('overview');
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [form, setForm] = useState<DesignFormState>(emptyForm);
  const [baseline, setBaseline] = useState(() => JSON.stringify(emptyForm()));
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [errors, setErrors] = useState<DesignFieldErrors>({});

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
  const canPattern = hasPermission(permissions, 'pattern.read', isSuperAdmin);
  const canSample = hasPermission(permissions, 'sampling.read', isSuperAdmin);
  const canSku = hasPermission(permissions, 'sku.read', isSuperAdmin);

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

  const { data: patternDev } = useQuery({
    queryKey: ['pattern-development', id],
    queryFn: () => patternApi.get(id!),
    enabled: isEdit && (design?.status === 'RELEASED' || samples.length > 0),
    retry: false,
  });

  const sampleApproved = samples.some((s) => s.status === 'APPROVED');
  const { data: skuCount } = useQuery({
    queryKey: ['skus', 'design-count', id],
    queryFn: async () => (await skuApi.listPage({ designId: id, limit: 1 })).meta?.total ?? 0,
    enabled: isEdit && canSku && sampleApproved,
  });
  const { data: activeBomSkuCount } = useQuery({
    queryKey: ['skus', 'design-active-bom-count', id],
    queryFn: async () => (await skuApi.listPage({ designId: id, hasActiveBom: true, limit: 1 })).meta?.total ?? 0,
    enabled: isEdit && canSku && !!skuCount,
  });

  const pipelineSteps = useMemo(
    () => (design && id ? buildDesignPipeline(design, patternDev ?? null, samples, id, {
      canApprove: false,
      canPattern,
      canSample,
      skuCount,
      activeBomSkuCount,
    }) : []),
    [design, patternDev, samples, id, canPattern, canSample, skuCount, activeBomSkuCount],
  );

  useEffect(() => {
    if (!design) return;
    const next = designToFormState(design);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setAssets(design.assets || []);
  }, [design]);

  const editable = !isAdmin && (isEdit
    ? canEditDesign(permissions, isSuperAdmin, design?.status)
    : canCreate);

  const dirty = editable && (JSON.stringify(form) !== baseline || pendingUploads.length > 0);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const visibleGroups = useMemo(
    () => TAB_GROUPS.filter((g) => {
      if (g.id === 'history') return isEdit;
      if (g.id === 'submit') return editable;
      return true;
    }),
    [isEdit, editable],
  );

  const order = useMemo(
    () => visibleGroups.flatMap((g) => g.tabs.map((t) => ({ groupId: g.id as TabGroupId, tabId: t.id as TabId, label: t.label }))),
    [visibleGroups],
  );
  const orderIndex = Math.max(0, order.findIndex((o) => o.tabId === activeTab));
  const prevStep = order[orderIndex - 1];
  const nextStep = order[orderIndex + 1];

  const jumpToSection = (groupId: TabGroupId, tabId: TabId) => {
    setActiveGroup(groupId);
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const imageOk = hasImageAsset(assets) || pendingUploads.some((p) => IMAGE_TYPES.includes(p.assetType));
  const submitGaps = getDesignSubmitGaps({ hasImage: imageOk, sizeChartData: form.sizeChartData });
  const canSubmit = isReadyForSubmit(submitGaps);
  const submitHint = designSubmitHint(submitGaps);

  const tabProgress = useMemo(() => {
    const map: Partial<Record<TabId, ReturnType<typeof designTabProgress>>> = {};
    for (const g of TAB_GROUPS) {
      for (const t of g.tabs) {
        map[t.id as TabId] = designTabProgress(t.id as TabId, form, { hasImage: imageOk });
      }
    }
    return map;
  }, [form, imageOk]);
  const sectionsDone = REQUIRED_SECTIONS.filter((t) => tabProgress[t] === 'done').length;

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) => designApi.deleteAsset(id!, assetId),
    meta: { successMessage: 'Image removed' },
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
      const payload = formStateToPayload(form);
      if (andSubmit && !canSubmit) throw new Error(submitHint || 'Design is not ready to submit.');

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
        toast.success('Submitted for review', { description: 'Your design manager has been notified.' });
        qc.invalidateQueries({ queryKey: ['approvals-pending'] });
        qc.invalidateQueries({ queryKey: ['notifications-unread'] });
        setBaseline(JSON.stringify(form));
        // Drop the cached list so the page opens on fresh rows — not the pre-submit status
        // flashing next to the "Submitted" toast.
        qc.removeQueries({ queryKey: ['designs-page'] });
        qc.removeQueries({ queryKey: ['design-stats'] });
        navigate('/designs');
      } else {
        toast.success(isEdit ? 'Draft saved' : 'Design created', isEdit ? undefined : { description: 'Keep going — add images, colours and sizes.' });
        setBaseline(JSON.stringify(form));
        if (!isEdit && savedId) navigate(`/designs/${savedId}/edit`, { replace: true });
      }
    },
  });

  const cloneMutation = useMutation({
    mutationFn: () => designApi.clone(id!),
    meta: { successMessage: 'Design cloned', successDescription: 'Opening the new draft.' },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['designs-page'] });
      qc.invalidateQueries({ queryKey: ['design-stats'] });
      if (created?._id) navigate(`/designs/${created._id}/edit`);
    },
  });

  const decisions = useDesignDecisions({
    onDone: (decision) => {
      if (decision !== 'release') {
        qc.removeQueries({ queryKey: ['designs-page'] });
        qc.removeQueries({ queryKey: ['design-stats'] });
        navigate('/designs');
      }
    },
  });

  const validate = () => {
    const next: DesignFieldErrors = {};
    if (!form.title.trim()) next.title = 'Enter a title for this style.';
    if (!form.styleNumber.trim()) next.styleNumber = 'Enter the style number, e.g. STY-001.';
    if (!form.collectionCode) next.collectionCode = 'Choose the collection this style belongs to.';
    setErrors(next);
    if (Object.keys(next).length) {
      jumpToSection('overview', 'basic');
      toast.error('Some required details are missing', { description: 'Fill in the highlighted fields in Basic details.' });
      return false;
    }
    return true;
  };

  const save = (andSubmit: boolean) => {
    if (!validate()) return;
    if (andSubmit && !canSubmit) {
      toast.warning(submitHint);
      if (submitGaps.image) jumpToSection('overview', 'files');
      else if (submitGaps.sizeRange) jumpToSection('variants', 'skus');
      return;
    }
    saveMutation.mutate(andSubmit);
  };

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
    errors,
    clearError: (key: keyof DesignFieldErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e)),
  };

  if (!isEdit && !canCreate) return <Navigate to="/designs" replace />;
  if (isEdit && !canRead && !editable) return <Navigate to="/designs" replace />;

  if (isEdit && isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton height={28} width="40%" />
        <Skeleton height={14} width="60%" />
        <Skeleton height={64} />
        <Skeleton height={320} />
      </div>
    );
  }

  const status = design?.status ?? 'DRAFT';
  const designerLabel = design ? designerName(design.createdBy) : '';
  const description = !isEdit
    ? 'Describe the new style, add images and pick the size range, then submit it for review.'
    : editable
      ? status === 'REVISION_REQUESTED'
        ? 'Update the tech pack using the feedback below, then resubmit.'
        : 'Complete each section, then submit the tech pack for review.'
      : showApproverActions && status === 'IN_REVIEW'
        ? `Submitted by ${designerLabel}. Review the tech pack and make a decision.`
        : 'Tech pack for this style.';

  const navButtons = (
    <>
      <IconButton
        aria-label={prevStep ? `Previous: ${prevStep.label}` : 'Previous section'}
        outlined
        className="hidden sm:inline-flex"
        disabled={!prevStep}
        onClick={() => prevStep && jumpToSection(prevStep.groupId, prevStep.tabId)}
      >
        <ChevronLeft size={16} />
      </IconButton>
      <IconButton
        aria-label={nextStep ? `Next: ${nextStep.label}` : 'Next section'}
        outlined
        className="hidden sm:inline-flex"
        disabled={!nextStep}
        onClick={() => nextStep && jumpToSection(nextStep.groupId, nextStep.tabId)}
      >
        <ChevronRight size={16} />
      </IconButton>
    </>
  );

  let barStatus: ReactNode = null;
  let barActions: ReactNode = null;

  if (editable) {
    barStatus = (
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <SaveState dirty={dirty} saving={saveMutation.isPending} savedLabel={isEdit ? 'All changes saved' : 'Not saved yet'} />
        <Completeness done={sectionsDone} total={REQUIRED_SECTIONS.length} />
      </span>
    );
    const submitButton = (
      <Button
        icon={<Send size={16} />}
        disabled={saveMutation.isPending || !canSubmit}
        loading={saveMutation.isPending && saveMutation.variables === true}
        onClick={() => save(true)}
      >
        {status === 'REVISION_REQUESTED' ? 'Resubmit for review' : 'Submit for review'}
      </Button>
    );
    barActions = (
      <>
        {navButtons}
        <Button
          variant="secondary"
          loading={saveMutation.isPending && saveMutation.variables === false}
          disabled={saveMutation.isPending || (isEdit && !dirty)}
          onClick={() => save(false)}
        >
          {isEdit ? 'Save draft' : 'Create draft'}
        </Button>
        {canSubmit ? submitButton : <Tooltip content={submitHint}><span>{submitButton}</span></Tooltip>}
      </>
    );
  } else if (showApproverActions && design && status === 'IN_REVIEW') {
    barStatus = 'Approve to move on to release, or send it back with comments.';
    barActions = (
      <>
        {navButtons}
        <Button variant="danger" icon={<Ban size={16} />} disabled={decisions.pending} onClick={() => decisions.reject(design)}>Reject</Button>
        <Button variant="secondary" icon={<MessageSquareWarning size={16} />} disabled={decisions.pending} onClick={() => decisions.requestRevision(design)}>
          Request revision
        </Button>
        <Button icon={<CheckCircle2 size={16} />} loading={decisions.approving} disabled={decisions.pending} onClick={() => decisions.approve(design)}>
          Approve
        </Button>
      </>
    );
  } else if (showApproverActions && design && status === 'APPROVED') {
    barStatus = 'Approved. Release it to hand the tech pack to a pattern master.';
    barActions = (
      <>
        {navButtons}
        <Button icon={<Rocket size={16} />} disabled={decisions.pending} onClick={() => decisions.openRelease(design)}>Release to pattern</Button>
      </>
    );
  } else if (design && status === 'RELEASED') {
    barStatus = `Released as v${design.releasedVersion ?? design.currentVersion ?? 1}. The tech pack is locked.`;
    barActions = (
      <>
        {navButtons}
        {canPattern && (
          <Button icon={<Ruler size={16} />} onClick={() => navigate(`/pattern?designId=${id}`)}>Open pattern workspace</Button>
        )}
      </>
    );
  } else if (design && status === 'REJECTED' && canCreate) {
    barStatus = 'This design was rejected. Clone it to start a new draft.';
    barActions = (
      <>
        {navButtons}
        <Button icon={<Copy size={16} />} loading={cloneMutation.isPending} onClick={() => cloneMutation.mutate()}>Clone as new draft</Button>
      </>
    );
  } else {
    barStatus = status === 'IN_REVIEW'
      ? 'Submitted for review. You can edit again if it is sent back.'
      : status === 'APPROVED'
        ? 'Approved — waiting to be released to pattern.'
        : 'Read-only.';
    barActions = navButtons;
  }

  return (
    <DesignFormProvider value={ctxValue}>
      <div className="design-form-page mx-auto max-w-7xl">
        <PageHeader
          title={isEdit ? (design?.title || 'Design') : 'New design'}
          description={description}
          meta={design ? (
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-erp-text-muted">
              <StatusBadge status={status} />
              <span className="font-mono">{design.designCode}</span>
              <span>v{design.currentVersion ?? 1}</span>
              {design.styleNumber && <span className="font-mono">· {design.styleNumber}</span>}
            </span>
          ) : undefined}
        />

        {isEdit && design && pipelineSteps.length > 0 && (
          <Section className="mb-4">
            <DesignLifecycle steps={pipelineSteps} designStatus={status} />
          </Section>
        )}

        {status === 'REVISION_REQUESTED' && design?.revisionComments && (
          <RevisionFeedbackBanner comments={design.revisionComments} />
        )}
        {status === 'REJECTED' && design?.rejectionComments && (
          <RejectionFeedbackBanner comments={design.rejectionComments} />
        )}

        <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
          <DesignFormNav
            groups={visibleGroups}
            activeTab={activeTab}
            progress={tabProgress}
            showProgress={editable}
            onSelect={jumpToSection}
          />
          <div className="min-w-0" key={activeGroup + activeTab}>
            <TabPanel tab={activeTab} onJumpTo={jumpToSection} />
          </div>
        </div>

        <StickyActionBar status={barStatus}>{barActions}</StickyActionBar>

        {showApproverActions && decisions.releaseModal}
      </div>
    </DesignFormProvider>
  );
}
