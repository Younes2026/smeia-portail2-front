import { useQuery } from '@tanstack/react-query';

import { repairsApi } from '@/core/api/repairs.api';
import {
  mapRepairToDetailItem,
  mapRepairsToListItems,
} from '@/features/repairs/model/repair.mapper';
import { useAuthStore } from '@/store/auth.store';

export const repairsQueryKeys = {
  all: (customerId: number | null) =>
    ['repairs', 'customer', customerId] as const,
  detail: (customerId: number | null, id: number | null) =>
    ['repairs', 'customer', customerId, 'detail', id] as const,
};

export function useRepairs() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery({
    queryKey: repairsQueryKeys.all(customerId),
    queryFn: async () => {
      if (customerId === null) {
        return [];
      }

      const repairs = await repairsApi.getClientRepairs(customerId);

      return mapRepairsToListItems(repairs);
    },
    enabled: customerId !== null,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useRepairDetail(repairId: number | null) {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery({
    queryKey: repairsQueryKeys.detail(customerId, repairId),
    queryFn: async () => {
      if (customerId === null || repairId === null) {
        return null;
      }

      const repair = await repairsApi.getClientRepairById(
        repairId,
        customerId
      );

      return repair ? mapRepairToDetailItem(repair) : null;
    },
    enabled: customerId !== null && repairId !== null,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
