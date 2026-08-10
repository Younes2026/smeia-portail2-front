import { useMutation } from '@tanstack/react-query';

import {
  searchAiAppointmentAvailability,
  type AiBookingAvailabilityResult,
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
