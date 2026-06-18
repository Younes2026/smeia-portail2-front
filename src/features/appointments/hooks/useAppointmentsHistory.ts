import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { appointmentsApi } from '@/core/api/appointments.api';
import { mapAppointmentsToListItems } from '@/features/appointments/model/appointment.mapper';
import { useAuthStore } from '@/store/auth.store';

export const appointmentsQueryKeys = {
  all: ['appointments'] as const,
  customer: (customerId: number | null) =>
    ['appointments', 'customer', customerId] as const,
};

export function useAppointmentsHistory() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery({
    queryKey: appointmentsQueryKeys.customer(customerId),
    queryFn: async () => {
      if (customerId === null) {
        return [];
      }

      const appointments =
        await appointmentsApi.getAppointmentsByCustomer(customerId);

      return mapAppointmentsToListItems(appointments);
    },
    refetchOnWindowFocus: true,
  });
}

export function useCancelAppointment() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: appointmentsApi.cancelAppointment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: appointmentsQueryKeys.customer(customerId),
      });
    },
  });
}
