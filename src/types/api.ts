export interface ApiListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DesignAsset {
  _id: string;
  assetType: string;
  fileName: string;
  mimeType?: string;
  url: string;
}

export interface DesignCollection {
  _id: string;
  name: string;
  code?: string;
}

export interface Season {
  _id: string;
  name: string;
  year: number;
  code?: string;
}

export interface SizeChartRow {
  measurementName: string;
  values: Record<string, number>;
}

export interface SizeChart {
  _id: string;
  name: string;
  unit?: string;
  sizeLabels?: string[];
  rows?: SizeChartRow[];
  measurements?: {
    sizeLabel: string;
    chest?: number;
    waist?: number;
    hip?: number;
    length?: number;
    shoulder?: number;
    sleeve?: number;
  }[];
}

export interface DesignUser {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface ProductSpecs {
  material?: string;
  fabricGsm?: number;
  fabricWidth?: string;
  fabricFinish?: string;
  shrinkagePercent?: number;
  printingType?: string;
  embroidery?: boolean;
  washCare?: string;
  ironing?: string;
}

export interface ColorVariant {
  name: string;
  pantoneCode?: string;
  hexCode?: string;
  code?: string;
  fabricDyeCode?: string;
  supplierShade?: string;
  status?: string;
  frontImageAssetId?: string;
  backImageAssetId?: string;
  availableQty?: number;
}

export interface FabricConsumption {
  materialId: string;
  color?: string;
  gsm?: number;
  consumption?: number;
  unit?: string;
  wastagePercent?: number;
  supplierName?: string;
  fabricCost?: number;
  leadTimeDays?: number;
  minOrderQty?: number;
  approvedVendor?: boolean;
}

export interface DesignAccessory {
  accessoryType?: string;
  materialId?: string;
  color?: string;
  size?: string;
  supplierName?: string;
  consumption?: number;
  unit?: string;
  unitCost?: number;
  approved?: boolean;
  quantity?: number;
}

export interface DesignBomLine {
  materialId?: string;
  materialName?: string;
  quantity?: number;
  unit?: string;
  category?: string;
  notes?: string;
}

export interface DesignCosting {
  fabricCost?: number;
  accessoriesCost?: number;
  printingCost?: number;
  embroideryCost?: number;
  laborCost?: number;
  packingCost?: number;
  overhead?: number;
  profitPercent?: number;
  expectedSellingPrice?: number;
  actualCost?: number;
  margin?: number;
}

export interface ProductionInfo {
  sampleRequired?: boolean;
  sampleDeadline?: string;
  productionLineId?: string;
  expectedProductionQty?: number;
  productionPriority?: string;
  remarks?: string;
}

export interface QualityNotes {
  allowedDefects?: string;
  colorTolerance?: string;
  shrinkagePercent?: number;
  measurementTolerance?: string;
  checklist?: { item: string; required?: boolean }[];
}

export interface ManufacturingNotes {
  specialStitch?: string;
  needleType?: string;
  machineType?: string;
  threadColor?: string;
  packingInstructions?: string;
  foldingInstructions?: string;
  ironInstructions?: string;
  barcodePosition?: string;
  labelPosition?: string;
}

export interface SizeChartData {
  unit?: string;
  sizeLabels?: string[];
  rows?: SizeChartRow[];
}

export interface Design {
  _id: string;
  designCode: string;
  skuPrefix?: string;
  title: string;
  description?: string;
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
  status: string;
  revisionComments?: string;
  rejectionComments?: string;
  currentVersion?: number;
  releasedVersion?: number;
  versionCount?: number;
  createdAt?: string;
  createdBy?: string | DesignUser;
  collectionId?: string | DesignCollection;
  seasonId?: string | Season;
  sizeChartId?: string | SizeChart;
  sizeChartData?: SizeChartData;
  targetPrice?: number;
  currency?: string;
  productSpecs?: ProductSpecs;
  fabricConsumption?: FabricConsumption[];
  fabricSuggestions?: FabricConsumption[];
  accessories?: DesignAccessory[];
  colorVariants?: ColorVariant[];
  bomLines?: DesignBomLine[];
  costing?: DesignCosting;
  productionInfo?: ProductionInfo;
  qualityNotes?: QualityNotes;
  manufacturingNotes?: ManufacturingNotes;
  assets?: DesignAsset[];
}

export interface DesignVersion {
  _id: string;
  designId: string;
  version: number;
  changeSummary: string;
  snapshot?: Partial<Design>;
  createdAt?: string;
  createdBy?: string | DesignUser;
  released?: boolean;
  releasedAt?: string;
}

export type DesignTimelineKind =
  | 'CREATED'
  | 'EDIT'
  | 'CLONED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION_REQUESTED'
  | 'RELEASED';

export interface DesignTimelineEntry {
  id: string;
  kind: DesignTimelineKind | string;
  at: string;
  actor?: string | DesignUser;
  version?: number;
  summary: string;
  comments?: string;
  level?: number;
  released?: boolean;
}

export interface DesignLookups {
  categories: string[];
  fits: string[];
  genders: string[];
  ageGroups: string[];
  accessoryTypes: string[];
  colorVariantStatuses: string[];
  productionPriorities: string[];
  sampleTypes: string[];
  tagPresets: string[];
  assetTypes: string[];
}

export interface Sample {
  _id: string;
  sampleCode: string;
  designId: string | Design;
  sampleType?: string;
  status: string;
  comments?: string;
  qcComments?: string;
  materialRequirements?: {
    materialId: string;
    requiredQty: number;
    reservedQty?: number;
    issuedQty?: number;
    unit?: string;
  }[];
  totalCost?: number;
}

export interface Sku {
  _id: string;
  skuCode: string;
  name: string;
  size: string;
  status: string;
  basePrice: number;
}

export interface Bom {
  _id: string;
  bomCode: string;
  skuId: string | Sku;
  status: string;
  version: number;
  lines: {
    materialId: string;
    quantityPerPiece: number;
    unit?: string;
    wastagePercent?: number;
    unitCost?: number;
  }[];
  totalCostPerPiece?: number;
}

export interface Material {
  _id: string;
  materialCode: string;
  name: string;
  unit: string;
  unitCost: number;
  category?: string;
}

export interface InventoryBalance {
  _id: string;
  materialId: Material;
  storageBinId?: string | StorageBin | null;
  onHand: number;
  reserved: number;
  available: number;
  unit: string;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  reorderLevel?: number;
  stockValue?: number;
  /** Synthetic alert row — material never received / no balance yet */
  noBalanceYet?: boolean;
}

export interface Supplier {
  _id: string;
  supplierCode: string;
  name: string;
}

export interface PurchaseRequisition {
  _id: string;
  prNumber: string;
  status: string;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  status: string;
}

export interface GoodsReceipt {
  _id: string;
  grnNumber: string;
  status: string;
  lines?: { receivedQty: number }[];
}

export interface ProductionOrder {
  _id: string;
  orderNumber: string;
  status: string;
  plannedQuantity: number;
  standardCostPerPiece?: number;
  standardMaterialCost?: number;
  actualMaterialCost?: number;
}

export interface ProductionBatch {
  _id: string;
  batchNumber: string;
  status: string;
  currentStage: string;
  producedQuantity?: number;
  qcInspectionId?: string;
  actualMaterialCost?: number;
}

export interface Warehouse {
  _id: string;
  warehouseCode: string;
  name: string;
  type: string;
  isDefault: boolean;
}

export interface QualityInspection {
  _id: string;
  inspectionNumber: string;
  inspectionType: string;
  status: string;
  referenceId?: string;
  referenceType?: string;
  passedQuantity?: number;
}

export interface NotificationItem {
  _id: string;
  userId?: string;
  title: string;
  message?: string;
  eventType: string;
  status: string;
  createdAt: string;
  referenceType?: string;
  referenceId?: string;
}

export interface ApprovalItem {
  _id: string;
  documentType: string;
  documentId: string;
  status: string;
  submittedAt?: string;
}

export interface Rfq {
  _id: string;
  rfqNumber: string;
  status: string;
  prId?: string | PurchaseRequisition;
}

export interface Quotation {
  _id: string;
  rfqId: string;
  supplierId: string | Supplier;
  totalAmount: number;
  status: string;
}

export interface WasteRecord {
  _id: string;
  wasteCode: string;
  wasteType: string;
  quantity: number;
  unit: string;
  totalCost: number;
  status: string;
  recoveryAction?: string;
}

export interface StorageBin {
  _id: string;
  warehouseId: string;
  zoneId?: string;
  rackId?: string;
  shelfId?: string;
  zoneCode: string;
  binCode: string;
  barcode?: string;
  status: string;
}

export * from './api.extended';
