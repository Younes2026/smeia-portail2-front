import { useMutation } from '@tanstack/react-query';

import {
  searchAiAppointmentCalendar,
  searchAiAppointmentAvailability,
  type AiBookingAvailabilityResult,
  type AiBookingCalendarResult,
  type SearchAiAppointmentCalendarInput,
  type SearchAiAppointmentAvailabilityInput,
} from '@/core/api/ai-booking.api';

export function useSearchAiAppointmentAvailability() {
  return useMutation<
    AiBookingAvailabilityResult,
    Error,
    SearchAiAppointmentAvailabilityInput
  >({
    mutationFn: searchAiAppointmentAvailability,
    retry: false,
  });
}

export function useSearchAiAppointmentCalendar() {
  return useMutation<
    AiBookingCalendarResult,
    Error,
    SearchAiAppointmentCalendarInput
  >({
    mutationFn: searchAiAppointmentCalendar,
    retry: false,
  });
}
