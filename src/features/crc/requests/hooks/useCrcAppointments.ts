import { useQuery } from '@tanstack/react-query';

import {
  crcAppointmentsApi,
  type CrcAppointment,
  type CrcAppointmentQueue,
} from '@/core/api/crc-appointments.api';
import { isDirectusCrcRole } from '@/core/auth/directus-roles';
import { useAuthStore } from '@/store/auth.store';

export const crcAppointmentsQueryKeys = {
  all: ['crc', 'appointments'] as const,
  list: (queue: CrcAppointmentQueue) =>
    ['crc', 'appointments', 'list', queue] as const,
  detail: (appointmentId: number | null) =>
    ['crc', 'appointments', 'detail', appointmentId] as const,
};

function useCanReadCrcAppointments(): boolean {
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.user?.role);

  return Boolean(accessToken && isDirectusCrcRole(role));
}

export function useCrcAppointments(queue: CrcAppointmentQueue) {
  const canRead = useCanReadCrcAppointments();

  return useQuery<CrcAppointment[], Error>({
    queryKey: crcAppointmentsQueryKeys.list(queue),
    queryFn: () => crcAppointmentsApi.getAppointments(queue),
    enabled: canRead,
    refetchOnWindowFocus: true,
  });
}

export function useCrcAppointment(appointmentId: number | null) {
  const canRead = useCanReadCrcAppointments();

  return useQuery<CrcAppointment, Error>({
    queryKey: crcAppointmentsQueryKeys.detail(appointmentId),
    queryFn: () => {
      if (appointmentId === null) {
        throw new Error('Identifiant de rendez-vous CRC manquant.');
      }

      return crcAppointmentsApi.getAppointment(appointmentId);
    },
    enabled: canRead && appointmentId !== null,
    refetchOnWindowFocus: true,
  });
}
