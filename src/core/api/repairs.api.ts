import { dictionariesApi } from '@/core/api/dictionaries.api';
import { HttpError, httpClient } from '@/core/api/http-client';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';

const REPAIRS_FIELDS = [
  '*',
  'customer_id.*',
  'vehicle_id.*',
  'vehicle_id.brand_id.*',
  'vehicle_id.customer_id.*',
  'status_id.*',
  'service_type_id.*',
  'workshop_id.*',
] as const;

const CLIENT_REPAIR_FIELDS = [
  'id',
  'vehicle_id',
  'status_id',
  'service_type_id',
  'workshop_id',
  'workshop_id.id',
  'workshop_id.name',
  'workshop_id.showroom_id.id',
  'workshop_id.showroom_id.name',
  'workshop_id.showroom_id.address',
  'workshop_id.showroom_id.city',
  'workshop_id.showroom_id.phone',
  'entry_date',
  'appointment_id',
  'description',
  'note',
  'real_diagnosis',
  'work_done',
  'solution_description',
  'technician_recommendations',
  'real_exit_date',
  'entry_mileage',
  'document_number',
  'receptionist_name',
] as const;

type RepairsQueryOptions = {
  appointmentId?: number | string;
  customerId?: number;
  repairId?: number;
  vehicleId?: number;
  workshopId?: number;
  limit?: number;
};

export type CreateRepairFromAppointmentInput = {
  appointmentId: number | string;
  customerId: number;
  serviceTypeId: number;
  vehicleId: number;
  workshopId: number;
};

type CreateRepairBody = {
  appointment_id?: number | string;
  customer_id: number;
  entry_date?: string;
  service_type_id: number;
  status_id: number;
  vehicle_id: number;
  workshop_id: number;
};

function buildRepairsEndpoint(
  path: string,
  options: RepairsQueryOptions = {},
  fields: readonly string[] = REPAIRS_FIELDS
): string {
  const searchParams = new URLSearchParams({
    fields: fields.join(','),
  });

  if (options.customerId !== undefined) {
    searchParams.set(
      'filter[_or][0][customer_id][_eq]',
      String(options.customerId)
    );
    searchParams.set(
      'filter[_or][1][vehicle_id][customer_id][_eq]',
      String(options.customerId)
    );
  }

  if (options.appointmentId !== undefined) {
    searchParams.set('filter[appointment_id][_eq]', String(options.appointmentId));
  }

  if (options.repairId !== undefined) {
    searchParams.set('filter[id][_eq]', String(options.repairId));
  }

  if (options.vehicleId !== undefined) {
    searchParams.set('filter[vehicle_id][_eq]', String(options.vehicleId));
  }

  if (options.workshopId !== undefined) {
    searchParams.set('filter[workshop_id][_eq]', String(options.workshopId));
  }

  if (options.limit !== undefined) {
    searchParams.set('limit', String(options.limit));
  }

  return `${path}?${searchParams.toString()}`;
}

function formatDirectusDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizeStatusName(value: string): string {
  return value.trim().toLocaleLowerCase('fr-FR').replace(/[-_]/g, ' ');
}

async function getDefaultRepairStatusId(): Promise<number> {
  const statuses = await dictionariesApi.getStatuses();
  const preferredStatus =
    statuses.find(
      (status) => normalizeStatusName(status.name) === 'in progress'
    ) ??
    statuses.find((status) => normalizeStatusName(status.name) === 'pending');

  if (!preferredStatus) {
    throw new Error(
      'Statut de réparation par défaut introuvable : In Progress ou Pending.'
    );
  }

  return preferredStatus.id;
}

function buildRepairFromAppointmentBodies({
  appointmentId,
  customerId,
  serviceTypeId,
  statusId,
  vehicleId,
  workshopId,
}: CreateRepairFromAppointmentInput & { statusId: number }): CreateRepairBody[] {
  const baseBody = {
    customer_id: customerId,
    service_type_id: serviceTypeId,
    status_id: statusId,
    vehicle_id: vehicleId,
    workshop_id: workshopId,
  };

  return [
    {
      ...baseBody,
      appointment_id: appointmentId,
      entry_date: formatDirectusDate(new Date()),
    },
    {
      ...baseBody,
      appointment_id: appointmentId,
    },
    baseBody,
  ];
}

function canFallbackRepairPayload(error: unknown): boolean {
  return error instanceof HttpError && [400, 403, 404].includes(error.status);
}

async function postRepairWithFallbacks(
  bodies: CreateRepairBody[]
): Promise<DirectusRepair> {
  const [body, ...fallbackBodies] = bodies;

  try {
    return await httpClient.post<DirectusRepair>('/items/repairs', body);
  } catch (error) {
    if (fallbackBodies.length === 0 || !canFallbackRepairPayload(error)) {
      throw error;
    }

    return postRepairWithFallbacks(fallbackBodies);
  }
}

export const repairsApi = {
  getClientRepairs: async (customerId: number | null) => {
    if (customerId === null) {
      return [];
    }

    try {
      return await httpClient.get<DirectusRepair[]>(
        buildRepairsEndpoint(
          '/items/repairs',
          {},
          CLIENT_REPAIR_FIELDS
        )
      );
    } catch (error) {
      console.warn('Impossible de charger les réparations du client.', error);
      throw error;
    }
  },

  getClientRepairById: async (
    repairId: number,
    customerId: number | null
  ) => {
    if (customerId === null) {
      return null;
    }

    try {
      const repairs = await httpClient.get<DirectusRepair[]>(
        buildRepairsEndpoint(
          '/items/repairs',
          { repairId, limit: 1 },
          CLIENT_REPAIR_FIELDS
        )
      );

      return repairs[0] ?? null;
    } catch (error) {
      console.warn('Impossible de charger la réparation du client.', error);
      throw error;
    }
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

  getRepairsByWorkshop: async (workshopId: number) => {
    return httpClient.get<DirectusRepair[]>(
      buildRepairsEndpoint('/items/repairs', { workshopId, limit: 200 })
    );
  },

  getRepairByAppointmentId: async (appointmentId: number | string) => {
    try {
      const repairs = await httpClient.get<DirectusRepair[]>(
        buildRepairsEndpoint('/items/repairs', {
          appointmentId,
          limit: 1,
        })
      );

      return repairs[0] ?? null;
    } catch (error) {
      if (
        error instanceof HttpError &&
        ![400, 403, 404].includes(error.status)
      ) {
        throw error;
      }

      return null;
    }
  },

  createRepairFromAppointment: async (input: CreateRepairFromAppointmentInput) => {
    const statusId = await getDefaultRepairStatusId();

    return postRepairWithFallbacks(
      buildRepairFromAppointmentBodies({ ...input, statusId })
    );
  },
};
