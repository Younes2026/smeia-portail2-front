import { httpClient } from '@/core/api/http-client';

export type CrcAppointmentQueue =
  | 'new'
  | 'callback'
  | 'proposed'
  | 'processed';

export type CrcAppointmentStatus =
  | 'pending'
  | 'callback_pending'
  | 'alternative_proposed'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

export type CrcAppointment = {
  id: number;
  received_at: string | null;
  customer: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  vehicle: {
    id: number;
    brand_name: string | null;
    model: string | null;
    registration_number: string | null;
  };
  service_type: {
    id: number;
    name: string;
  };
  workshop: {
    id: number;
    name: string;
    workshop_type: 'diagnostic' | 'mecanique' | 'carrosserie' | 'peinture';
    showroom: {
      id: number;
      name: string;
      city: string | null;
      address: string | null;
    };
  };
  requested_date: string;
  requested_time: string;
  status: CrcAppointmentStatus;
  problem_summary: string | null;
};

function buildListEndpoint(queue: CrcAppointmentQueue): string {
  const searchParams = new URLSearchParams({ queue });

  return `/api/crc/appointments?${searchParams.toString()}`;
}

export const crcAppointmentsApi = {
  getAppointments: (queue: CrcAppointmentQueue) =>
    httpClient.get<CrcAppointment[]>(buildListEndpoint(queue), {
      destination: 'aiBackend',
    }),

  getAppointment: (appointmentId: number) =>
    httpClient.get<CrcAppointment>(
      `/api/crc/appointments/${encodeURIComponent(String(appointmentId))}`,
      { destination: 'aiBackend' }
    ),
};
