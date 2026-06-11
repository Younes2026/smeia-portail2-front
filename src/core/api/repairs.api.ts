import { httpClient } from '@/core/api/http-client';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';

const REPAIRS_FIELDS = [
  '*',
  'vehicle_id.*',
  'customer_id.*',
  'brand_id.*',
  'status_id.*',
  'service_type_id.*',
  'workshop_id.*',
].join(',');

export const repairsApi = {
  getRepairs: () => {
    return httpClient.get<DirectusRepair[]>(
      `/items/repairs?fields=${REPAIRS_FIELDS}`
    );
  },

  getRepairById: (id: number) => {
    return httpClient.get<DirectusRepair>(
      `/items/repairs/${id}?fields=${REPAIRS_FIELDS}`
    );
  },
};