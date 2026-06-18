import { httpClient } from '@/core/api/http-client';

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
  customer_id: number | { id: number };
  vehicle_id:
    | number
    | {
        id: number;
        model?: string | null;
        registration_number?: string | null;
        brand_id?: number | { id: number; name?: string | null } | null;
      };
  service_type_id: number | { id: number; name?: string | null };
  workshop_id: number | { id: number; name?: string | null };
  requested_date: string;
  requested_time: string;
  status: string;
  comment?: string | null;
};

type CreateAppointmentBody = {
  customer_id: number;
  vehicle_id: number;
  service_type_id: number;
  workshop_id: number;
  requested_date: string;
  requested_time: string;
  status: 'pending';
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

function buildCustomerAppointmentsEndpoint(customerId: number): string {
  const searchParams = new URLSearchParams({
    fields: APPOINTMENT_FIELDS.join(','),
    sort: '-requested_date,-requested_time',
  });

  searchParams.set('filter[customer_id][_eq]', String(customerId));

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
      status: 'pending',
    };
    const normalizedComment = comment?.trim();

    if (normalizedComment) {
      body.comment = normalizedComment;
    }

    return httpClient.post<DirectusAppointment>('/items/appointments', body);
  },

  getAppointmentsByCustomer: (customerId: number) => {
    return httpClient.get<DirectusAppointment[]>(
      buildCustomerAppointmentsEndpoint(customerId)
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
