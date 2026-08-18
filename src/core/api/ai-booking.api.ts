import type {
  AiBookingWorkshopType,
  AiDiagnosticServiceTypeId,
} from '@/core/api/ai-diagnostics.api';
import { httpClient } from '@/core/api/http-client';

export type AiBookingPreferredPeriod = 'any' | 'morning' | 'afternoon';
export type AiBookingResultMode = 'suggestions' | 'day_slots' | 'calendar';

export type SearchAiAppointmentAvailabilityInput = {
  vehicle_id: number;
  service_type_id: AiDiagnosticServiceTypeId;
  showroom_id: number;
  workshop_types: AiBookingWorkshopType[];
  preferred_date: string | null;
  preferred_period: AiBookingPreferredPeriod;
  result_mode: Exclude<AiBookingResultMode, 'calendar'>;
};

export type SearchAiAppointmentCalendarInput = Omit<
  SearchAiAppointmentAvailabilityInput,
  'preferred_date' | 'preferred_period' | 'result_mode'
> & {
  preferred_date: null;
  preferred_period: 'any';
  result_mode: 'calendar';
};

export type AiBookingShowroom = {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
};

export type AiBookingAvailabilityOption = {
  slot_token: string;
  expires_at: string;
  service_type: {
    id: AiDiagnosticServiceTypeId;
    name: string;
  };
  workshop_id: number;
  workshop_name: string;
  showroom: AiBookingShowroom;
  requested_date: string;
  requested_time: string;
  slot_interval_minutes: number;
  label: string;
};

export type AiBookingAvailabilityResult = {
  preferred_date_available: boolean;
  options: AiBookingAvailabilityOption[];
};

export type AiBookingCalendarDay = {
  date: string;
  available_slot_count: number;
  morning_slot_count: number;
  afternoon_slot_count: number;
};

export type AiBookingCalendarResult = {
  result_mode: 'calendar';
  timezone: 'Africa/Casablanca';
  horizon_start: string;
  horizon_end: string;
  days: AiBookingCalendarDay[];
};

export type ConfirmAiAppointmentInput = {
  slot_token: string;
  problem_summary: string;
  confirmation: true;
};

export type ConfirmAiAppointmentVariables = {
  input: ConfirmAiAppointmentInput;
  idempotencyKey: string;
};

export type AiBookingConfirmationResult = {
  appointment_id: number;
  status: 'pending';
  vehicle: {
    id: number;
    label: string;
  };
  service_type: {
    id: AiDiagnosticServiceTypeId;
    name: string;
  };
  workshop: {
    id: number;
    name: string;
  };
  showroom: AiBookingShowroom;
  requested_date: string;
  requested_time: string;
  problem_summary: string;
};

export function searchAiAppointmentAvailability(
  input: SearchAiAppointmentAvailabilityInput
) {
  return httpClient.post<AiBookingAvailabilityResult>(
    '/api/ai/appointments/availability',
    input,
    { destination: 'aiBackend' }
  );
}

export function searchAiAppointmentCalendar(
  input: SearchAiAppointmentCalendarInput
) {
  return httpClient.post<AiBookingCalendarResult>(
    '/api/ai/appointments/availability',
    input,
    { destination: 'aiBackend' }
  );
}

export function confirmAiAppointment({
  input,
  idempotencyKey,
}: ConfirmAiAppointmentVariables) {
  return httpClient.post<AiBookingConfirmationResult>(
    '/api/ai/appointments/confirm',
    input,
    {
      destination: 'aiBackend',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }
  );
}

export const aiBookingApi = {
  searchAiAppointmentAvailability,
  searchAiAppointmentCalendar,
  confirmAiAppointment,
};
