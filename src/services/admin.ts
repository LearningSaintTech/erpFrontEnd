import api from './api';
import type {
  ApiListMeta, AuditLogEntry, Delegation, ErpRole, ErpUser, UserRoleAssignment,
  GeneralSettings, IntegrationsSettings, FeatureFlagsSettings, FeatureFlagDefinition, FactorySettings,
  Machine, ProductionLine, Shift, ProductionCapacity,
  CapaRecord, DefectCategory, InspectionTemplate,
} from '../types/api';

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

const unwrapList = <T>(res: { data: { data: T; meta?: ApiListMeta } }) => ({
  items: res.data.data,
  meta: res.data.meta,
});

export const usersApi = {
  list: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const { items } = await api
      .get<{ data: ErpUser[]; meta?: ApiListMeta }>('/users', { params: { limit: 100, ...params } })
      .then(unwrapList);
    return items;
  },
  listPage: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get<{ data: ErpUser[]; meta: ApiListMeta }>('/users', { params }).then(unwrapList),
  getAssignments: (userId: string) =>
    api.get<{ data: UserRoleAssignment[] }>(`/users/${userId}/assignments`).then(unwrap),
  getUserDelegations: (userId: string) =>
    api.get<{ data: Delegation[] }>(`/users/${userId}/delegations`).then(unwrap),
  update: (id: string, body: { status?: string; firstName?: string; lastName?: string; phone?: string }) =>
    api.patch<{ data: ErpUser }>(`/users/${id}`, body).then(unwrap),
  assignRole: (userId: string, body: {
    roleId: string; factoryId: string; organizationId: string; expiresAt?: string;
  }) => api.post(`/users/${userId}/roles`, body).then(unwrap),
  revokeAssignment: (userId: string, assignmentId: string) =>
    api.delete(`/users/${userId}/assignments/${assignmentId}`).then(unwrap),
  create: (body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    organizationId: string;
  }) => api.post<{ data: ErpUser }>('/users', body).then(unwrap),
  listRoles: () => api.get<{ data: ErpRole[] }>('/roles').then(unwrap),
  createRole: (body: { code: string; name: string; permissions: string[] }) =>
    api.post<{ data: ErpRole }>('/roles', body).then(unwrap),
  updateRole: (id: string, body: { name?: string; permissions?: string[] }) =>
    api.patch<{ data: ErpRole }>(`/roles/${id}`, body).then(unwrap),
  listRoleMembers: (roleId: string) =>
    api.get<{ data: UserRoleAssignment[] }>(`/roles/${roleId}/members`).then(unwrap),
  listPermissions: () => api.get<{ data: string[] }>('/permissions').then(unwrap),
  delete: (id: string) => api.delete(`/users/${id}`).then(unwrap),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }).then(unwrap),
  unlock: (id: string) => api.post(`/users/${id}/unlock`).then(unwrap),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/users/me/change-password', { currentPassword, newPassword }).then(unwrap),
  deleteRole: (id: string) => api.delete(`/roles/${id}`).then(unwrap),
  listDelegations: () => api.get<{ data: Delegation[] }>('/delegations').then(unwrap),
  createDelegation: (body: {
    delegateId: string;
    permissions: string[];
    startDate: string;
    endDate: string;
  }) => api.post<{ data: Delegation }>('/delegations', body).then(unwrap),
  revokeDelegation: (id: string) => api.post(`/delegations/${id}/revoke`).then(unwrap),
};

export const settingsApi = {
  getGeneral: () => api.get<{ data: GeneralSettings }>('/settings/general').then(unwrap),
  updateGeneral: (body: Partial<GeneralSettings>) =>
    api.put<{ data: GeneralSettings }>('/settings/general', body).then(unwrap),
  getIntegrations: () => api.get<{ data: IntegrationsSettings }>('/settings/integrations').then(unwrap),
  updateIntegrations: (body: Partial<IntegrationsSettings>) =>
    api.put<{ data: IntegrationsSettings }>('/settings/integrations', body).then(unwrap),
  getFeatureFlags: () => api.get<{ data: FeatureFlagsSettings }>('/settings/feature-flags').then(unwrap),
  updateFeatureFlags: (body: FeatureFlagsSettings) =>
    api.put<{ data: FeatureFlagsSettings }>('/settings/feature-flags', body).then(unwrap),
  getFeatureFlagCatalog: () =>
    api.get<{ data: FeatureFlagDefinition[] }>('/settings/feature-flags/catalog').then(unwrap),
  getReadiness: () => api.get<{ data: Record<string, unknown> }>('/settings/readiness').then(unwrap),
  getFactorySettings: (factoryId: string) =>
    api.get<{ data: FactorySettings }>(`/factories/${factoryId}/settings`).then(unwrap),
  updateFactorySettings: (factoryId: string, body: Partial<FactorySettings>) =>
    api.put<{ data: FactorySettings }>(`/factories/${factoryId}/settings`, body).then(unwrap),
};

export const machineApi = {
  listPage: (params?: object) =>
    api.get<{ data: Machine[]; meta: ApiListMeta }>('/machines', { params }).then(unwrapList),
  list: (params?: object) =>
    api.get<{ data: Machine[]; meta: ApiListMeta }>('/machines', { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  get: (id: string) => api.get<{ data: Machine }>(`/machines/${id}`).then(unwrap),
  create: (body: object) => api.post<{ data: Machine }>('/machines', body).then(unwrap),
  update: (id: string, body: object) => api.patch<{ data: Machine }>(`/machines/${id}`, body).then(unwrap),
  capacity: () => api.get<{ data: ProductionCapacity }>('/production/capacity').then(unwrap),
  listLinesPage: (params?: object) =>
    api.get<{ data: ProductionLine[]; meta: ApiListMeta }>('/production-lines', { params }).then(unwrapList),
  listLines: (params?: object) =>
    api.get<{ data: ProductionLine[]; meta: ApiListMeta }>('/production-lines', { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  createLine: (body: object) => api.post<{ data: ProductionLine }>('/production-lines', body).then(unwrap),
  listShifts: () => api.get<{ data: Shift[] }>('/shifts').then(unwrap),
  createShift: (body: object) => api.post<{ data: Shift }>('/shifts', body).then(unwrap),
};

export const qualityAdminApi = {
  listTemplates: (type?: string) =>
    api.get<{ data: InspectionTemplate[] }>('/inspection-templates', { params: type ? { type } : undefined }).then(unwrap),
  createTemplate: (body: object) => api.post<{ data: InspectionTemplate }>('/inspection-templates', body).then(unwrap),
  listDefectCategories: () => api.get<{ data: DefectCategory[] }>('/defect-categories').then(unwrap),
  createDefectCategory: (body: object) => api.post<{ data: DefectCategory }>('/defect-categories', body).then(unwrap),
};

export const capaApi = {
  listPage: (params?: object) =>
    api.get<{ data: CapaRecord[]; meta: ApiListMeta }>('/capa-records', { params }).then(unwrapList),
  list: (params?: object) =>
    api.get<{ data: CapaRecord[]; meta: ApiListMeta }>('/capa-records', { params: { limit: 100, ...params } })
      .then(unwrapList).then((r) => r.items),
  get: (id: string) => api.get<{ data: CapaRecord }>(`/capa-records/${id}`).then(unwrap),
  create: (body: object) => api.post<{ data: CapaRecord }>('/capa-records', body).then(unwrap),
  update: (id: string, body: object) => api.patch<{ data: CapaRecord }>(`/capa-records/${id}`, body).then(unwrap),
  close: (id: string) => api.post<{ data: CapaRecord }>(`/capa-records/${id}/close`).then(unwrap),
};

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  module?: string;
  action?: string;
  userEmail?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  list: (params?: AuditLogFilters) =>
    api.get<{ data: AuditLogEntry[]; meta: ApiListMeta }>('/audit-logs', { params }).then(unwrapList),
  listModules: () => api.get<{ data: string[] }>('/audit-logs/modules').then(unwrap),
};

export const orgApi = {
  list: () => api.get<{ data: { _id: string; code: string; name: string }[] }>('/organizations').then(unwrap),
};
