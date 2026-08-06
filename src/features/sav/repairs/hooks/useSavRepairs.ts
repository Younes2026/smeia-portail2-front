import { useQuery } from '@tanstack/react-query';

import { repairsApi } from '@/core/api/repairs.api';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';
import { useAuthStore } from '@/store/auth.store';

export const savRepairsQueryKeys = {
  workshop: (workshopId: number | null) =>
    ['sav', 'repairs', 'workshop', workshopId] as const,
};

export function useSavRepairs() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const customer = useAuthStore((state) => state.customer);
  const savAgent = useAuthStore((state) => state.savAgent);
  const workshopId = useAuthStore((state) => state.savAgent?.workshopId ?? null);
  const canReadSavRepairs = Boolean(
    accessToken && savAgent && !customer && workshopId !== null
  );

  return useQuery<DirectusRepair[], Error>({
    queryKey: savRepairsQueryKeys.workshop(workshopId),
    queryFn: async () => {
      if (!canReadSavRepairs || workshopId === null) {
        return [];
      }

      return repairsApi.getRepairsByWorkshop(workshopId);
    },
    enabled: canReadSavRepairs,
    refetchOnWindowFocus: true,
  });
}
