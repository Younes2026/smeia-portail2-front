import { useQuery } from '@tanstack/react-query';

import { technicianApi } from '@/core/api/technician.api';
import type { DirectusResource } from '@/features/repairs/model/repair.types';
import { useAuthStore } from '@/store/auth.store';

export const technicianProfileQueryKeys = {
  current: (userId?: string | null) => ['technician', 'profile', userId] as const,
};

export function useTechnicianProfile() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const technician = useAuthStore((state) => state.technician);
  const canReadProfile = Boolean(accessToken && userId && technician);

  return useQuery<DirectusResource | null, Error>({
    queryKey: technicianProfileQueryKeys.current(userId),
    queryFn: () => technicianApi.getCurrentTechnicianResource(userId ?? undefined),
    enabled: canReadProfile,
    refetchOnWindowFocus: true,
  });
}
