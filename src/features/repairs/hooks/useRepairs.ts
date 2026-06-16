import { useQuery } from '@tanstack/react-query';

import { repairsApi } from '@/core/api/repairs.api';
import { mapRepairsToListItems } from '@/features/repairs/model/repair.mapper';
import { useAuthStore } from '@/store/auth.store';

export const repairsQueryKeys = {
  all: (customerId: number | null) =>
    ['repairs', 'customer', customerId] as const,
  detail: (id: number) => ['repairs', id] as const,
};

export function useRepairs() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery({
    queryKey: repairsQueryKeys.all(customerId),
    queryFn: async () => {
      if (customerId === null) {
        return [];
      }

      const repairs = await repairsApi.getRepairs(customerId);

      return mapRepairsToListItems(repairs);
    },
    refetchOnWindowFocus: true,
  });
}
