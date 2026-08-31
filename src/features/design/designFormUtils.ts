import type {
  Design, ColorVariant, ProductSpecs, SizeChartData, DesignAsset,
} from '../../types/api';
import type { DesignPayload } from '../../services/manufacturing';

export const DEFAULT_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'];

/**
 * Designer scope only. Trims, costing, quality, sewing instructions, and production
 * planning are downstream decisions and live in the pattern master's tech pack.
 */
export const TAB_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Style identity, specs, and images',
    tabs: [
      { id: 'basic', label: 'Basic details', hint: 'Name, category, collection' },
      { id: 'specs', label: 'Product specs', hint: 'Fabric intent & print' },
      { id: 'files', label: 'Files', hint: 'Front image or sketch' },
    ],
  },
  {
    id: 'variants',
    label: 'Variants & SKUs',
    description: 'Colorways and size range for SKUs',
    tabs: [
      { id: 'colors', label: 'Colors', hint: 'Colorways on the style' },
      { id: 'skus', label: 'Sizes & SKUs', hint: 'Size range for this style' },
    ],
  },
  {
    id: 'submit',
    label: 'Check & submit',
    description: 'Review the pack, then send for approval',
    tabs: [{ id: 'review', label: 'Review', hint: 'Confirm required fields' }],
  },
  {
    id: 'history',
    label: 'Track',
    description: 'Pattern, sampling, and version history',
    tabs: [
      { id: 'sampling', label: 'Pattern & sampling', hint: 'Downstream status' },
      { id: 'versions', label: 'History', hint: 'What changed' },
    ],
  },
] as const;

export type TabGroupId = (typeof TAB_GROUPS)[number]['id'];

export const TABS = [
  { id: 'basic', label: 'Basic Details' },
  { id: 'specs', label: 'Product Specs' },
  { id: 'colors', label: 'Colors & Variants' },
  { id: 'skus', label: 'Sizes & SKUs' },
  { id: 'files', label: 'Files' },
  { id: 'sampling', label: 'Pattern & sampling' },
  { id: 'review', label: 'Check & submit' },
  { id: 'versions', label: 'History' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export type WizardStep = {
  groupId: TabGroupId;
  groupLabel: string;
  tabId: TabId;
  tabLabel: string;
};

/** Flat create/edit wizard order across main groups and sub-tabs. Ends with Full review. */
export function getWizardSteps(opts: { includeHistory?: boolean } = {}): WizardStep[] {
  const steps: WizardStep[] = [];
  for (const group of TAB_GROUPS) {
    if (!opts.includeHistory && group.id === 'history') continue;
    for (const tab of group.tabs) {
      steps.push({
        groupId: group.id,
        groupLabel: group.label,
        tabId: tab.id as TabId,
        tabLabel: tab.label,
      });
    }
  }
  return steps;
}

export function findWizardIndex(steps: WizardStep[], groupId: TabGroupId, tabId: TabId) {
  const idx = steps.findIndex((s) => s.groupId === groupId && s.tabId === tabId);
  return idx >= 0 ? idx : 0;
}

export const FILE_SLOTS: { type: string; label: string; accept?: string; hint?: string }[] = [
  { type: 'FRONT_IMAGE', label: 'Front', accept: 'image/*', hint: 'Required for submit (or a sketch)' },
  { type: 'TECHNICAL_SKETCH', label: 'Technical sketch', accept: 'image/*', hint: 'Flat the pattern room cuts from' },
  { type: 'BACK_IMAGE', label: 'Back', accept: 'image/*' },
  { type: 'SIDE_IMAGE', label: 'Side', accept: 'image/*' },
];

export function emptyColor(): ColorVariant {
  return { name: '', hexCode: '#D30000', pantoneCode: '', code: '', status: 'PENDING' };
}

/** Designers pick the size range only; the graded measurement chart belongs to the pattern master. */
export function defaultSizeChartData(): SizeChartData {
  return { unit: 'INCHES', sizeLabels: [], rows: [] };
}

export function defaultProductSpecs(): ProductSpecs {
  return { embroidery: false };
}

function catalogCode(
  populated: string | { _id?: string; code?: string; name?: string } | undefined,
  stored?: string,
) {
  if (stored) return stored;
  if (!populated) return '';
  if (typeof populated === 'string') return populated;
  return populated.code || populated.name || '';
}

export function refId(val: string | { _id?: string } | undefined): string {
  if (!val) return '';
  return typeof val === 'string' ? val : val._id || '';
}

export function designerName(createdBy: Design['createdBy']): string {
  if (!createdBy || typeof createdBy === 'string') return '—';
  const n = `${createdBy.firstName} ${createdBy.lastName}`.trim();
  return n || createdBy.email || '—';
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function hasImageAsset(assets: DesignAsset[]): boolean {
  const imageTypes = ['FRONT_IMAGE', 'BACK_IMAGE', 'SIDE_IMAGE', 'ZOOM_IMAGE', 'TECHNICAL_SKETCH', 'IMAGE', 'SKETCH'];
  return assets.some((a) => imageTypes.includes(a.assetType));
}

/**
 * Designer-side submit rules. Graded measurements, fabric consumption, and BOM are
 * filled by the pattern master after release, so they are not checked here.
 */
export type DesignSubmitGaps = {
  image: boolean;
  sizeRange: boolean;
};

export function getDesignSubmitGaps(input: {
  hasImage: boolean;
  sizeChartData?: { sizeLabels?: string[] } | null;
}): DesignSubmitGaps {
  return {
    image: !input.hasImage,
    sizeRange: !input.sizeChartData?.sizeLabels?.length,
  };
}

export function isReadyForSubmit(gaps: DesignSubmitGaps): boolean {
  return !gaps.image && !gaps.sizeRange;
}

export function designSubmitHint(gaps: DesignSubmitGaps): string {
  const missing: string[] = [];
  if (gaps.image) missing.push('an image in Files');
  if (gaps.sizeRange) missing.push('a size range in Sizes & SKUs');
  if (!missing.length) return '';
  return `Add ${missing.join(' and ')} before submit`;
}

export type DesignTabProgress = 'done' | 'needed' | 'optional';

export function designTabProgress(
  tabId: TabId,
  form: DesignFormState,
  opts: { hasImage: boolean },
): DesignTabProgress {
  switch (tabId) {
    case 'basic':
      return form.title.trim() && form.styleNumber.trim() && form.category && form.collectionCode
        ? 'done'
        : 'needed';
    case 'files':
      return opts.hasImage ? 'done' : 'needed';
    case 'colors':
      return form.colors.some((c) => (c.code || c.name || '').trim()) ? 'done' : 'needed';
    case 'skus':
      return (form.sizeChartData?.sizeLabels?.length ?? 0) > 0 ? 'done' : 'needed';
    case 'review':
      return isReadyForSubmit(getDesignSubmitGaps({
        hasImage: opts.hasImage,
        sizeChartData: form.sizeChartData,
      })) ? 'done' : 'needed';
    default:
      return 'optional';
  }
}

export interface DesignFormState {
  title: string;
  description: string;
  skuPrefix: string;
  styleNumber: string;
  category: string;
  subCategory: string;
  section: string;
  gender: string;
  ageGroup: string;
  fit: string;
  sleeveType: string;
  neckType: string;
  pattern: string;
  occasion: string;
  tags: string[];
  collectionCode: string;
  seasonCode: string;
  collectionId: string;
  seasonId: string;
  sizeChartId: string;
  targetPrice: string;
  currency: string;
  productSpecs: ProductSpecs;
  colors: ColorVariant[];
  sizeChartData: SizeChartData;
}

export function designToFormState(design: Design): DesignFormState {
  return {
    title: design.title,
    description: design.description || '',
    skuPrefix: design.skuPrefix || '',
    styleNumber: design.styleNumber || '',
    category: design.category || '',
    subCategory: design.subCategory || '',
    section: design.section || '',
    gender: design.gender || '',
    ageGroup: design.ageGroup || '',
    fit: design.fit || '',
    sleeveType: design.sleeveType || '',
    neckType: design.neckType || '',
    pattern: design.pattern || '',
    occasion: design.occasion || '',
    tags: design.tags || [],
    collectionCode: catalogCode(design.collectionId, design.collectionCode),
    seasonCode: catalogCode(design.seasonId, design.seasonCode),
    collectionId: refId(design.collectionId),
    seasonId: refId(design.seasonId),
    sizeChartId: refId(design.sizeChartId),
    targetPrice: design.targetPrice != null ? String(design.targetPrice) : '',
    currency: design.currency || 'INR',
    productSpecs: design.productSpecs || defaultProductSpecs(),
    colors: design.colorVariants?.length
      ? design.colorVariants.map((c) => ({ ...c, sizes: c.sizes || [] }))
      : [emptyColor()],
    sizeChartData: design.sizeChartData?.sizeLabels?.length
      ? design.sizeChartData
      : defaultSizeChartData(),
  };
}

export function formStateToPayload(state: DesignFormState): DesignPayload {
  return {
    title: state.title.trim(),
    description: state.description.trim(),
    skuPrefix: (state.category || state.skuPrefix).trim() || undefined,
    styleNumber: state.styleNumber.trim() || undefined,
    category: state.category || undefined,
    subCategory: state.subCategory || undefined,
    section: state.section || undefined,
    gender: state.gender || undefined,
    ageGroup: state.ageGroup || undefined,
    fit: state.fit || undefined,
    sleeveType: state.sleeveType || undefined,
    neckType: state.neckType || undefined,
    pattern: state.pattern || undefined,
    occasion: state.occasion || undefined,
    tags: state.tags.filter(Boolean),
    collectionCode: state.collectionCode || undefined,
    seasonCode: state.seasonCode || undefined,
    sizeChartId: state.sizeChartId || undefined,
    sizeChartData: state.sizeChartData,
    targetPrice: state.targetPrice ? Number(state.targetPrice) : undefined,
    currency: state.currency,
    productSpecs: state.productSpecs,
    colorVariants: state.colors.filter((c) => c.name.trim()),
  };
}

export function inputClass(editable: boolean) {
  return `erp-input mt-1 w-full${!editable ? ' opacity-60' : ''}`;
}

export function labelClass() {
  return 'erp-label';
}
