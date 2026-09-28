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
  | 'cancelled'
  | 'arrived';

export type CrcAppointmentAction = 'callback' | 'reject' | 'confirm';

export type CrcRejectionReasonCode =
  | 'service_unavailable'
  | 'insufficient_information'
  | 'vehicle_ineligible_or_incorrect'
  | 'other';

export type CrcCallbackActionBody = {
  internal_note?: string;
};

export type CrcRejectActionBody = {
  reason_code: CrcRejectionReasonCode;
  public_message?: string;
  internal_note?: string;
};

export type CrcConfirmActionBody = {
  internal_note?: string;
};

export type CrcAppointmentActionResult = {
  appointment_id: number;
  action: CrcAppointmentAction;
  status_from: 'pending' | 'callback_pending';
  status_to: 'callback_pending' | 'rejected' | 'confirmed';
  event_id?: string;
  history_recorded: true;
};

export type CrcAppointmentActionVariables =
  | {
      appointmentId: number;
      action: 'callback';
      body: CrcCallbackActionBody;
      idempotencyKey: string;
    }
  | {
      appointmentId: number;
      action: 'reject';
      body: CrcRejectActionBody;
      idempotencyKey: string;
    }
  | {
      appointmentId: number;
      action: 'confirm';
      body: CrcConfirmActionBody;
      idempotencyKey: string;
    };

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

function executeAppointmentAction({
  appointmentId,
  action,
  body,
  idempotencyKey,
}: CrcAppointmentActionVariables) {
  return httpClient.post<CrcAppointmentActionResult>(
    `/api/crc/appointments/${encodeURIComponent(String(appointmentId))}/${action}`,
    body,
    {
      destination: 'aiBackend',
      headers: { 'Idempotency-Key': idempotencyKey },
    }
  );
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

  executeAppointmentAction,
};
