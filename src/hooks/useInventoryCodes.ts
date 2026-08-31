import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryCodeApi } from '../services/manufacturing';
import type { InventoryCode } from '../types/api';

export const INVENTORY_CODE_QUERY_KEY = 'inventory-codes';

export function inventoryCodesQueryKey(type?: string) {
  return type ? [INVENTORY_CODE_QUERY_KEY, type] : [INVENTORY_CODE_QUERY_KEY];
}

export function useInventoryCodes(type: string, enabled = true) {
  return useQuery({
    queryKey: inventoryCodesQueryKey(type),
    queryFn: () => inventoryCodeApi.list({ type, catalog: true }),
    enabled,
  });
}

export function useCreateInventoryCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: string; code: string; name: string }) =>
      inventoryCodeApi.create(body),
    onSuccess: (created: InventoryCode) => {
      qc.invalidateQueries({ queryKey: [INVENTORY_CODE_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['inventory-codes-page'] });
      return created;
    },
  });
}
