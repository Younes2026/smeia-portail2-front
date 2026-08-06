import { httpClient } from '@/core/api/http-client';
import type { DirectusAppointment } from '@/core/api/appointments.api';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';

const SAV_APPOINTMENT_FIELDS = [
  'id',
  'customer_id',
  'vehicle_id',
  'service_type_id',
  'workshop_id',
  'requested_date',
  'requested_time',
  'status',
  'comment',
] as const;

const SAV_REPAIR_FIELDS = [
  'id',
  'document_number',
  'vehicle_id',
  'customer_id',
  'status_id',
  'service_type_id',
  'workshop_id',
  'start_date',
  'end_date',
] as const;

function buildSavAppointmentsEndpoint(workshopId?: number | null): string {
  const searchParams = new URLSearchParams({
    fields: SAV_APPOINTMENT_FIELDS.join(','),
    sort: '-requested_date,-requested_time',
    limit: '100',
  });

  if (workshopId !== undefined && workshopId !== null) {
    searchParams.set('filter[workshop_id][_eq]', String(workshopId));
  }

  return `/items/appointments?${searchParams.toString()}`;
}

function buildSavRepairsEndpoint(workshopId?: number | null): string {
  const searchParams = new URLSearchParams({
    fields: SAV_REPAIR_FIELDS.join(','),
    sort: '-start_date',
    limit: '100',
  });

  if (workshopId !== undefined && workshopId !== null) {
    searchParams.set('filter[workshop_id][_eq]', String(workshopId));
  }

  return `/items/repairs?${searchParams.toString()}`;
}

function buildSavRepairsFallbackEndpoint(workshopId?: number | null): string {
  const searchParams = new URLSearchParams({
    limit: '100',
  });

  if (workshopId !== undefined && workshopId !== null) {
    searchParams.set('filter[workshop_id][_eq]', String(workshopId));
  }

  return `/items/repairs?${searchParams.toString()}`;
}

export const savDashboardApi = {
  getAppointments: (workshopId?: number | null) => {
    return httpClient.get<DirectusAppointment[]>(
      buildSavAppointmentsEndpoint(workshopId)
    );
  },

  getRepairs: async (workshopId?: number | null) => {
    try {
      return await httpClient.get<DirectusRepair[]>(
        buildSavRepairsEndpoint(workshopId)
      );
    } catch {
      return httpClient.get<DirectusRepair[]>(
        buildSavRepairsFallbackEndpoint(workshopId)
      );
    }
  },
};
