import { useMutation } from '@tanstack/react-query';

import {
  appointmentsApi,
  type CreateAppointmentInput,
  type DirectusAppointment,
} from '@/core/api/appointments.api';

export function useCreateAppointment() {
  return useMutation<DirectusAppointment, Error, CreateAppointmentInput>({
    mutationFn: appointmentsApi.createAppointment,
  });
}
