import api from './api';
import type {
  ApiListMeta,
  ApprovalReport,
  EmployeeReport,
  FactoryReport,
  FinancialReport,
  InventoryReport,
  LowStockReportItem,
  MachineReport,
  PendingApprovalItem,
  ProductionReport,
  PurchaseReport,
  QualityReport,
  ReportCatalog,
  ReportDatePreset,
  ReportStats,
  ReportTabId,
  TopDefectItem,
  WasteReport,
} from '../types/api';

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

const unwrapList = <T>(res: { data: { data: T[]; meta: ApiListMeta } }) => ({
  items: res.data.data,
  meta: res.data.meta,
});

export type ReportFilters = {
  preset?: ReportDatePreset;
  from?: string;
  to?: string;
};

function filterParams(filters?: ReportFilters) {
  if (!filters) return undefined;
  const params: Record<string, string> = {};
  if (filters.preset && filters.preset !== 'all') params.preset = filters.preset;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return Object.keys(params).length ? params : undefined;
}

export const reportApi = {
  catalog: () => api.get<{ data: ReportCatalog }>('/reports/catalog').then(unwrap),
  stats: (filters?: ReportFilters) =>
    api.get<{ data: ReportStats }>('/reports/stats', { params: filterParams(filters) }).then(unwrap),
  factory: (filters?: ReportFilters) =>
    api.get<{ data: FactoryReport }>('/reports/factory', { params: filterParams(filters) }).then(unwrap),
  production: (filters?: ReportFilters) =>
    api.get<{ data: ProductionReport }>('/reports/production', { params: filterParams(filters) }).then(unwrap),
  inventory: (filters?: ReportFilters) =>
    api.get<{ data: InventoryReport }>('/reports/inventory', { params: filterParams(filters) }).then(unwrap),
  purchase: (filters?: ReportFilters) =>
    api.get<{ data: PurchaseReport }>('/reports/purchase', { params: filterParams(filters) }).then(unwrap),
  quality: (filters?: ReportFilters) =>
    api.get<{ data: QualityReport }>('/reports/quality', { params: filterParams(filters) }).then(unwrap),
  waste: (filters?: ReportFilters) =>
    api.get<{ data: WasteReport }>('/reports/waste', { params: filterParams(filters) }).then(unwrap),
  machine: (filters?: ReportFilters) =>
    api.get<{ data: MachineReport }>('/reports/machine', { params: filterParams(filters) }).then(unwrap),
  employee: (filters?: ReportFilters) =>
    api.get<{ data: EmployeeReport }>('/reports/employee', { params: filterParams(filters) }).then(unwrap),
  financial: (filters?: ReportFilters) =>
    api.get<{ data: FinancialReport }>('/reports/financial', { params: filterParams(filters) }).then(unwrap),
  approval: (filters?: ReportFilters) =>
    api.get<{ data: ApprovalReport }>('/reports/approval', { params: filterParams(filters) }).then(unwrap),
  lowStockPage: (params?: object) =>
    api.get<{ data: LowStockReportItem[]; meta: ApiListMeta }>('/reports/drill-down/low-stock', { params })
      .then(unwrapList),
  pendingApprovalsPage: (params?: object) =>
    api.get<{ data: PendingApprovalItem[]; meta: ApiListMeta }>('/reports/drill-down/pending-approvals', { params })
      .then(unwrapList),
  topDefects: (filters?: ReportFilters & { limit?: number }) => {
    const { limit, ...rest } = filters || {};
    return api.get<{ data: TopDefectItem[] }>('/reports/drill-down/top-defects', {
      params: { ...filterParams(rest), limit },
    }).then(unwrap);
  },
  exportCsv: async (type: ReportTabId, filters?: ReportFilters) => {
    const token = localStorage.getItem('accessToken');
    const factoryId = localStorage.getItem('factoryId');
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    const qs = new URLSearchParams(filterParams(filters) || {}).toString();
    const url = `${base}/reports/${type}/export${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Factory-Id': factoryId || '',
      },
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
};

// Backward-compatible alias
export type FactoryDashboard = FactoryReport;
