import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  confirmAiAppointment,
  type AiBookingConfirmationResult,
  type ConfirmAiAppointmentVariables,
} from '@/core/api/ai-booking.api';
import { appointmentsQueryKeys } from '@/features/appointments/hooks/useAppointmentsHistory';
import { useAuthStore } from '@/store/auth.store';

export function useConfirmAiAppointment() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<
    AiBookingConfirmationResult,
    Error,
    ConfirmAiAppointmentVariables
  >({
    mutationFn: confirmAiAppointment,
    retry: false,
    onSuccess: async () => {
      if (customerId === null) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: appointmentsQueryKeys.customer(customerId),
      });
    },
  });
}
