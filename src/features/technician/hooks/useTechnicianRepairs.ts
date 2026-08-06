import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  technicianApi,
  type TechnicianRepairPatch,
} from '@/core/api/technician.api';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';
import { useAuthStore } from '@/store/auth.store';

export const technicianRepairsQueryKeys = {
  workshop: (workshopId?: number | null) =>
    ['technician', 'repairs', 'workshop', workshopId] as const,
};

export function useTechnicianRepairs(workshopId?: number | null) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const technician = useAuthStore((state) => state.technician);
  const canReadRepairs = Boolean(accessToken && technician && workshopId);

  return useQuery<DirectusRepair[], Error>({
    queryKey: technicianRepairsQueryKeys.workshop(workshopId),
    queryFn: async () => {
      if (!workshopId) {
        return [];
      }

      return technicianApi.getRepairsByWorkshop(workshopId);
    },
    enabled: canReadRepairs,
    refetchOnWindowFocus: true,
  });
}

export function useTechnicianRepairMutation(workshopId?: number | null) {
  const queryClient = useQueryClient();

  return useMutation<
    DirectusRepair,
    Error,
    { patch: TechnicianRepairPatch; repairId: number }
  >({
    mutationFn: ({ patch, repairId }) => technicianApi.patchRepair(repairId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: technicianRepairsQueryKeys.workshop(workshopId),
      });
    },
  });
}
