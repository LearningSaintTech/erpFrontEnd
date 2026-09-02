import api from './api';
import type {
  Supplier,
  PurchaseRequisition,
  PurchaseOrder,
  GoodsReceipt,
  ProductionOrder,
  ProductionBatch,
  ProductionSchedule,
  ProductionStats,
  ProductionCapacity,
  BatchBoard,
  Machine,
  ProductionLine,
  Shift,
  Warehouse,
  StorageBin,
  WarehouseStats,
  WarehouseZone,
  WarehouseLayout,
  WarehouseRack,
  WarehouseShelf,
  BinContents,
  CycleCount,
  CycleCountLine,
  DispatchReadyBalance,
  SkuRef,
  QualityStats,
  QualityPendingWork,
  QualityDefect,
  DefectCategory,
  InspectionTemplate,
  CapaRecord,
  QualityInspection,
  Rfq,
  Quotation,
  WasteRecord,
  WasteStats,
  WasteSummary,
  PurchaseStats,
  PoReceiptPreview,
  Material,
  ApiListMeta,
} from '../types/api';

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

const unwrapList = <T>(res: { data: { data: T; meta?: ApiListMeta } }) => ({
  items: res.data.data,
  meta: res.data.meta,
});

export const purchaseApi = {
  stats: () => api.get<{ data: PurchaseStats }>('/purchase/stats').then(unwrap),
  catalog: () => api.get<{ data: Record<string, string[]> }>('/purchase/catalog').then(unwrap),
  listSuppliers: (params?: { limit?: number }) =>
    api.get<{ data: Supplier[]; meta?: ApiListMeta }>('/suppliers', { params: { limit: 200, ...params } }).then(unwrap),
  listSuppliersPage: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ data: Supplier[]; meta: ApiListMeta }>('/suppliers', { params }).then(unwrapList),
  createSupplier: (body: Partial<Supplier>) => api.post<{ data: Supplier }>('/suppliers', body).then(unwrap),
  updateSupplier: (id: string, body: Partial<Supplier>) =>
    api.patch<{ data: Supplier }>(`/suppliers/${id}`, body).then(unwrap),
  listPRs: (params?: { status?: string; excludeStatus?: string; limit?: number }) =>
    api.get<{ data: PurchaseRequisition[]; meta?: ApiListMeta }>('/purchase-requisitions', { params: { limit: 200, ...params } }).then(unwrap),
  listPRsPage: (params?: { page?: number; limit?: number; status?: string; excludeStatus?: string; search?: string }) =>
    api.get<{ data: PurchaseRequisition[]; meta: ApiListMeta }>('/purchase-requisitions', { params }).then(unwrapList),
  createPR: (body: { lines: { materialId: string; requiredQty: number; unit?: string; estimatedUnitCost?: number }[] }) =>
    api.post<{ data: PurchaseRequisition }>('/purchase-requisitions', body).then(unwrap),
  createPrFromMrp: (mrpId: string) =>
    api.post<{ data: PurchaseRequisition }>('/purchase-requisitions/from-mrp', { mrpId }).then(unwrap),
  submitPR: (id: string) => api.post<{ data: PurchaseRequisition }>(`/purchase-requisitions/${id}/submit`).then(unwrap),
  approvePR: (id: string) => api.post<{ data: PurchaseRequisition }>(`/purchase-requisitions/${id}/approve`).then(unwrap),
  rejectPR: (id: string, comments: string) =>
    api.post<{ data: PurchaseRequisition }>(`/purchase-requisitions/${id}/reject`, { comments }).then(unwrap),
  listPOs: (params?: { status?: string; excludeStatus?: string; limit?: number }) =>
    api.get<{ data: PurchaseOrder[]; meta?: ApiListMeta }>('/purchase-orders', { params: { limit: 200, ...params } }).then(unwrap),
  listPOsPage: (params?: { page?: number; limit?: number; status?: string; excludeStatus?: string; search?: string }) =>
    api.get<{ data: PurchaseOrder[]; meta: ApiListMeta }>('/purchase-orders', { params }).then(unwrapList),
  poReceiptPreview: (id: string) =>
    api.get<{ data: PoReceiptPreview }>(`/purchase-orders/${id}/receipt-preview`).then(unwrap),
  createPO: (body: { supplierId: string; prId?: string; lines?: { materialId: string; orderedQty: number; unit?: string; unitPrice?: number }[] }) =>
    api.post<{ data: PurchaseOrder }>('/purchase-orders', body).then(unwrap),
  approvePO: (id: string) => api.post<{ data: PurchaseOrder }>(`/purchase-orders/${id}/approve`).then(unwrap),
  sendPO: (id: string) => api.post<{ data: PurchaseOrder }>(`/purchase-orders/${id}/send`).then(unwrap),
  listGRNs: (params?: { status?: string; excludeStatus?: string; limit?: number }) =>
    api.get<{ data: GoodsReceipt[]; meta?: ApiListMeta }>('/goods-receipts', { params: { limit: 200, ...params } }).then(unwrap),
  listGRNsPage: (params?: { page?: number; limit?: number; status?: string; excludeStatus?: string; search?: string }) =>
    api.get<{ data: GoodsReceipt[]; meta: ApiListMeta }>('/goods-receipts', { params }).then(unwrapList),
  createGRN: (body: { poId: string; lines: { materialId: string; receivedQty: number; unit?: string }[] }) =>
    api.post<{ data: GoodsReceipt }>('/goods-receipts', body).then(unwrap),
  submitGrnQc: (id: string) => api.post<{ data: GoodsReceipt }>(`/goods-receipts/${id}/submit-qc`).then(unwrap),
  listRfqs: (params?: { status?: string; limit?: number }) =>
    api.get<{ data: Rfq[]; meta?: ApiListMeta }>('/rfqs', { params: { limit: 200, ...params } }).then(unwrap),
  listRfqsPage: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get<{ data: Rfq[]; meta: ApiListMeta }>('/rfqs', { params }).then(unwrapList),
  createRfqFromPr: (prId: string, supplierIds?: string[]) =>
    api.post<{ data: Rfq }>('/rfqs/from-pr', { prId, supplierIds }).then(unwrap),
  sendRfq: (id: string) => api.post<{ data: Rfq }>(`/rfqs/${id}/send`).then(unwrap),
  addQuotation: (rfqId: string, body: { supplierId: string; lines: { materialId: string; quantity: number; unit?: string; unitPrice: number }[] }) =>
    api.post<{ data: Quotation }>(`/rfqs/${rfqId}/quotations`, body).then(unwrap),
  compareQuotations: (rfqId: string) =>
    api.get<{ data: Quotation[] }>(`/rfqs/${rfqId}/quotations/compare`).then(unwrap),
  selectQuotation: (id: string) =>
    api.post<{ data: { quotation: Quotation; purchaseOrder: PurchaseOrder } }>(`/quotations/${id}/select`).then(unwrap),
};

export const productionApi = {
  stats: () => api.get<{ data: ProductionStats }>('/production/stats').then(unwrap),
  catalog: () => api.get<{ data: Record<string, string[] | unknown> }>('/production/catalog').then(unwrap),
  capacity: () => api.get<{ data: ProductionCapacity }>('/production/capacity').then(unwrap),
  listOrdersPage: (params?: object) =>
    api.get<{ data: ProductionOrder[]; meta: ApiListMeta }>('/production-orders', { params }).then(unwrapList),
  listOrders: (params?: object) =>
    api.get<{ data: ProductionOrder[]; meta: ApiListMeta }>('/production-orders', { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  getOrder: (id: string) => api.get<{ data: ProductionOrder }>(`/production-orders/${id}`).then(unwrap),
  createOrder: (body: object) => api.post<{ data: ProductionOrder }>('/production-orders', body).then(unwrap),
  updateOrder: (id: string, body: object) => api.put<{ data: ProductionOrder }>(`/production-orders/${id}`, body).then(unwrap),
  runMrp: (id: string) => api.post(`/production-orders/${id}/mrp`).then(unwrap),
  reserve: (id: string) => api.post<{ data: ProductionOrder }>(`/production-orders/${id}/reserve`).then(unwrap),
  submitApproval: (id: string) =>
    api.post<{ data: ProductionOrder }>(`/production-orders/${id}/submit-approval`).then(unwrap),
  approve: (id: string) => api.post<{ data: ProductionOrder }>(`/production-orders/${id}/approve`).then(unwrap),
  reject: (id: string, comments?: string) =>
    api.post<{ data: ProductionOrder }>(`/production-orders/${id}/reject`, { comments }).then(unwrap),
  cancel: (id: string) => api.post<{ data: ProductionOrder }>(`/production-orders/${id}/cancel`).then(unwrap),
  createBatch: (orderId: string, body?: object) =>
    api.post<{ data: ProductionBatch }>(`/production-orders/${orderId}/batches`, body || {}).then(unwrap),
  listBatchesPage: (params?: object) =>
    api.get<{ data: ProductionBatch[]; meta: ApiListMeta }>('/batches', { params }).then(unwrapList),
  listBatches: (params?: object) =>
    api.get<{ data: ProductionBatch[]; meta: ApiListMeta }>('/batches', { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  getBatch: (id: string) => api.get<{ data: ProductionBatch }>(`/batches/${id}`).then(unwrap),
  batchBoard: () => api.get<{ data: BatchBoard }>('/batches/board').then(unwrap),
  startBatch: (id: string) => api.post<{ data: ProductionBatch }>(`/batches/${id}/start`).then(unwrap),
  completeStage: (id: string, body?: {
    machineHours?: number;
    labourHours?: number;
    scrapMaterialId?: string;
    scrapQuantity?: number;
    scrapUnit?: string;
    wasteType?: string;
  }) => api.post<{ data: ProductionBatch }>(`/batches/${id}/complete-stage`, body || {}).then(unwrap),
  rollbackStage: (id: string) => api.post<{ data: ProductionBatch }>(`/batches/${id}/rollback-stage`).then(unwrap),
  assignResources: (id: string, body: object) =>
    api.post<{ data: ProductionBatch }>(`/batches/${id}/assign-resources`, body).then(unwrap),
  listStages: () => api.get<{ data: string[] }>('/production/stages').then(unwrap),
  listSchedulesPage: (params?: object) =>
    api.get<{ data: ProductionSchedule[]; meta: ApiListMeta }>('/production-schedules', { params }).then(unwrapList),
  listSchedules: (params?: object) =>
    api.get<{ data: ProductionSchedule[]; meta?: ApiListMeta }>('/production-schedules', { params })
      .then(unwrapList).then((r) => r.items),
  createSchedule: (body: object) => api.post('/production-schedules', body).then(unwrap),
  updateSchedule: (id: string, body: object) => api.put(`/production-schedules/${id}`, body).then(unwrap),
};

export const warehouseApi = {
  stats: () => api.get<{ data: WarehouseStats }>('/warehouse/stats').then(unwrap),
  catalog: () => api.get<{ data: Record<string, string[]> }>('/warehouse/catalog').then(unwrap),
  stockLocator: (params?: {
    materialId?: string; skuId?: string; search?: string; inventoryType?: string;
  }) => api.get<{ data: import('../types/api.extended').StockLocatorResult }>(
    '/warehouse/stock-locator', { params },
  ).then(unwrap),
  listPage: (params?: object) =>
    api.get<{ data: Warehouse[]; meta: ApiListMeta }>('/warehouses', { params }).then(unwrapList),
  list: (params?: object) =>
    api.get<{ data: Warehouse[]; meta: ApiListMeta }>('/warehouses', { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  get: (id: string) => api.get<{ data: Warehouse }>(`/warehouses/${id}`).then(unwrap),
  create: (body: object) => api.post<{ data: Warehouse }>('/warehouses', body).then(unwrap),
  update: (id: string, body: object) => api.patch<{ data: Warehouse }>(`/warehouses/${id}`, body).then(unwrap),
  listBinsPage: (warehouseId: string, params?: object) =>
    api.get<{ data: StorageBin[]; meta: ApiListMeta }>(`/warehouses/${warehouseId}/bins`, { params }).then(unwrapList),
  listBins: (warehouseId: string, params?: object) =>
    api.get<{ data: StorageBin[]; meta: ApiListMeta }>(`/warehouses/${warehouseId}/bins`, { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  createBin: (warehouseId: string, body: object) =>
    api.post<{ data: StorageBin }>(`/warehouses/${warehouseId}/bins`, body).then(unwrap),
  updateBin: (warehouseId: string, binId: string, body: object) =>
    api.patch<{ data: StorageBin }>(`/warehouses/${warehouseId}/bins/${binId}`, body).then(unwrap),
  binContents: (warehouseId: string, binId: string) =>
    api.get<{ data: BinContents }>(`/warehouses/${warehouseId}/bins/${binId}/contents`).then(unwrap),
  lookupBin: (barcode: string) =>
    api.get<{ data: BinContents }>(`/warehouse/bins/lookup/${encodeURIComponent(barcode)}`).then(unwrap),
  lookupSku: (barcode: string) =>
    api.get<{ data: SkuRef }>(`/warehouse/sku-lookup/${encodeURIComponent(barcode)}`).then(unwrap),
  listZones: (warehouseId: string) =>
    api.get<{ data: WarehouseZone[] }>(`/warehouses/${warehouseId}/zones`).then(unwrap),
  createZone: (warehouseId: string, body: object) =>
    api.post<{ data: WarehouseZone }>(`/warehouses/${warehouseId}/zones`, body).then(unwrap),
  layout: (warehouseId: string) =>
    api.get<{ data: WarehouseLayout }>(`/warehouses/${warehouseId}/layout`).then(unwrap),
  listRacks: (zoneId: string) =>
    api.get<{ data: WarehouseRack[] }>(`/zones/${zoneId}/racks`).then(unwrap),
  createRack: (zoneId: string, body: { rackCode: string; name?: string }) =>
    api.post<{ data: WarehouseRack }>(`/zones/${zoneId}/racks`, body).then(unwrap),
  listShelves: (rackId: string) =>
    api.get<{ data: WarehouseShelf[] }>(`/racks/${rackId}/shelves`).then(unwrap),
  createShelf: (rackId: string, body: { shelfCode: string; name?: string }) =>
    api.post<{ data: WarehouseShelf }>(`/racks/${rackId}/shelves`, body).then(unwrap),
  putAway: (body: { materialId: string; binId: string; quantity?: number }) =>
    api.post('/warehouse-operations/put-away', body).then(unwrap),
  fgPutAway: (body: { skuId: string; binId: string; quantity: number }) =>
    api.post('/warehouse-operations/fg-put-away', body).then(unwrap),
  markDispatchReady: (body: { skuId: string; storageBinId: string }) =>
    api.post('/warehouse-operations/mark-dispatch-ready', body).then(unwrap),
  listDispatchReady: () =>
    api.get<{ data: DispatchReadyBalance[] }>('/warehouse/dispatch-ready').then(unwrap),
  dispatch: (body: { skuId: string; storageBinId: string; quantity: number }) =>
    api.post('/warehouse-operations/dispatch', body).then(unwrap),
  pick: (body: { materialId?: string; skuId?: string; binId: string; quantity: number }) =>
    api.post('/warehouse-operations/pick', body).then(unwrap),
  transfer: (body: {
    materialId?: string;
    skuId?: string;
    toBinId: string;
    fromBinId?: string;
    quantity?: number;
  }) =>
    api.post('/warehouse-operations/transfer', body).then(unwrap),
  listCycleCountsPage: (params?: object) =>
    api.get<{ data: CycleCount[]; meta: ApiListMeta }>('/cycle-counts', { params }).then(unwrapList),
  listCycleCounts: (params?: object) =>
    api.get<{ data: CycleCount[]; meta: ApiListMeta }>('/cycle-counts', { params: { limit: 50, ...params } })
      .then(unwrapList).then((r) => r.items),
  getCycleCount: (id: string) => api.get<{ data: CycleCount }>(`/cycle-counts/${id}`).then(unwrap),
  createCycleCount: (body: { warehouseId: string }) => api.post<{ data: CycleCount }>('/cycle-counts', body).then(unwrap),
  startCycleCount: (id: string) => api.post<{ data: CycleCount }>(`/cycle-counts/${id}/start`).then(unwrap),
  completeCycleCount: (id: string, body: { lines: CycleCountLine[]; applyAdjustments?: boolean }) =>
    api.post<{ data: CycleCount }>(`/cycle-counts/${id}/complete`, body).then(unwrap),
};

export const wasteApi = {
  stats: () => api.get<{ data: WasteStats }>('/waste/stats').then(unwrap),
  catalog: () => api.get<{ data: Record<string, string[] | Record<string, string>> }>('/waste/catalog').then(unwrap),
  listPage: (params?: object) =>
    api.get<{ data: WasteRecord[]; meta: ApiListMeta }>('/waste-records', { params }).then(unwrapList),
  list: (params?: object) =>
    api.get<{ data: WasteRecord[]; meta: ApiListMeta }>('/waste-records', { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  get: (id: string) => api.get<{ data: WasteRecord }>(`/waste-records/${id}`).then(unwrap),
  create: (body: object) => api.post<{ data: WasteRecord }>('/waste-records', body).then(unwrap),
  summary: () => api.get<{ data: WasteSummary }>('/waste-records/summary').then(unwrap),
  recordRecovery: (id: string, body: { recoveryAction: string }) =>
    api.post<{ data: WasteRecord }>(`/waste-records/${id}/recovery`, body).then(unwrap),
  exportCsv: async (params?: object) => {
    const token = localStorage.getItem('accessToken');
    const factoryId = localStorage.getItem('factoryId');
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    const qs = new URLSearchParams(params as Record<string, string> || {}).toString();
    const res = await fetch(`${base}/waste-records/export${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Factory-Id': factoryId || '' },
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
};

export const qualityApi = {
  stats: () => api.get<{ data: QualityStats }>('/quality/stats').then(unwrap),
  catalog: () => api.get<{ data: Record<string, string[]> }>('/quality/catalog').then(unwrap),
  pendingWork: () => api.get<{ data: QualityPendingWork }>('/quality/pending-work').then(unwrap),
  queue: () => api.get<{ data: QualityInspection[] }>('/quality-inspections/queue').then(unwrap),
  listPage: (params?: object) =>
    api.get<{ data: QualityInspection[]; meta: ApiListMeta }>('/quality-inspections', { params }).then(unwrapList),
  list: (params?: object) =>
    api.get<{ data: QualityInspection[]; meta: ApiListMeta }>('/quality-inspections', { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  get: (id: string) => api.get<{ data: QualityInspection }>(`/quality-inspections/${id}`).then(unwrap),
  createIncoming: (grnId: string) => api.post<{ data: QualityInspection }>(`/goods-receipts/${grnId}/qc`).then(unwrap),
  incomingContext: (grnId: string) =>
    api.get<{ data: import('../types/api.extended').IncomingQcContext }>(`/goods-receipts/${grnId}/qc-context`).then(unwrap),
  createFinal: (batchId: string, body?: object) =>
    api.post<{ data: QualityInspection }>(`/batches/${batchId}/qc`, body || {}).then(unwrap),
  createInProcess: (batchId: string) =>
    api.post<{ data: QualityInspection }>(`/batches/${batchId}/in-process-qc`).then(unwrap),
  start: (id: string) => api.post<{ data: QualityInspection }>(`/quality-inspections/${id}/start`).then(unwrap),
  complete: (id: string, body: {
    passedQuantity?: number;
    failedQuantity?: number;
    result?: string;
    disposition?: 'PASS' | 'REWORK' | 'REJECT';
    storageBinId?: string;
    autoDispatchReady?: boolean;
    notes?: string;
  }) => api.post<{ data: QualityInspection }>(`/quality-inspections/${id}/complete`, body).then(unwrap),
  listDefects: (id: string) => api.get<{ data: QualityDefect[] }>(`/quality-inspections/${id}/defects`).then(unwrap),
  recordDefect: (id: string, body: { categoryId?: string; description?: string; quantity: number; severity?: string }) =>
    api.post<{ data: QualityDefect }>(`/quality-inspections/${id}/defects`, body).then(unwrap),
};
