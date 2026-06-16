import { httpClient } from '@/core/api/http-client';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';

const REPAIRS_FIELDS = [
  '*',
  'vehicle_id.*',
  'vehicle_id.customer_id.*',
  'vehicle_id.brand_id.*',
  'status_id.*',
  'service_type_id.*',
  'workshop_id.*',
] as const;

type RepairsQueryOptions = {
  customerId?: number;
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

  return `${path}?${searchParams.toString()}`;
}

export const repairsApi = {
  getRepairs: (customerId: number) => {
    return httpClient.get<DirectusRepair[]>(
      buildRepairsEndpoint('/items/repairs', { customerId })
    );
  },

  getRepairById: (id: number) => {
    return httpClient.get<DirectusRepair>(
      buildRepairsEndpoint(`/items/repairs/${id}`)
    );
  },
};
