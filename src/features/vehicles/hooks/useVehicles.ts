import { useQuery } from '@tanstack/react-query';

import { repairsApi } from '@/core/api/repairs.api';
import { vehiclesApi } from '@/core/api/vehicles.api';
import {
  mapVehicleRepairsToListItems,
  mapVehicleToListItem,
  mapVehiclesToListItems,
} from '@/features/vehicles/model/vehicle.mapper';
import { useAuthStore } from '@/store/auth.store';

export const vehiclesQueryKeys = {
  all: (customerId: number | null) =>
    ['vehicles', 'customer', customerId] as const,
  detail: (customerId: number | null, vehicleId: number | null) =>
    ['vehicles', 'customer', customerId, 'detail', vehicleId] as const,
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

export function useVehicleDetail(vehicleId: number | null) {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery({
    queryKey: vehiclesQueryKeys.detail(customerId, vehicleId),
    queryFn: async () => {
      if (customerId === null || vehicleId === null) {
        return {
          vehicle: null,
          repairs: [],
        };
      }

      const vehicle = await vehiclesApi.getVehicleByIdForCustomer(
        vehicleId,
        customerId
      );

      if (!vehicle) {
        return {
          vehicle: null,
          repairs: [],
        };
      }

      const repairs = await repairsApi.getRepairsByVehicleId(vehicleId);

      return {
        vehicle: mapVehicleToListItem(vehicle),
        repairs: mapVehicleRepairsToListItems(repairs),
      };
    },
    refetchOnWindowFocus: true,
  });
}
