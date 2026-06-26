import { useQuery } from '@tanstack/react-query';

import { repairsApi } from '@/core/api/repairs.api';
import {
  mapRepairToDetailItem,
  mapRepairsToListItems,
} from '@/features/repairs/model/repair.mapper';
import { useAuthStore } from '@/store/auth.store';

export const repairsQueryKeys = {
  all: ['repairs'] as const,
  detail: (id: number | null) => ['repairs', id] as const,
};

export function useRepairs() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery({
    queryKey: repairsQueryKeys.all,
    queryFn: async () => {
      if (customerId === null) {
        return [];
      }

      const repairs = await repairsApi.getRepairs(customerId);

      return mapRepairsToListItems(repairs);
    },
    select: (repairs) => {
      if (customerId === null) {
        return [];
      }

      return repairs.filter((repair) => repair.customerId === customerId);
    },
    enabled: customerId !== null,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useRepairDetail(repairId: number | null) {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery({
    queryKey: repairsQueryKeys.detail(repairId),
    queryFn: async () => {
      if (customerId === null || repairId === null) {
        return null;
      }

      const repair = await repairsApi.getRepairById(repairId, customerId);

      return repair ? mapRepairToDetailItem(repair) : null;
    },
    select: (repair) => {
      if (customerId === null || repair?.customerId !== customerId) {
        return null;
      }

      return repair;
    },
    enabled: customerId !== null && repairId !== null,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
