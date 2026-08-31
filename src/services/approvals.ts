import api from './api';
import type {
  ApiListMeta, ApprovalInstance, ApprovalStats, ApprovalWorkflow,
} from '../types/api';

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

const unwrapList = <T>(res: { data: { data: T; meta?: ApiListMeta } }) => ({
  items: res.data.data,
  meta: res.data.meta,
});

export type ApprovalListParams = {
  page?: number;
  limit?: number;
  status?: string;
  documentType?: string;
  search?: string;
  scope?: 'mine';
};

export const approvalApi = {
  stats: () => api.get<{ data: ApprovalStats }>('/approvals/stats').then(unwrap),
  catalog: () => api.get<{ data: {
    documentTypes: string[];
    statuses: string[];
    approverPermissions: { documentType: string; permission: string; label: string }[];
  } }>('/approvals/catalog').then(unwrap),
  list: (params?: ApprovalListParams) =>
    api.get<{ data: ApprovalInstance[]; meta: ApiListMeta }>('/approvals', { params }).then(unwrapList),
  pending: (params?: Omit<ApprovalListParams, 'status'>) =>
    api.get<{ data: ApprovalInstance[]; meta: ApiListMeta }>('/approvals/pending', { params }).then(unwrapList),
  get: (id: string) => api.get<{ data: ApprovalInstance }>(`/approvals/${id}`).then(unwrap),
  approve: (id: string, comments?: string) => api.post(`/approvals/${id}/approve`, { comments }).then(unwrap),
  reject: (id: string, comments: string) => api.post(`/approvals/${id}/reject`, { comments }).then(unwrap),
  requestChanges: (id: string, comments: string) =>
    api.post(`/approvals/${id}/request-changes`, { comments }).then(unwrap),
  listWorkflows: (params?: { includeInactive?: boolean }) =>
    api.get<{ data: ApprovalWorkflow[] }>('/approval-workflows', { params }).then(unwrap),
  createWorkflow: (body: {
    organizationId?: string;
    factoryId?: string;
    documentType: string;
    name: string;
    levels: ApprovalWorkflow['levels'];
    isActive?: boolean;
  }) => api.post<{ data: ApprovalWorkflow }>('/approval-workflows', body).then(unwrap),
  deactivateWorkflow: (id: string) => api.post(`/approval-workflows/${id}/deactivate`).then(unwrap),
};

export type { ApprovalWorkflow };
