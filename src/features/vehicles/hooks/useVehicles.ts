import { useQuery } from '@tanstack/react-query';

import { vehiclesApi } from '@/core/api/vehicles.api';
import { mapVehiclesToListItems } from '@/features/vehicles/model/vehicle.mapper';
import { useAuthStore } from '@/store/auth.store';

export const vehiclesQueryKeys = {
  all: (customerId: number | null) =>
    ['vehicles', 'customer', customerId] as const,
};

export function useVehicles() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery({
    queryKey: vehiclesQueryKeys.all(customerId),
    queryFn: async () => {
      if (customerId === null) {
        return [];
      }

      const vehicles = await vehiclesApi.getVehicles(customerId);

      return mapVehiclesToListItems(vehicles);
    },
    refetchOnWindowFocus: true,
  });
}
