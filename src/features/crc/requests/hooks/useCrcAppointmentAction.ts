import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  crcAppointmentsApi,
  type CrcAppointmentActionResult,
  type CrcAppointmentActionVariables,
} from '@/core/api/crc-appointments.api';
import { crcAppointmentsQueryKeys } from '@/features/crc/requests/hooks/useCrcAppointments';

export function useCrcAppointmentAction() {
  const queryClient = useQueryClient();

  return useMutation<
    CrcAppointmentActionResult,
    Error,
    CrcAppointmentActionVariables
  >({
    mutationFn: crcAppointmentsApi.executeAppointmentAction,
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: crcAppointmentsQueryKeys.all,
      });
    },
  });
}
