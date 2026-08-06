import { httpClient } from '@/core/api/http-client';
import { getDirectusRelationId } from '@/core/api/directus-relation';

export type CreateAppointmentInput = {
  customerId: number;
  vehicleId: number;
  serviceTypeId: number;
  workshopId: number;
  requestedDate: string;
  requestedTime: string;
  comment?: string;
};

export type DirectusAppointment = {
  id: number | string;
  customer_id:
    | number
    | {
        id: number;
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
        phone?: string | null;
      }
    | null;
  vehicle_id:
    | number
    | {
        id: number;
        model?: string | null;
        registration_number?: string | null;
        brand_id?: number | { id: number; name?: string | null } | null;
        customer_id?: number | { id: number } | null;
      };
  service_type_id: number | { id: number; name?: string | null };
  workshop_id: number | { id: number; name?: string | null };
  requested_date: string;
  requested_time: string;
  status: string;
  comment?: string | null;
  cancellation_reason?: string | null;
  arrival_confirmed_at?: string | null;
  repairs?: Array<number | string> | number | string | null;
};

type CreateAppointmentBody = {
  customer_id: number;
  vehicle_id: number;
  service_type_id: number;
  workshop_id: number;
  requested_date: string;
  requested_time: string;
  comment?: string;
};

const APPOINTMENT_FIELDS = [
  'id',
  'customer_id',
  'vehicle_id.*',
  'vehicle_id.brand_id.*',
  'service_type_id.*',
  'workshop_id.*',
  'requested_date',
  'requested_time',
  'status',
  'comment',
] as const;

const SAV_APPOINTMENT_FIELDS = [
  'id',
  'customer_id.*',
  'vehicle_id.*',
  'vehicle_id.brand_id.*',
  'service_type_id.*',
  'workshop_id.*',
  'requested_date',
  'requested_time',
  'status',
  'comment',
  'cancellation_reason',
  'arrival_confirmed_at',
  'repairs',
] as const;

const SAV_APPOINTMENT_BASE_FIELDS = [
  'id',
  'customer_id',
  'vehicle_id',
  'service_type_id',
  'workshop_id',
  'requested_date',
  'requested_time',
  'status',
  'comment',
  'cancellation_reason',
  'arrival_confirmed_at',
  'repairs',
] as const;

function buildCustomerAppointmentsEndpoint(customerId: number): string {
  const searchParams = new URLSearchParams({
    fields: APPOINTMENT_FIELDS.join(','),
    sort: '-requested_date,-requested_time',
  });

  searchParams.set('filter[customer_id][_eq]', String(customerId));

  return `/items/appointments?${searchParams.toString()}`;
}

function buildWorkshopAppointmentsEndpoint(
  workshopId: number,
  fields: readonly string[]
): string {
  const searchParams = new URLSearchParams({
    fields: fields.join(','),
    sort: 'requested_date,requested_time',
  });

  searchParams.set('filter[workshop_id][_eq]', String(workshopId));

  return `/items/appointments?${searchParams.toString()}`;
}

export const appointmentsApi = {
  createAppointment: ({
    customerId,
    vehicleId,
    serviceTypeId,
    workshopId,
    requestedDate,
    requestedTime,
    comment,
  }: CreateAppointmentInput) => {
    const body: CreateAppointmentBody = {
      customer_id: customerId,
      vehicle_id: vehicleId,
      service_type_id: serviceTypeId,
      workshop_id: workshopId,
      requested_date: requestedDate,
      requested_time: requestedTime,
    };
    const normalizedComment = comment?.trim();

    if (normalizedComment) {
      body.comment = normalizedComment;
    }

    return httpClient.post<DirectusAppointment>('/items/appointments', body);
  },

  getAppointmentsByCustomer: async (customerId: number) => {
    const appointments = await httpClient.get<DirectusAppointment[]>(
      buildCustomerAppointmentsEndpoint(customerId)
    );

    return appointments.filter(
      (appointment) =>
        getDirectusRelationId(appointment.customer_id) === customerId
    );
  },

  getAppointmentsByWorkshop: async (workshopId: number) => {
    try {
      return await httpClient.get<DirectusAppointment[]>(
        buildWorkshopAppointmentsEndpoint(workshopId, SAV_APPOINTMENT_FIELDS)
      );
    } catch {
      return httpClient.get<DirectusAppointment[]>(
        buildWorkshopAppointmentsEndpoint(
          workshopId,
          SAV_APPOINTMENT_BASE_FIELDS
        )
      );
    }
  },

  confirmArrival: (appointmentId: number | string) => {
    return httpClient.patch<DirectusAppointment>(
      `/items/appointments/${encodeURIComponent(String(appointmentId))}`,
      {
        arrival_confirmed_at: new Date().toISOString(),
      }
    );
  },

  cancelSavAppointment: ({
    appointmentId,
    cancellationReason,
  }: {
    appointmentId: number | string;
    cancellationReason: string;
  }) => {
    return httpClient.patch<DirectusAppointment>(
      `/items/appointments/${encodeURIComponent(String(appointmentId))}`,
      {
        status: 'cancelled',
        cancellation_reason: cancellationReason.trim(),
      }
    );
  },

  cancelAppointment: (appointmentId: number | string) => {
    return httpClient.patch<DirectusAppointment>(
      `/items/appointments/${encodeURIComponent(String(appointmentId))}`,
      {
        status: 'cancelled',
      }
    );
  },
};
