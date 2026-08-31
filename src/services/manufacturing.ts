import api from './api';
import type { QcMeasurement } from '../features/sampling/QcMeasurementForm';
import type {
  Design, DesignAsset, DesignCollection, Season, SizeChart, Sample,
  DesignLookups, DesignVersion, DesignTimelineEntry, ProductSpecs, ColorVariant, FabricConsumption,
  DesignAccessory, DesignBomLine, ProductionInfo, QualityNotes,
  ManufacturingNotes, SizeChartData,
  ApiListMeta, Material, InventoryBalance, InventoryCode, SkuFormulaConfig, SkuSegmentDefinition,
  DesignStats,
  PatternDevelopment, PatternMarker, PatternStats, PatternVerificationEvidence,
  PatternTechPack, PatternGrading, PatternCalculatedConsumption, FitAnalysis,
  PatternFabricSpecs, PatternCosting,
  SampleStats, SampleEligibleDesign,
  SkuStats, SkuEligibleSample, SkuPreview, BomStats, BomSuggestion, MrpPreview,
  InventoryStats, InventoryTransaction, MaterialAvailability,
  MaterialMasterRequest,
  ErpUser,
} from '../types/api';

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

const unwrapList = <T>(res: { data: { data: T; meta?: ApiListMeta } }) => ({
  items: res.data.data,
  meta: res.data.meta,
});

export interface DesignPayload {
  title: string;
  description?: string;
  skuPrefix?: string;
  styleNumber?: string;
  category?: string;
  subCategory?: string;
  section?: string;
  gender?: string;
  ageGroup?: string;
  fit?: string;
  sleeveType?: string;
  neckType?: string;
  pattern?: string;
  occasion?: string;
  tags?: string[];
  collectionCode?: string;
  seasonCode?: string;
  collectionId?: string;
  seasonId?: string;
  sizeChartId?: string;
  sizeChartData?: SizeChartData;
  targetPrice?: number;
  currency?: string;
  productSpecs?: ProductSpecs;
  colorVariants?: ColorVariant[];
}

export interface DesignListParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  collectionId?: string;
  seasonId?: string;
  gender?: string;
  tags?: string;
  search?: string;
}

export const designApi = {
  stats: () => api.get<{ data: DesignStats }>('/designs/stats').then(unwrap),
  list: (params?: DesignListParams) =>
    api.get<{ data: Design[]; meta?: ApiListMeta }>('/designs', { params: { limit: 200, ...params } }).then(unwrap),
  listPage: (params?: DesignListParams) =>
    api.get<{ data: Design[]; meta: ApiListMeta }>('/designs', { params }).then(unwrapList),
  get: (id: string) => api.get<{ data: Design }>(`/designs/${id}`).then(unwrap),
  create: (body: DesignPayload) => api.post<{ data: Design }>('/designs', body).then(unwrap),
  update: (id: string, body: DesignPayload) => api.put<{ data: Design }>(`/designs/${id}`, body).then(unwrap),
  submit: (id: string) => api.post<{ data: Design }>(`/designs/${id}/submit`).then(unwrap),
  approve: (id: string) => api.post<{ data: Design }>(`/designs/${id}/approve`).then(unwrap),
  reject: (id: string, comments?: string) =>
    api.post<{ data: Design }>(`/designs/${id}/reject`, { comments }).then(unwrap),
  revision: (id: string, comments?: string) =>
    api.post<{ data: Design }>(`/designs/${id}/revision`, { comments }).then(unwrap),
  release: (id: string, body?: { patternMasterId?: string }) =>
    api.post<{ data: Design }>(`/designs/${id}/release`, body ?? {}).then(unwrap),
  clone: (id: string) => api.post<{ data: Design }>(`/designs/${id}/clone`).then(unwrap),
  regenerateSkus: (id: string) => api.post<{ data: Design }>(`/designs/${id}/generate-sku`).then(unwrap),
  getLookups: () => api.get<{ data: DesignLookups }>('/designs/lookups').then(unwrap),
  getVersions: (id: string) => api.get<{ data: DesignVersion[] }>(`/designs/${id}/versions`).then(unwrap),
  getTimeline: (id: string) => api.get<{ data: DesignTimelineEntry[] }>(`/designs/${id}/timeline`).then(unwrap),
  getVersion: (id: string, version: number) =>
    api.get<{ data: DesignVersion }>(`/designs/${id}/versions/${version}`).then(unwrap),
  getSamples: (id: string) => api.get<{ data: Sample[] }>(`/designs/${id}/samples`).then(unwrap),
  uploadAsset: (id: string, body: { fileName: string; mimeType: string; contentBase64: string; assetType: string }) =>
    api.post<{ data: DesignAsset }>(`/designs/${id}/assets`, body).then(unwrap),
  deleteAsset: (designId: string, assetId: string) =>
    api.delete(`/designs/${designId}/assets/${assetId}`).then(unwrap),
  listCollections: () => api.get<{ data: DesignCollection[] }>('/collections').then(unwrap),
  listMaterialOptions: () =>
    api.get<{ data: { _id: string; materialCode: string; name: string; unit: string; category?: string }[] }>('/designs/material-options').then(unwrap),
  createCollection: (body: { name: string; description?: string }) =>
    api.post<{ data: DesignCollection }>('/collections', body).then(unwrap),
  listSeasons: () => api.get<{ data: Season[] }>('/seasons').then(unwrap),
  createSeason: (body: { name: string; year: number }) =>
    api.post<{ data: Season }>('/seasons', body).then(unwrap),
  listSizeCharts: () => api.get<{ data: SizeChart[] }>('/size-charts').then(unwrap),
  createSizeChart: (body: Partial<SizeChart>) =>
    api.post<{ data: SizeChart }>('/size-charts', body).then(unwrap),
};

export const sampleApi = {
  stats: (params?: { patternMasterId?: string }) =>
    api.get<{ data: SampleStats }>('/samples/stats', { params }).then(unwrap),
  catalog: () => api.get<{ data: { statuses: string[]; sampleTypes: string[] } }>('/samples/catalog').then(unwrap),
  materialOptions: () => api.get<{ data: Material[] }>('/samples/material-options').then(unwrap),
  eligibleDesigns: () => api.get<{ data: SampleEligibleDesign[] }>('/samples/eligible-designs').then(unwrap),
  list: (params?: { status?: string; limit?: number; excludeTerminal?: boolean }) =>
    api.get<{ data: Sample[]; meta?: ApiListMeta }>('/samples', {
      params: { limit: 200, ...params, excludeTerminal: params?.excludeTerminal ? 'true' : undefined },
    }).then(unwrap),
  listPage: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    sampleType?: string;
    search?: string;
    excludeTerminal?: boolean;
    patternMasterId?: string;
  }) => api.get<{ data: Sample[]; meta: ApiListMeta }>('/samples', {
    params: {
      ...params,
      excludeTerminal: params?.excludeTerminal ? 'true' : undefined,
    },
  }).then(unwrapList),
  get: (id: string) => api.get<{ data: Sample }>(`/samples/${id}`).then(unwrap),
  create: (body: {
    designId: string;
    laborHours?: number;
    laborRate?: number;
    sampleType?: string;
    comments?: string;
  }) => api.post<{ data: Sample }>('/samples', body).then(unwrap),
  submitMaterialRequest: (id: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/submit-material-request`).then(unwrap),
  approveMaterialRequest: (id: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/approve-material-request`).then(unwrap),
  rejectMaterialRequest: (id: string, comments?: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/reject-material-request`, { comments }).then(unwrap),
  reserveMaterials: (id: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/reserve-materials`).then(unwrap),
  issueMaterials: (id: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/issue-materials`).then(unwrap),
  completeCutting: (id: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/complete-cutting`).then(unwrap),
  complete: (id: string) => api.post<{ data: Sample }>(`/samples/${id}/complete`).then(unwrap),
  qcPass: (id: string, body?: {
    comments?: string;
    fitAnalysis?: FitAnalysis;
    qcMeasurements?: QcMeasurement[];
  }) => api.post<{ data: Sample }>(`/samples/${id}/qc-pass`, body ?? {}).then(unwrap),
  qcFail: (id: string, body: {
    comments: string;
    fitAnalysis?: FitAnalysis;
    qcMeasurements?: QcMeasurement[];
  }) => api.post<{ data: Sample }>(`/samples/${id}/qc-fail`, body).then(unwrap),
  completeFitTrial: (id: string, body?: { comments?: string; fitAnalysis?: FitAnalysis }) =>
    api.post<{ data: Sample }>(`/samples/${id}/complete-fit-trial`, body ?? {}).then(unwrap),
  approve: (id: string) => api.post<{ data: Sample }>(`/samples/${id}/approve`).then(unwrap),
  reject: (id: string, comments?: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/reject`, { comments }).then(unwrap),
  revision: (id: string, comments?: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/revision`, { comments }).then(unwrap),
  reopen: (id: string) => api.post<{ data: Sample }>(`/samples/${id}/reopen`).then(unwrap),
  refreshMaterials: (id: string) =>
    api.post<{ data: Sample }>(`/samples/${id}/refresh-materials`).then(unwrap),
  updateMaterials: (
    id: string,
    body: {
      materialRequirements: NonNullable<Sample['materialRequirements']>;
      laborHours?: number;
      laborRate?: number;
      comments?: string;
    },
  ) => api.put<{ data: Sample }>(`/samples/${id}/materials`, body).then(unwrap),
};

export const patternApi = {
  stats: () => api.get<{ data: PatternStats }>('/pattern-developments/stats').then(unwrap),
  list: (params?: { status?: string; limit?: number }) =>
    api.get<{ data: PatternDevelopment[]; meta?: ApiListMeta }>('/pattern-developments', {
      params: { limit: 200, ...params },
    }).then(unwrap),
  listPage: (params?: { page?: number; limit?: number; status?: string; search?: string; patternMasterId?: string }) =>
    api.get<{ data: PatternDevelopment[]; meta: ApiListMeta }>('/pattern-developments', { params }).then(unwrapList),
  get: (designId: string) =>
    api.get<{ data: PatternDevelopment }>(`/pattern-developments/${designId}`).then(unwrap),
  getEvidence: (designId: string) =>
    api.get<{ data: PatternVerificationEvidence }>(`/pattern-developments/${designId}/evidence`).then(unwrap),
  getTechPack: (designId: string) =>
    api.get<{ data: PatternTechPack }>(`/pattern-developments/${designId}/tech-pack`).then(unwrap),
  materialOptions: () =>
    api.get<{ data: { _id: string; materialCode: string; name: string; unit: string; category?: string; unitCost?: number }[] }>('/pattern-developments/material-options').then(unwrap),
  listMasters: () =>
    api.get<{ data: ErpUser[] }>('/pattern-developments/masters').then(unwrap),
  assign: (body: { designId: string; patternMasterId: string }) =>
    api.post<{ data: PatternDevelopment }>('/pattern-developments/assign', body).then(unwrap),
  update: (designId: string, body: {
    patternNotes?: string;
    marker?: PatternMarker;
    grading?: PatternGrading;
    calculatedConsumption?: PatternCalculatedConsumption;
    sizeChartData?: SizeChartData;
    fabricConsumption?: FabricConsumption[];
    bomLines?: DesignBomLine[];
    accessories?: DesignAccessory[];
    fabricSpecs?: PatternFabricSpecs;
    qualityNotes?: QualityNotes;
    manufacturingNotes?: ManufacturingNotes;
    costing?: PatternCosting;
    productionInfo?: ProductionInfo;
    sizeChartVerified?: boolean;
    consumptionVerified?: boolean;
    sampleBomVerified?: boolean;
  }) => api.put<{ data: PatternDevelopment }>(`/pattern-developments/${designId}`, body).then(unwrap),
  uploadMarker: (designId: string, body: { fileName: string; mimeType: string; contentBase64: string }) =>
    api.post<{ data: PatternDevelopment }>(`/pattern-developments/${designId}/marker-file`, body).then(unwrap),
  complete: (designId: string) =>
    api.post<{ data: PatternDevelopment }>(`/pattern-developments/${designId}/complete`).then(unwrap),
  reopen: (designId: string, reason?: string) =>
    api.post<{ data: PatternDevelopment }>(`/pattern-developments/${designId}/reopen`, { reason }).then(unwrap),
  reopenForFit: (designId: string, body: { sampleId: string; reason: string }) =>
    api.post<{ data: PatternDevelopment }>(`/pattern-developments/${designId}/reopen-for-fit`, body).then(unwrap),
};

export const skuApi = {
  stats: () => api.get<{ data: SkuStats }>('/skus/stats').then(unwrap),
  catalog: () => api.get<{ data: { statuses: string[] } }>('/skus/catalog').then(unwrap),
  eligibleSamples: () => api.get<{ data: SkuEligibleSample[] }>('/skus/eligible-samples').then(unwrap),
  preview: (sampleId: string) =>
    api.get<{ data: SkuPreview }>('/skus/preview', { params: { sampleId } }).then(unwrap),
  list: (params?: { status?: string; limit?: number }) =>
    api.get<{ data: import('../types/api').Sku[]; meta?: ApiListMeta }>('/skus', {
      params: { limit: 200, ...params },
    }).then(unwrap),
  listPage: (params?: {
    page?: number; limit?: number; status?: string; search?: string; designId?: string; sampleId?: string;
  }) => api.get<{ data: import('../types/api').Sku[]; meta: ApiListMeta }>('/skus', { params }).then(unwrapList),
  get: (id: string) => api.get<{ data: import('../types/api').Sku }>(`/skus/${id}`).then(unwrap),
  create: (body: {
    sampleId: string; size?: string; basePrice?: number; name?: string;
    color?: { name: string; hexCode?: string }; status?: string;
  }) => api.post<{ data: import('../types/api').Sku }>('/skus', body).then(unwrap),
  bulkCreate: (body: { designId: string; sampleId: string; basePrice?: number }) =>
    api.post<{ data: { created: import('../types/api').Sku[]; skipped: { skuCode: string; reason: string }[] } }>(
      '/skus/bulk', body,
    ).then(unwrap),
  update: (id: string, body: { name?: string; basePrice?: number; barcode?: string; status?: string }) =>
    api.patch<{ data: import('../types/api').Sku }>(`/skus/${id}`, body).then(unwrap),
};

export const bomApi = {
  stats: () => api.get<{ data: BomStats }>('/boms/stats').then(unwrap),
  catalog: () => api.get<{ data: { statuses: string[] } }>('/boms/catalog').then(unwrap),
  suggestLines: (skuId: string) =>
    api.get<{ data: BomSuggestion }>('/boms/suggest-lines', { params: { skuId } }).then(unwrap),
  list: (params?: { status?: string; limit?: number }) =>
    api.get<{ data: import('../types/api').Bom[]; meta?: ApiListMeta }>('/boms', {
      params: { limit: 200, ...params },
    }).then(unwrap),
  listPage: (params?: {
    page?: number; limit?: number; status?: string; search?: string; skuId?: string;
  }) => api.get<{ data: import('../types/api').Bom[]; meta: ApiListMeta }>('/boms', { params }).then(unwrapList),
  get: (id: string) => api.get<{ data: import('../types/api').Bom }>(`/boms/${id}`).then(unwrap),
  create: (body: { skuId: string; lines?: import('../types/api').BomLine[]; fromDesign?: boolean }) =>
    api.post<{ data: import('../types/api').Bom }>('/boms', body).then(unwrap),
  update: (id: string, lines: import('../types/api').BomLine[]) =>
    api.put<{ data: import('../types/api').Bom }>(`/boms/${id}`, { lines }).then(unwrap),
  approve: (id: string) => api.post<{ data: import('../types/api').Bom }>(`/boms/${id}/approve`).then(unwrap),
  finalize: (id: string) =>
    api.post<{ data: { bom: import('../types/api').Bom; mrp: MrpPreview } }>(`/boms/${id}/finalize`).then(unwrap),
  mrpPreview: (id: string) => api.get<{ data: MrpPreview }>(`/boms/${id}/mrp-preview`).then(unwrap),
  activeForSku: (skuId: string) =>
    api.get<{ data: import('../types/api').Bom | null }>(`/skus/${skuId}/bom`).then(unwrap),
};

export const inventoryApi = {
  stats: () => api.get<{ data: InventoryStats }>('/inventory/stats').then(unwrap),
  catalog: () => api.get<{ data: { categories: string[]; units: string[] } }>('/inventory/catalog').then(unwrap),
  listMaterials: () =>
    api.get<{ data: Material[]; meta?: ApiListMeta }>('/materials', { params: { limit: 200 } }).then(unwrap),
  listMaterialsPage: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
    api.get<{ data: Material[]; meta: ApiListMeta }>('/materials', { params }).then(unwrapList),
  getMaterial: (id: string) => api.get<{ data: Material }>(`/materials/${id}`).then(unwrap),
  createMaterial: (body: Partial<Material>) =>
    api.post<{ data: Material }>('/materials', body).then(unwrap),
  bulkImportMaterials: (body: {
    items: Array<{
      materialCode?: string;
      name: string;
      category?: string;
      unit?: string;
      unitCost?: number;
      reorderLevel?: number;
      openingQty?: number;
      vendorName?: string;
    }>;
    postOpeningStock?: boolean;
  }) =>
    api.post<{
      data: {
        total: number;
        created: number;
        skipped: number;
        stockPosted: number;
        errors: Array<{ row: number; name?: string; message: string }>;
      };
    }>('/materials/bulk', body).then(unwrap),
  updateMaterial: (id: string, body: Partial<Material>) =>
    api.patch<{ data: Material }>(`/materials/${id}`, body).then(unwrap),
  receipt: (body: { materialId: string; quantity: number; unit: string; storageBinId?: string }) =>
    api.post<{ data: InventoryBalance }>('/inventory/receipt', body).then(unwrap),
  balances: () => api.get<{ data: InventoryBalance[] }>('/inventory/balances').then(unwrap),
  listBalancesPage: (params?: {
    page?: number; limit?: number; search?: string; lowStockOnly?: boolean; inventoryType?: string;
  }) => api.get<{ data: InventoryBalance[]; meta: ApiListMeta }>('/inventory/balances', {
    params: { ...params, lowStockOnly: params?.lowStockOnly ? 'true' : undefined },
  }).then(unwrapList),
  listTransactionsPage: (params?: { page?: number; limit?: number; materialId?: string; type?: string }) =>
    api.get<{ data: InventoryTransaction[]; meta: ApiListMeta }>('/inventory/transactions', { params }).then(unwrapList),
  availability: (materialId: string) =>
    api.get<{ data: MaterialAvailability }>('/inventory/availability', { params: { materialId } }).then(unwrap),
  reserve: (body: {
    materialId: string; quantity: number; unit: string;
    referenceType: string; referenceId: string;
  }) => api.post('/inventory/reserve', body).then(unwrap),
  issue: (body: {
    materialId: string; quantity: number; unit: string;
    referenceType: string; referenceId: string;
    reservationReferenceType?: string; reservationReferenceId?: string;
  }) => api.post('/inventory/issue', body).then(unwrap),
  releaseReservations: (body: { referenceType: string; referenceId: string }) =>
    api.post<{ data: { released: number } }>('/inventory/release-reservations', body).then(unwrap),
  listMaterialMasterRequests: (params?: {
    page?: number; limit?: number; status?: string; designId?: string;
  }) => api.get<{ data: MaterialMasterRequest[]; meta: ApiListMeta }>('/material-master-requests', { params }).then(unwrapList),
  createMaterialMasterRequest: (body: {
    name: string;
    proposedCode?: string;
    category?: string;
    unit?: string;
    unitCost?: number;
    notes?: string;
    designId: string;
  }) => api.post<{ data: MaterialMasterRequest }>('/material-master-requests', body).then(unwrap),
  approveMaterialMasterRequest: (id: string, body?: {
    name?: string;
    materialCode?: string;
    category?: string;
    unit?: string;
    unitCost?: number;
    reviewNotes?: string;
  }) => api.post<{ data: MaterialMasterRequest }>(`/material-master-requests/${id}/approve`, body || {}).then(unwrap),
  rejectMaterialMasterRequest: (id: string, body?: { reviewNotes?: string }) =>
    api.post<{ data: MaterialMasterRequest }>(`/material-master-requests/${id}/reject`, body || {}).then(unwrap),
};

export const inventoryCodeApi = {
  list: (params?: { type?: string; active?: boolean; limit?: number; catalog?: boolean }) =>
    api.get<{ data: InventoryCode[]; meta?: ApiListMeta }>('/inventory-codes', {
      params: { catalog: true, limit: 2000, ...params },
    }).then(unwrap),
  listPage: (params?: {
    page?: number; limit?: number; type?: string; active?: boolean; inactiveOnly?: boolean; search?: string;
  }) => api.get<{ data: InventoryCode[]; meta: ApiListMeta }>('/inventory-codes', { params }).then(unwrapList),
  stats: () => api.get<{ data: Record<string, number> }>('/inventory-codes/stats').then(unwrap),
  create: (body: { type: string; code: string; name: string; sortOrder?: number; remarks?: string }) =>
    api.post<{ data: InventoryCode }>('/inventory-codes', body).then(unwrap),
  update: (id: string, body: Partial<InventoryCode>) =>
    api.patch<{ data: InventoryCode }>(`/inventory-codes/${id}`, body).then(unwrap),
  delete: (id: string) => api.delete(`/inventory-codes/${id}`).then(unwrap),
  getSkuFormula: () => api.get<{ data: SkuFormulaConfig | null }>('/sku-formula-config').then(unwrap),
  updateSkuFormula: (body: Partial<SkuFormulaConfig>) =>
    api.put<{ data: SkuFormulaConfig }>('/sku-formula-config', body).then(unwrap),
  getSegmentCatalog: () =>
    api.get<{ data: SkuSegmentDefinition[] }>('/sku-formula-config/catalog').then(unwrap),
};
