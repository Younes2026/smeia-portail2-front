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
  customer_id: number;
  vehicle_id: number;
  service_type_id: number;
  workshop_id: number;
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
};
