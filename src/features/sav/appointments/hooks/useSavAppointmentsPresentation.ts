import { useMemo } from 'react';

import {
  useBrands,
  useServiceTypes,
  useWorkshops,
} from '@/core/api/use-dictionaries';
import type { DirectusAppointment } from '@/core/api/appointments.api';
import { presentSavAppointments } from '@/features/sav/appointments/model/sav-appointment.presenter';

export function useSavAppointmentsPresentation(
  appointments: DirectusAppointment[]
) {
  const brandsQuery = useBrands();
  const serviceTypesQuery = useServiceTypes();
  const workshopsQuery = useWorkshops();
  const data = useMemo(
    () =>
      presentSavAppointments({
        appointments,
        brands: brandsQuery.data ?? [],
        serviceTypes: serviceTypesQuery.data ?? [],
        workshops: workshopsQuery.data ?? [],
      }),
    [
      appointments,
      brandsQuery.data,
      serviceTypesQuery.data,
      workshopsQuery.data,
    ]
  );

  return {
    data,
    isLoading:
      brandsQuery.isLoading ||
      serviceTypesQuery.isLoading ||
      workshopsQuery.isLoading,
  };
}
