import { httpClient } from '@/core/api/http-client';
import type { DirectusVehicle } from '@/features/vehicles/model/vehicle.types';

const VEHICLE_FIELDS = [
  'id',
  'model',
  'registration_number',
  'year',
  'mileage',
  'vin',
  'brand_id.*',
  'customer_id',
] as const;

function buildVehiclesEndpoint(customerId: number): string {
  const searchParams = new URLSearchParams({
    fields: VEHICLE_FIELDS.join(','),
  });

  searchParams.set('filter[customer_id][_eq]', String(customerId));

  return `/items/vehicles?${searchParams.toString()}`;
}

function buildVehicleDetailEndpoint(
  vehicleId: number,
  customerId: number
): string {
  const searchParams = new URLSearchParams({
    fields: VEHICLE_FIELDS.join(','),
    limit: '1',
  });

  searchParams.set('filter[id][_eq]', String(vehicleId));
  searchParams.set('filter[customer_id][_eq]', String(customerId));

  return `/items/vehicles?${searchParams.toString()}`;
}

export const vehiclesApi = {
  getVehicles: (customerId: number) => {
    return httpClient.get<DirectusVehicle[]>(
      buildVehiclesEndpoint(customerId)
    );
  },

  getVehicleByIdForCustomer: async (
    vehicleId: number,
    customerId: number
  ) => {
    const vehicles = await httpClient.get<DirectusVehicle[]>(
      buildVehicleDetailEndpoint(vehicleId, customerId)
    );

    return vehicles[0] ?? null;
  },
};
