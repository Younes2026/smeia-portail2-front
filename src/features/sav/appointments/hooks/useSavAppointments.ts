import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  appointmentsApi,
  type DirectusAppointment,
} from '@/core/api/appointments.api';
import {
  repairsApi,
  type CreateRepairFromAppointmentInput,
} from '@/core/api/repairs.api';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';
import { savRepairsQueryKeys } from '@/features/sav/repairs/hooks/useSavRepairs';
import { useAuthStore } from '@/store/auth.store';

export type CreateRepairFromAppointmentResult = {
  alreadyExists: boolean;
  repair: DirectusRepair;
};

export const savAppointmentsQueryKeys = {
  workshop: (workshopId: number | null) =>
    ['sav', 'appointments', 'workshop', workshopId] as const,
};

export function useSavAppointments() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const customer = useAuthStore((state) => state.customer);
  const savAgent = useAuthStore((state) => state.savAgent);
  const workshopId = useAuthStore((state) => state.savAgent?.workshopId ?? null);
  const canReadSavAppointments = Boolean(
    accessToken && savAgent && !customer && workshopId !== null
  );

  return useQuery<DirectusAppointment[], Error>({
    queryKey: savAppointmentsQueryKeys.workshop(workshopId),
    queryFn: async () => {
      if (!canReadSavAppointments || workshopId === null) {
        return [];
      }

      return appointmentsApi.getAppointmentsByWorkshop(workshopId);
    },
    enabled: canReadSavAppointments,
    refetchOnWindowFocus: true,
  });
}

export function useConfirmAppointmentArrival() {
  const workshopId = useAuthStore((state) => state.savAgent?.workshopId ?? null);
  const queryClient = useQueryClient();

  return useMutation<DirectusAppointment, Error, number | string>({
    mutationFn: appointmentsApi.confirmArrival,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: savAppointmentsQueryKeys.workshop(workshopId),
      });
    },
  });
}

export function useCancelSavAppointment() {
  const workshopId = useAuthStore((state) => state.savAgent?.workshopId ?? null);
  const queryClient = useQueryClient();

  return useMutation<
    DirectusAppointment,
    Error,
    { appointmentId: number | string; cancellationReason: string }
  >({
    mutationFn: appointmentsApi.cancelSavAppointment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: savAppointmentsQueryKeys.workshop(workshopId),
      });
    },
  });
}

export function useCreateRepairFromAppointment() {
  const workshopId = useAuthStore((state) => state.savAgent?.workshopId ?? null);
  const queryClient = useQueryClient();

  return useMutation<
    CreateRepairFromAppointmentResult,
    Error,
    CreateRepairFromAppointmentInput
  >({
    mutationFn: async (input) => {
      const existingRepair = await repairsApi.getRepairByAppointmentId(
        input.appointmentId
      );

      if (existingRepair) {
        return {
          alreadyExists: true,
          repair: existingRepair,
        };
      }

      return {
        alreadyExists: false,
        repair: await repairsApi.createRepairFromAppointment(input),
      };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: savAppointmentsQueryKeys.workshop(workshopId),
        }),
        queryClient.invalidateQueries({
          queryKey: savRepairsQueryKeys.workshop(workshopId),
        }),
      ]);
    },
  });
}
