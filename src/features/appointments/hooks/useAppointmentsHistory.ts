import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { appointmentsApi } from '@/core/api/appointments.api';
import { getDirectusRelationId } from '@/core/api/directus-relation';
import { vehiclesApi } from '@/core/api/vehicles.api';
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

      const [appointments, vehicles] = await Promise.all([
        appointmentsApi.getAppointmentsByCustomer(customerId),
        vehiclesApi.getVehicles(customerId),
      ]);
      const ownedVehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
      const customerAppointments = appointments.filter((appointment) => {
        const appointmentCustomerId = getDirectusRelationId(
          appointment.customer_id
        );
        const appointmentVehicleId = getDirectusRelationId(
          appointment.vehicle_id
        );

        return (
          appointmentCustomerId === customerId &&
          appointmentVehicleId !== null &&
          ownedVehicleIds.has(appointmentVehicleId)
        );
      });

      return mapAppointmentsToListItems(customerAppointments);
    },
    enabled: customerId !== null,
    refetchOnMount: 'always',
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
