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

export const vehiclesApi = {
  getVehicles: (customerId: number) => {
    return httpClient.get<DirectusVehicle[]>(
      buildVehiclesEndpoint(customerId)
    );
  },
};
