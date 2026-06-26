import { httpClient } from '@/core/api/http-client';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';

const REPAIRS_FIELDS = [
  '*',
  'customer_id.*',
  'vehicle_id.*',
  'vehicle_id.customer_id.*',
  'vehicle_id.brand_id.*',
  'status_id.*',
  'service_type_id.*',
  'workshop_id.*',
] as const;

type RepairsQueryOptions = {
  customerId?: number;
  repairId?: number;
  vehicleId?: number;
  limit?: number;
};

function buildRepairsEndpoint(
  path: string,
  options: RepairsQueryOptions = {}
): string {
  const searchParams = new URLSearchParams({
    fields: REPAIRS_FIELDS.join(','),
  });

  if (options.customerId !== undefined) {
    searchParams.set(
      'filter[vehicle_id][customer_id][_eq]',
      String(options.customerId)
    );
  }

  if (options.repairId !== undefined) {
    searchParams.set('filter[id][_eq]', String(options.repairId));
  }

  if (options.vehicleId !== undefined) {
    searchParams.set('filter[vehicle_id][_eq]', String(options.vehicleId));
  }

  if (options.limit !== undefined) {
    searchParams.set('limit', String(options.limit));
  }

  return `${path}?${searchParams.toString()}`;
}

export const repairsApi = {
  getRepairs: (customerId: number) => {
    return httpClient.get<DirectusRepair[]>(
      buildRepairsEndpoint('/items/repairs', { customerId })
    );
  },

  getRepairById: async (id: number, customerId?: number) => {
    if (customerId !== undefined) {
      const repairs = await httpClient.get<DirectusRepair[]>(
        buildRepairsEndpoint('/items/repairs', {
          customerId,
          repairId: id,
          limit: 1,
        })
      );

      return repairs[0] ?? null;
    }

    return httpClient.get<DirectusRepair>(
      buildRepairsEndpoint(`/items/repairs/${id}`)
    );
  },

  getRepairsByVehicleId: (vehicleId: number) => {
    return httpClient.get<DirectusRepair[]>(
      buildRepairsEndpoint('/items/repairs', { vehicleId })
    );
  },
};
