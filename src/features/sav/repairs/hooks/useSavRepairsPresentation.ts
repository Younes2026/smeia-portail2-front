import { useMemo } from 'react';

import {
  useBrands,
  useServiceTypes,
  useStatuses,
  useWorkshops,
} from '@/core/api/use-dictionaries';
import { useSavAppointments } from '@/features/sav/appointments/hooks/useSavAppointments';
import { useSavRepairs } from '@/features/sav/repairs/hooks/useSavRepairs';
import { presentSavRepairs } from '@/features/sav/repairs/model/sav-repair.presenter';

export function useSavRepairsPresentation() {
  const repairsQuery = useSavRepairs();
  const appointmentsQuery = useSavAppointments();
  const brandsQuery = useBrands();
  const statusesQuery = useStatuses();
  const serviceTypesQuery = useServiceTypes();
  const workshopsQuery = useWorkshops();

  const repairs = useMemo(
    () =>
      presentSavRepairs({
        repairs: repairsQuery.data ?? [],
        appointments: appointmentsQuery.data ?? [],
        brands: brandsQuery.data ?? [],
        statuses: statusesQuery.data ?? [],
        serviceTypes: serviceTypesQuery.data ?? [],
        workshops: workshopsQuery.data ?? [],
      }),
    [
      appointmentsQuery.data,
      brandsQuery.data,
      repairsQuery.data,
      serviceTypesQuery.data,
      statusesQuery.data,
      workshopsQuery.data,
    ]
  );

  const refresh = async () => {
    await Promise.all([
      repairsQuery.refetch(),
      appointmentsQuery.refetch(),
      brandsQuery.refetch(),
      statusesQuery.refetch(),
      serviceTypesQuery.refetch(),
      workshopsQuery.refetch(),
    ]);
  };

  return {
    repairs,
    isLoading: repairsQuery.isLoading,
    isRefreshing: repairsQuery.isFetching || appointmentsQuery.isFetching,
    error: repairsQuery.error,
    refresh,
  };
}
