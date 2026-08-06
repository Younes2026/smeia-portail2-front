import { httpClient } from '@/core/api/http-client';
import type { DirectusRepair, DirectusResource } from '@/features/repairs/model/repair.types';

const TECHNICIAN_RESOURCE_FIELDS = [
  'id',
  'directus_user_id',
  'workshop_id',
  'workshop_id.*',
  'full_name',
  'specialty',
  'daily_hours',
  'active',
] as const;

const TECHNICIAN_REPAIR_FIELDS = [
  '*',
  'customer_id.*',
  'vehicle_id.*',
  'vehicle_id.brand_id.*',
  'vehicle_id.customer_id.*',
  'status_id.*',
  'service_type_id.*',
  'workshop_id.*',
  'resource_id.*',
] as const;

export type TechnicianRepairPatch = Partial<{
  note: string | null;
  real_diagnosis: string | null;
  resource_id: number | null;
  solution_description: string | null;
  technician_recommendations: string | null;
  work_done: string | null;
}>;

function buildTechnicianResourceEndpoint(directusUserId?: string): string {
  const searchParams = new URLSearchParams({
    fields: TECHNICIAN_RESOURCE_FIELDS.join(','),
    limit: '1',
  });

  if (directusUserId) {
    searchParams.set('filter[directus_user_id][_eq]', directusUserId);
  }

  searchParams.set('filter[active][_eq]', 'true');

  return `/items/resources?${searchParams.toString()}`;
}

function buildTechnicianRepairsEndpoint(workshopId: number): string {
  const searchParams = new URLSearchParams({
    fields: TECHNICIAN_REPAIR_FIELDS.join(','),
    sort: '-entry_date,-appointment_date,-id',
    limit: '200',
  });

  searchParams.set('filter[workshop_id][_eq]', String(workshopId));

  return `/items/repairs?${searchParams.toString()}`;
}

export const technicianApi = {
  getCurrentTechnicianResource: async (directusUserId?: string) => {
    const resources = await httpClient.get<DirectusResource[]>(
      buildTechnicianResourceEndpoint(directusUserId)
    );

    return resources[0] ?? null;
  },

  getRepairsByWorkshop: (workshopId: number) => {
    return httpClient.get<DirectusRepair[]>(
      buildTechnicianRepairsEndpoint(workshopId)
    );
  },

  patchRepair: (repairId: number, patch: TechnicianRepairPatch) => {
    return httpClient.patch<DirectusRepair>(`/items/repairs/${repairId}`, patch);
  },
};
