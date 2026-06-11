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

function buildRepairsEndpoint(path: string): string {
  const searchParams = new URLSearchParams({
    fields: REPAIRS_FIELDS.join(','),
  });

  return `${path}?${searchParams.toString()}`;
}

export const repairsApi = {
  getRepairs: () => {
    return httpClient.get<DirectusRepair[]>(
      buildRepairsEndpoint('/items/repairs')
    );
  },

  getRepairById: (id: number) => {
    return httpClient.get<DirectusRepair>(
      buildRepairsEndpoint(`/items/repairs/${id}`)
    );
  },
};
