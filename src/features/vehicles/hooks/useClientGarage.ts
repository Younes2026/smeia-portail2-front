import { useMemo } from 'react';

import { useAppointmentsHistory } from '@/features/appointments/hooks/useAppointmentsHistory';
import { useClientRepairPresentation } from '@/features/repairs/hooks/useClientRepairPresentation';
import { useRepairs } from '@/features/repairs/hooks/useRepairs';
import { presentClientGarage } from '@/features/vehicles/model/client-garage.presenter';

export function useClientGarage() {
  const appointmentsQuery = useAppointmentsHistory();
  const repairsQuery = useRepairs();
  const repairPresentation = useClientRepairPresentation(
    repairsQuery.data ?? [],
    appointmentsQuery.data ?? []
  );
  const vehicles = useMemo(
    () =>
      presentClientGarage({
        appointments: appointmentsQuery.data ?? [],
        brands: repairPresentation.brands,
        repairs: repairPresentation.data,
        vehicles: repairPresentation.vehicles,
      }),
    [
      appointmentsQuery.data,
      repairPresentation.brands,
      repairPresentation.data,
      repairPresentation.vehicles,
    ]
  );

  const refetch = async () => {
    await Promise.all([
      appointmentsQuery.refetch(),
      repairsQuery.refetch(),
      repairPresentation.vehiclesQuery.refetch(),
    ]);
  };

  return {
    data: vehicles,
    isError:
      appointmentsQuery.isError ||
      repairsQuery.isError ||
      repairPresentation.vehiclesQuery.isError,
    isLoading:
      appointmentsQuery.isLoading ||
      repairsQuery.isLoading ||
      repairPresentation.isLoading,
    refetch,
  };
}
