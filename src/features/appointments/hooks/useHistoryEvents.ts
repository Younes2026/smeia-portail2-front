import { useMemo } from 'react';

import { useAppointmentsHistory } from '@/features/appointments/hooks/useAppointmentsHistory';
import {
  presentHistoryEvents,
  type HistoryEvent,
} from '@/features/appointments/model/history-event.presenter';
import { useClientRepairPresentation } from '@/features/repairs/hooks/useClientRepairPresentation';
import { useRepairs } from '@/features/repairs/hooks/useRepairs';

type HistoryEventsResult = {
  appointmentsQuery: ReturnType<typeof useAppointmentsHistory>;
  events: HistoryEvent[];
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
};

export function useHistoryEvents(): HistoryEventsResult {
  const appointmentsQuery = useAppointmentsHistory();
  const repairsQuery = useRepairs();
  const appointments = appointmentsQuery.data ?? [];
  const repairs = repairsQuery.data ?? [];
  const repairPresentation = useClientRepairPresentation(
    repairs,
    appointments
  );
  const presentedRepairs = repairPresentation.data;
  const events = useMemo(
    () =>
      presentHistoryEvents({
        appointments,
        brands: repairPresentation.brands,
        repairs: presentedRepairs,
        serviceTypes: repairPresentation.serviceTypes,
        vehicles: repairPresentation.vehicles,
        workshops: repairPresentation.workshops,
      }),
    [
      appointments,
      presentedRepairs,
      repairPresentation.brands,
      repairPresentation.serviceTypes,
      repairPresentation.vehicles,
      repairPresentation.workshops,
    ]
  );

  return {
    appointmentsQuery,
    events,
    isError: appointmentsQuery.isError || repairsQuery.isError,
    isLoading:
      appointmentsQuery.isLoading ||
      repairsQuery.isLoading ||
      repairPresentation.isLoading,
    refetch: () => {
      void Promise.all([
        appointmentsQuery.refetch(),
        repairsQuery.refetch(),
        repairPresentation.vehiclesQuery.refetch(),
      ]);
    },
  };
}
