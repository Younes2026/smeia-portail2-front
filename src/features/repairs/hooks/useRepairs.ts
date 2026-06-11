import { useQuery } from '@tanstack/react-query';

import { repairsApi } from '@/core/api/repairs.api';
import { mapRepairsToListItems } from '@/features/repairs/model/repair.mapper';

export const repairsQueryKeys = {
  all: ['repairs'] as const,
  detail: (id: number) => ['repairs', id] as const,
};

export function useRepairs() {
  return useQuery({
    queryKey: repairsQueryKeys.all,
    queryFn: async () => {
      const repairs = await repairsApi.getRepairs();

      return mapRepairsToListItems(repairs);
    },
    refetchOnWindowFocus: true,
  });
}