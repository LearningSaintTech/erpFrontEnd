import type {
  Design, DesignUser, Material, FabricConsumption, DesignBomLine, DesignAsset, StorageBin,
  SizeChartData, DesignAccessory, QualityNotes, ManufacturingNotes, ProductionInfo,
} from './api';

// ── Users & RBAC ────────────────────────────────────────────────────────────

export interface ErpUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status?: string;
  lastLoginAt?: string;
  organizationId?: string;
  isSuperAdmin?: boolean;
  employeeId?: string;
  /** Roles for the current factory (when listed via /users). */
  roles?: { code: string; name: string }[];
}

export interface ErpRole {
  _id: string;
  code: string;
  name: string;
  permissions?: string[];
  isSystem?: boolean;
}

export interface UserRoleAssignment {
  _id: string;
  userId?: string | ErpUser;
  roleId?: string | ErpRole;
  factoryId?: string | { _id: string; code?: string; name?: string };
  organizationId?: string;
  expiresAt?: string;
  status?: string;
}

export interface Delegation {
  _id: string;
  delegatorId?: string | ErpUser;
  delegateId?: string | ErpUser;
  permissions?: string[];
  startDate?: string;
  endDate?: string;
  status?: string;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  _id: string;
  action?: string;
  module?: string;
  userEmail?: string;
  timestamp?: string;
  documentType?: string;
  documentId?: string;
  previousData?: Record<string, unknown>;
  updatedData?: Record<string, unknown>;
  metadata?: {
    path?: string;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
  };
}

// ── Settings ────────────────────────────────────────────────────────────────

export interface GeneralSettings {
  companyName?: string;
  timezone?: string;
  currency?: string;
  dateFormat?: string;
  locale?: string;
  fiscalYearStartMonth?: number;
  defaultUom?: string;
  lowStockAlertDays?: number;
}

export interface IntegrationsEmailConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  fromName?: string;
  fromEmail?: string;
  password?: string;
}

export interface IntegrationsSmsConfig {
  enabled: boolean;
  provider?: string;
  apiKey?: string;
  senderId?: string;
}

export interface IntegrationsWebhookConfig {
  enabled: boolean;
  url?: string;
  secret?: string;
  events: string[];
}

export interface IntegrationsSettings {
  email: IntegrationsEmailConfig;
  sms: IntegrationsSmsConfig;
  webhook: IntegrationsWebhookConfig;
}

export interface FeatureFlagDefinition {
  key: string;
  label?: string;
  description?: string;
  defaultValue?: boolean;
}

export type FeatureFlagsSettings = Record<string, boolean>;

export interface FactoryShift {
  name: string;
  startTime?: string;
  endTime?: string;
}

export interface FactorySettings {
  shifts: FactoryShift[];
  defaultShift?: string;
  workingDays: number[];
  productionStages: string[];
  numberingPrefixes?: Record<string, string>;
  defaultWarehouses?: Record<string, string>;
}

// ── Approvals ───────────────────────────────────────────────────────────────

export interface ApprovalWorkflowLevel {
  level: number;
  approverRole?: string;
  approverRoles?: string[];
  slaHours?: number;
  approvalType?: 'ANY' | 'ALL';
}

export interface ApprovalWorkflow {
  _id: string;
  documentType: string;
  name: string;
  levels: ApprovalWorkflowLevel[];
  isActive?: boolean;
  organizationId?: string;
  factoryId?: string;
}

export interface ApprovalDocumentSummary {
  code?: string;
  title?: string;
  status?: string;
  route?: string;
  revisionComments?: string;
  rejectionComments?: string;
}

export interface ApprovalStep {
  level?: number;
  action?: string;
  actionAt?: string;
  comments?: string;
  approverId?: string | ErpUser;
}

export interface ApprovalInstance {
  _id: string;
  documentType: string;
  documentId: string;
  status: string;
  currentLevel?: number;
  submittedAt?: string;
  completedAt?: string;
  submittedBy?: string | ErpUser;
  workflowId?: string | ApprovalWorkflow;
  documentSummary?: ApprovalDocumentSummary;
  steps?: ApprovalStep[];
}

export interface ApprovalStats {
  pending?: number;
  approved?: number;
  rejected?: number;
  overdue?: number;
  submittedByMe?: number;
  completedToday?: number;
}

// ── Notifications & Chat ────────────────────────────────────────────────────

export interface NotificationCatalog {
  eventTypes?: string[];
  statuses?: string[];
  eventTypeLabels?: Record<string, string>;
}

export interface NotificationStats {
  unread?: number;
  read?: number;
  total?: number;
  todayCount?: number;
  unreadByType?: Record<string, number>;
}

export interface ChatRoom {
  _id: string;
  name?: string | null;
  type?: 'DIRECT' | 'GROUP' | string;
  memberIds?: string[];
  members?: { userId?: ErpUser; role?: string }[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
}

export interface ChatMessage {
  _id: string;
  roomId: string;
  body: string;
  messageType?: 'TEXT' | 'SYSTEM' | string;
  senderId?: string | ErpUser;
  createdAt?: string;
  replyToId?: string;
}

export interface ChatStats {
  unreadTotal?: number;
  roomCount?: number;
  groupCount?: number;
  messageCount?: number;
}

// ── Reports ─────────────────────────────────────────────────────────────────

export type ReportDatePreset = 'all' | 'mtd' | 'ytd' | 'last7' | 'last30' | 'last90';

export type ReportTabId =
  | 'factory'
  | 'production'
  | 'inventory'
  | 'purchase'
  | 'quality'
  | 'waste'
  | 'machine'
  | 'employee'
  | 'financial'
  | 'approval';

export interface ReportPeriod {
  from?: string;
  to?: string;
}

export interface ReportCatalog {
  tabs?: ReportTabId[];
  presets?: ReportDatePreset[];
}

export interface ReportStats {
  period?: ReportPeriod | null;
  production?: {
    fulfillmentPct?: number;
    batchesInProgress?: number;
    overdueOrders?: number;
    ordersTotal?: number;
  };
  inventory?: {
    materialCount?: number;
    stockValue?: number;
    lowStock?: number;
    outOfStock?: number;
  };
  purchase?: {
    poOpen?: number;
    grnPendingQc?: number;
    openPoValue?: number;
    periodSpend?: number;
  };
  quality?: {
    firstPassYield?: number;
    pending?: number;
    openCapa?: number;
  };
  waste?: {
    totalCost?: number;
  };
  warehouse?: {
    dispatchReady?: number;
  };
}

export interface FactoryReport {
  summary: {
    approvedDesigns?: number;
    batchesInProgress?: number;
    fulfillmentPct?: number;
    firstPassYield?: number;
    openPoValue?: number;
    lowStockAlerts?: number;
    pendingApprovals?: number;
    qcQueue?: number;
  };
  designsByStatus?: Record<string, number>;
  productionByStatus?: Record<string, number>;
  samplesByStatus?: Record<string, number>;
  period?: ReportPeriod;
}

export interface ProductionReport {
  totalPlannedQty?: number;
  totalProducedQty?: number;
  fulfillmentPct?: number;
  overdueOrders?: number;
  batchesInProgress?: number;
  batchesCompleted?: number;
  batchesRework?: number;
  totalCapacityPerHour?: number;
  machineCount?: number;
  ordersByStatus?: Record<string, number>;
  batchesByStage?: Record<string, number>;
  period?: ReportPeriod;
}

export interface InventoryReport {
  materialCount?: number;
  rmOnHand?: number;
  fgOnHand?: number;
  stockValue?: number;
  lowStock?: number;
  outOfStock?: number;
  dispatchReady?: number;
  totalReserved?: number;
  period?: ReportPeriod;
}

export interface PurchaseReport {
  spendMtd?: number;
  poOpen?: number;
  openPoValue?: number;
  grnPendingQc?: number;
  suppliers?: number;
  rfqOpen?: number;
  prByStatus?: Record<string, number>;
  poByStatus?: Record<string, number>;
  period?: ReportPeriod;
}

export interface QualityReport {
  firstPassYield?: number;
  pending?: number;
  openCapa?: number;
  defectsLogged?: number;
  passed?: number;
  failed?: number;
  partial?: number;
  rework?: number;
  pendingGrns?: number;
  inspectionsByType?: Record<string, number>;
  period?: ReportPeriod;
}

export interface WasteReport {
  count?: number;
  totalCost?: number;
  recovered?: number;
  byType?: Record<string, number>;
  period?: ReportPeriod;
}

export interface MachineReport {
  total?: number;
  active?: number;
  maintenance?: number;
  utilizationPct?: number;
  totalCapacityPerHour?: number;
  lineCount?: number;
  machinesByStatus?: Record<string, number>;
  period?: ReportPeriod;
}

export interface EmployeeReport {
  assignedUsers?: number;
  activeUsers?: number;
  inactiveUsers?: number;
  usersByRole?: Record<string, number>;
  period?: ReportPeriod;
}

export interface FinancialReport {
  purchaseSpend?: number;
  wasteCostTotal?: number;
  stockValue?: number;
  netExposure?: number;
  period: ReportPeriod;
}

export interface ApprovalReport {
  pending?: number;
  approved?: number;
  rejected?: number;
  approvalRate?: number;
  pendingByType?: Record<string, number>;
  period?: ReportPeriod;
}

export interface LowStockReportItem {
  materialId: string;
  materialCode?: string;
  name?: string;
  available?: number;
  reorderLevel?: number;
  unit?: string;
  stockValue?: number;
}

export interface PendingApprovalItem {
  _id: string;
  documentType: string;
  currentLevel?: number;
  submittedAt?: string;
}

export interface TopDefectItem {
  code: string;
  name?: string;
  quantity?: number;
}

// ── Design / Pattern / Sample / SKU / BOM / Inventory codes ───────────────

export interface DesignStats {
  total?: number;
  draft?: number;
  draftOnly?: number;
  revisionRequested?: number;
  submitted?: number;
  approved?: number;
  inReview?: number;
  released?: number;
  rejected?: number;
  needsAction?: number;
  awaitingOthers?: number;
  approvalRate?: number;
  releaseRate?: number;
  byStatus?: Record<string, number>;
  byCategory?: Record<string, number>;
  bySeason?: Record<string, number>;
  byGender?: Record<string, number>;
}

export interface PatternMarker {
  fileName?: string;
  url?: string;
  mimeType?: string;
  efficiency?: number;
  fabricWidth?: number;
  width?: number;
  length?: number;
  piecesPerMarker?: number;
  efficiencyPercent?: number;
  notes?: string;
  uploadedAt?: string;
}

export interface PatternGrading {
  baseSize?: string;
  gradedSizes?: string[];
  notes?: string;
}

export interface PatternCalculatedConsumption {
  metersPerGarment?: number;
  wastagePercent?: number;
  derivedFromMarker?: boolean;
  notes?: string;
}

export interface PatternDevelopment {
  _id?: string;
  designId: string | Design;
  patternDevelopmentCode?: string;
  patternMasterId?: string | DesignUser;
  status?: string;
  patternNotes?: string;
  marker?: PatternMarker;
  grading?: PatternGrading;
  calculatedConsumption?: PatternCalculatedConsumption;
  // Production tech pack owned by the pattern master
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
  assignedAt?: string;
  completedAt?: string;
  evidence?: PatternVerificationEvidence;
}

type TechPackLine<T> = T & { material?: { materialCode?: string; name?: string; unit?: string } };

/** Fabric technicals confirmed by the pattern master against the sourced cloth. */
export interface PatternFabricSpecs {
  fabricGsm?: number;
  fabricWidth?: string;
  fabricFinish?: string;
  shrinkagePercent?: number;
}

/** Cost rollup derived from the pattern's consumption plus the pattern master's estimates. */
export interface PatternCosting {
  fabricCost?: number;
  accessoriesCost?: number;
  printingCost?: number;
  embroideryCost?: number;
  laborCost?: number;
  packingCost?: number;
  overhead?: number;
  actualCost?: number;
}

export interface PatternTechPack {
  design: Design & {
    fabricConsumption?: TechPackLine<FabricConsumption>[];
    bomLines?: TechPackLine<DesignBomLine>[];
  };
  // Authoritative production tech pack (pattern-owned, falls back to legacy design copy)
  techPack?: {
    source?: string;
    sizeChartData?: SizeChartData;
    fabricConsumption?: TechPackLine<FabricConsumption>[];
    bomLines?: TechPackLine<DesignBomLine>[];
    accessories?: TechPackLine<DesignAccessory>[];
    fabricSpecs?: PatternFabricSpecs;
    qualityNotes?: QualityNotes;
    manufacturingNotes?: ManufacturingNotes;
    costing?: PatternCosting;
    productionInfo?: ProductionInfo;
  };
  assets: DesignAsset[];
  cadAssets: DesignAsset[];
  evidence: PatternVerificationEvidence;
}

export interface PatternVerificationEvidence {
  hasSizeChart?: boolean;
  sizeChartRowCount?: number;
  hasConsumption?: boolean;
  consumptionLineCount?: number;
  hasBom?: boolean;
  bomLineCount?: number;
  designCode?: string;
  title?: string;
  designStatus?: string;
  readyForSampling?: boolean;
}

export interface FitIssue {
  area: string;
  severity?: string;
  description?: string;
}

export interface FitAnalysis {
  evaluatedOn?: string;
  overallResult?: string;
  issues?: FitIssue[];
  patternRevisionRequired?: boolean;
  notes?: string;
  evaluatedAt?: string;
}

export interface PatternStats {
  total?: number;
  assigned?: number;
  inProgress?: number;
  completed?: number;
  byStatus?: Record<string, number>;
}

export interface SampleStats {
  total?: number;
  active?: number;
  materialPending?: number;
  inProduction?: number;
  qcPending?: number;
  pendingApproval?: number;
  approved?: number;
  rejected?: number;
  inCutting?: number;
  fitTrial?: number;
  revisionRequested?: number;
  completed?: number;
  byStatus?: Record<string, number>;
}

export interface SampleEligibleDesign {
  _id: string;
  designCode?: string;
  title?: string;
  status?: string;
}

export interface SkuStats {
  total?: number;
  active?: number;
  draft?: number;
  discontinued?: number;
  byStatus?: Record<string, number>;
}

export interface SkuEligibleSample {
  _id: string;
  sampleCode?: string;
  designId?: string | Design;
  designCode?: string;
  status?: string;
  matrixRows?: number;
  existingSkus?: number;
}

export interface SkuPreviewItem {
  size?: string;
  color?: { name?: string; hexCode?: string };
  skuCode?: string;
  name?: string;
  exists?: boolean;
  existingSkuId?: string;
}

export interface SkuPreview {
  sampleId?: string;
  sampleCode?: string;
  designId?: string;
  designCode?: string;
  skuCode?: string;
  sizes?: string[];
  newCount?: number;
  skipCount?: number;
  previews?: SkuPreviewItem[];
  variants?: Record<string, unknown>[];
}

export interface SkuRef {
  _id: string;
  skuCode?: string;
  name?: string;
  barcode?: string;
}

export interface BomLine {
  materialId: string | Material;
  materialCode?: string;
  materialName?: string;
  quantityPerPiece?: number;
  unit?: string;
  wastagePercent?: number;
  unitCost?: number;
}

export interface BomStats {
  total?: number;
  draft?: number;
  active?: number;
  approved?: number;
  byStatus?: Record<string, number>;
}

export interface BomSuggestion {
  lines?: BomLine[];
  source?: string;
}

export interface MrpPreviewLine {
  materialId?: string;
  materialCode?: string;
  requiredQty?: number;
  availableQty?: number;
  shortageQty?: number;
  extendedCost?: number;
  unit?: string;
}

export interface MrpPreview {
  _id?: string;
  lines?: MrpPreviewLine[];
  hasShortage?: boolean;
  orderQuantity?: number;
  totalCost?: number;
}

export interface InventoryStats {
  materialCount?: number;
  balanceCount?: number;
  lowStock?: number;
  outOfStock?: number;
  stockValue?: number;
  totalOnHand?: number;
  /** Qty available on unallocated dock (post-QC receipts) */
  dockOnHand?: number;
  /** Balance rows on dock with available > 0 */
  dockBalanceCount?: number;
  activeReservations?: number;
  pendingMasterRequests?: number;
}

export interface MaterialMasterRequest {
  _id: string;
  requestNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  name: string;
  proposedCode?: string;
  category?: string;
  unit?: string;
  unitCost?: number;
  notes?: string;
  designId?: string | { _id: string; designCode?: string; title?: string };
  requestedBy?: string | { _id: string; firstName?: string; lastName?: string; email?: string };
  reviewedBy?: string | { _id: string; firstName?: string; lastName?: string; email?: string };
  reviewedAt?: string;
  reviewNotes?: string;
  materialId?: string | Material;
  createdAt?: string;
}

export interface InventoryTransaction {
  _id: string;
  materialId?: string | Material;
  type: string;
  quantity?: number;
  unit?: string;
  balanceAfter?: number;
  referenceType?: string;
  referenceId?: string;
  createdAt?: string;
  performedBy?: string | { firstName?: string; lastName?: string; email?: string };
}

export interface MaterialAvailability {
  materialId?: string;
  materialCode?: string;
  name?: string;
  onHand?: number;
  reserved?: number;
  available?: number;
  unit?: string;
  reorderLevel?: number;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  locations?: {
    storageBinId?: string;
    onHand?: number;
    reserved?: number;
    available?: number;
  }[];
}

export interface WarehouseRack {
  _id: string;
  zoneId: string;
  rackCode: string;
  name?: string;
  shelves?: WarehouseShelf[];
}

export interface WarehouseShelf {
  _id: string;
  rackId: string;
  shelfCode: string;
  name?: string;
}

export interface WarehouseLayout {
  warehouseId: string;
  zones: (WarehouseZone & {
    racks?: WarehouseRack[];
    bins?: StorageBin[];
  })[];
  unassignedBins?: StorageBin[];
}

export interface InventoryCode {
  _id: string;
  type: string;
  code: string;
  name: string;
  sortOrder?: number;
  active?: boolean;
  isActive?: boolean;
  remarks?: string;
}

export type InventoryCodeType = string;

export interface SkuFormulaSegment {
  segmentKey?: string;
  key?: string;
  optional?: boolean;
  label?: string;
  source?: string;
}

export interface SkuSegmentDefinition {
  key: string;
  label?: string;
  description?: string;
}

export interface SkuFormulaConfig {
  name?: string;
  skuSegmentOrder?: SkuFormulaSegment[];
}

// ── Purchase ────────────────────────────────────────────────────────────────

export interface PurchaseLine {
  materialId: string | Material;
  materialCode?: string;
  materialName?: string;
  requiredQty?: number;
  orderedQty?: number;
  quantity?: number;
  remainingQty?: number;
  unit?: string;
  estimatedUnitCost?: number;
  unitPrice?: number;
  receivedQty?: number;
}

export interface PurchaseStats {
  suppliers?: number;
  prDraft?: number;
  prSubmitted?: number;
  prApproved?: number;
  poDraft?: number;
  poOpen?: number;
  grnPending?: number;
  grnPendingQc?: number;
  grnDraft?: number;
  rfqOpen?: number;
  openPoValue?: number;
  prOpen?: number;
}

export interface PoReceiptPreviewLine {
  materialId: string | import('./api').Material;
  materialCode?: string;
  materialName?: string;
  orderedQty?: number;
  receivedQty?: number;
  remainingQty: number;
  unit?: string;
}

export interface PoReceiptPreview {
  poId?: string;
  poNumber?: string;
  poStatus?: string;
  lines: PoReceiptPreviewLine[];
}

// ── Production & Machines ───────────────────────────────────────────────────

export interface ProductionSchedule {
  _id: string;
  productionOrderId?: string | import('./api').ProductionOrder;
  productionLineId?: string | ProductionLine;
  batchId?: string | import('./api').ProductionBatch;
  scheduledStart?: string;
  scheduledEnd?: string;
  plannedStart?: string;
  plannedEnd?: string;
  status?: string;
}

export interface ProductionStats {
  ordersTotal?: number;
  ordersCreated?: number;
  ordersMrpDone?: number;
  ordersReserved?: number;
  ordersApprovalPending?: number;
  ordersApproved?: number;
  ordersInProgress?: number;
  ordersCompleted?: number;
  batchesTotal?: number;
  batchesCreated?: number;
  batchesInProgress?: number;
  batchesRework?: number;
  batchesCompleted?: number;
  overdueOrders?: number;
  plannedSchedules?: number;
  machineCount?: number;
  lineCount?: number;
  totalCapacityPerHour?: number;
  plannedQty?: number;
  producedQty?: number;
  fulfillmentPct?: number;
}

export interface ProductionCapacity {
  totalCapacityPerHour?: number;
  utilizedCapacityPerHour?: number;
  utilizationPct?: number;
  machines?: Machine[];
  lines?: ProductionLine[];
  machineCount?: number;
  lineCount?: number;
  inProgressBatches?: number;
  pendingOrders?: number;
  overdueOrders?: number;
  fulfillmentPct?: number;
}

export type BatchBoard = Record<string, import('./api').ProductionBatch[]>;

export interface Machine {
  _id: string;
  machineCode?: string;
  name?: string;
  type?: string;
  machineType?: string;
  status?: string;
  capacityPerHour?: number;
  productionLineId?: string;
}

export interface ProductionLine {
  _id: string;
  lineCode?: string;
  name?: string;
  status?: string;
  capacityPerDay?: number;
  machineIds?: string[];
}

export interface Shift {
  _id: string;
  name: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

// ── Warehouse ───────────────────────────────────────────────────────────────

export interface WarehouseStats {
  warehousesTotal?: number;
  rmWarehouses?: number;
  fgWarehouses?: number;
  binsTotal?: number;
  binsActive?: number;
  binsFrozen?: number;
  rmInBins?: number;
  dispatchReady?: number;
  stagedFg?: number;
  openCycleCounts?: number;
  warehouseCount?: number;
  binCount?: number;
}

export interface WarehouseZone {
  _id: string;
  zoneCode?: string;
  name?: string;
  warehouseId?: string;
}

export interface BinContents {
  bin?: { _id: string; binCode?: string; zoneCode?: string; barcode?: string };
  rawMaterials?: { materialId?: string; materialCode?: string; quantity?: number; onHand?: number; unit?: string }[];
  finishedGoods?: { skuId?: string; skuCode?: string; quantity?: number; onHand?: number; dispatchStatus?: string }[];
  materials?: { materialId: string; quantity: number; unit?: string }[];
  skus?: { skuId: string; quantity: number }[];
}

export interface CycleCount {
  _id: string;
  countNumber?: string;
  warehouseId?: string;
  status?: string;
  lines?: CycleCountLine[];
}

export interface CycleCountLine {
  materialId?: string | Material;
  skuId?: string | SkuRef;
  binId?: string;
  expectedQty?: number;
  countedQty?: number;
  systemQty?: number;
  variance?: number;
}

export interface StockLocatorRow {
  balanceId: string;
  inventoryType: 'RAW_MATERIAL' | 'FINISHED_GOODS';
  materialId?: string | Material;
  skuId?: string | SkuRef;
  onHand: number;
  reserved: number;
  available: number;
  unit?: string;
  dispatchStatus?: string | null;
  location: {
    isDock: boolean;
    dockLabel?: string | null;
    zoneCode: string;
    rackCode: string;
    shelfCode: string;
    binCode: string;
    binLabel: string;
    binId?: string | null;
    barcode?: string | null;
    warehouse?: {
      warehouseId?: string;
      warehouseCode?: string;
      warehouseName?: string;
      warehouseType?: string;
    } | null;
  };
}

export interface StockLocatorResult {
  items: StockLocatorRow[];
  totals: { onHand: number; reserved: number; available: number };
}

export interface DispatchReadyBalance {
  _id?: string;
  skuId?: string | SkuRef;
  storageBinId?: string | { _id: string };
  quantity?: number;
  onHand?: number;
}

// ── Quality ─────────────────────────────────────────────────────────────────

export interface QualityStats {
  totalInspections?: number;
  pending?: number;
  inProgress?: number;
  completed?: number;
  passed?: number;
  failed?: number;
  partial?: number;
  rework?: number;
  openCapa?: number;
  defectsLogged?: number;
  pendingGrns?: number;
  pendingSampleQc?: number;
  firstPassYield?: number;
}

export interface QualityPendingWork {
  pendingGrns?: GoodsReceiptRef[];
  pendingBatches?: import('./api').ProductionBatch[];
  incomingQueue?: import('./api').QualityInspection[];
  inProgressBatches?: import('./api').ProductionBatch[];
  completedBatches?: import('./api').ProductionBatch[];
  pendingSamples?: Array<{
    _id: string;
    sampleCode: string;
    sampleType?: string;
    status: string;
    designId?: string | { _id: string; designCode?: string; title?: string };
    qcInspectionId?: string | { _id: string; inspectionNumber?: string; status?: string };
  }>;
}

export interface GoodsReceiptRef {
  _id: string;
  grnNumber: string;
  status: string;
  poId?: string | { _id?: string; poNumber?: string };
  qcInspectionId?: string | { _id?: string; inspectionNumber?: string; status?: string };
  lines?: { materialId?: string | { _id?: string; materialCode?: string; name?: string; unit?: string }; receivedQty?: number; unit?: string }[];
}

export interface IncomingQcContext {
  grnId: string;
  grnNumber: string;
  grnStatus: string;
  poNumber?: string;
  totalReceived: number;
  lines: Array<{
    materialId: string;
    materialCode?: string;
    materialName?: string;
    receivedQty: number;
    unit?: string;
  }>;
  inspection?: { _id: string; inspectionNumber: string; status: string } | null;
}

export interface IncomingQcContext {
  grnId: string;
  grnNumber: string;
  grnStatus: string;
  poNumber?: string;
  totalReceived: number;
  lines: { materialCode?: string; materialName?: string; receivedQty: number; unit?: string }[];
  inspection?: { _id: string; inspectionNumber: string; status: string } | null;
}

export interface QualityDefect {
  _id: string;
  categoryId?: string;
  description?: string;
  quantity?: number;
  severity?: string;
}

export interface DefectCategory {
  _id: string;
  code?: string;
  name?: string;
  severity?: string;
}

export interface InspectionTemplate {
  _id: string;
  name?: string;
  inspectionType?: string;
  isActive?: boolean;
  checklist?: { item: string; required?: boolean }[];
}

export interface CapaRecord {
  _id: string;
  capaNumber?: string;
  title?: string;
  type?: string;
  description?: string;
  status?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  actionPlan?: string;
  dueDate?: string;
}

// ── Waste ───────────────────────────────────────────────────────────────────

export interface WasteStats {
  totalCost?: number;
  periodCost7d?: number;
  byType?: Record<string, number>;
  costByType?: Record<string, number>;
  byStatus?: Record<string, number>;
  recordCount?: number;
  totalRecords?: number;
  recordedCount?: number;
  recoveredCount?: number;
  recoveredCost?: number;
  topType?: string | null;
}

export interface WasteSummary {
  totalQuantity?: number;
  totalCost?: number;
  byType?: Record<string, number>;
}

// ── Module augmentation for types defined in api.ts ─────────────────────────

declare module './api' {
  export interface Design {
    styleNumber?: string;
    skuCodeInputs?: Record<string, string>;
  }

  export interface ColorVariant {
    sizes?: { size: string; sku?: string }[];
  }

  export interface Material {
    reorderLevel?: number;
  }

  export interface InventoryBalance {
    isOutOfStock?: boolean;
    isLowStock?: boolean;
    reorderLevel?: number;
    stockValue?: number;
  }

  export interface NotificationItem {
    referenceType?: string;
    referenceId?: string;
  }

  export interface PurchaseOrder {
    totalAmount?: number;
    createdAt?: string;
    supplierId?: string | import('./api').Supplier;
    prId?: string | import('./api').PurchaseRequisition;
    lines?: PurchaseLine[];
  }

  export interface PurchaseRequisition {
    lines?: PurchaseLine[];
    createdAt?: string;
  }

  export interface ProductionOrder {
    createdAt?: string;
    deliveryDate?: string;
    producedQuantity?: number;
    skuId?: string | SkuRef;
    priority?: string;
    standardCostPerPiece?: number;
    standardMaterialCost?: number;
    actualMaterialCost?: number;
  }

  export interface ProductionBatch {
    productionOrderId?: string | import('./api').ProductionOrder;
    plannedQuantity?: number;
    actualMaterialCost?: number;
  }

  export interface Rfq {
    lines?: PurchaseLine[];
  }

  export interface GoodsReceipt {
    poId?: string | import('./api').PurchaseOrder;
  }

  export interface Supplier {
    status?: string;
    leadTimeDays?: number;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
    phone?: string;
    gstNumber?: string;
    materialsSupplied?: string;
    paymentTerms?: string;
    address?: string;
  }

  export interface QualityInspection {
    result?: string;
    passedQuantity?: number;
    failedQuantity?: number;
    disposition?: string;
    completedAt?: string;
    stageAtInspection?: string;
  }

  export interface SampleTimelineEntry {
    at: string;
    action?: string;
    fromStatus?: string;
    toStatus?: string;
    userId?: string;
    note?: string;
  }

  export interface QcMeasurementRow {
    point?: string;
    required?: string;
    actual?: string;
    tolerance?: string;
    pass?: boolean;
  }

  export interface Sample {
    laborHours?: number;
    laborRate?: number;
    iteration?: number;
    qcComments?: string;
    revisionComments?: string;
    fitAnalysis?: FitAnalysis;
    qcMeasurements?: QcMeasurementRow[];
    patternMasterId?: string | { _id: string; firstName?: string; lastName?: string; email?: string };
    qcInspectionId?: string | { _id: string; inspectionNumber?: string; status?: string; result?: string };
    timeline?: SampleTimelineEntry[];
    updatedAt?: string;
  }

  export interface Quotation {
    lines?: PurchaseLine[];
  }

  export interface Sku {
    designId?: string | Design;
    sampleId?: string;
    color?: { name?: string; hexCode?: string };
    barcode?: string;
  }

  export interface StorageBin {
    barcode?: string;
  }

  export interface Warehouse {
    status?: string;
  }

  export interface WasteRecord {
    batchId?: string | import('./api').ProductionBatch;
    materialId?: string | Material;
    skuId?: string | SkuRef;
  }
}
