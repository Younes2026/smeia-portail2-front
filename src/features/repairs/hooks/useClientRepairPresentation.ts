import { useMemo } from 'react';

import type { DictionaryItem, Workshop } from '@/core/api/dictionaries.api';
import {
  useBrands,
  useServiceTypes,
  useStatuses,
  useWorkshops,
} from '@/core/api/use-dictionaries';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';
import {
  presentClientRepairs,
  type ClientRepairViewModel,
} from '@/features/repairs/model/client-repair.presenter';
import type { RepairListItem } from '@/features/repairs/model/repair.types';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';

type ClientRepairPresentationResult = {
  brands: DictionaryItem[];
  data: ClientRepairViewModel[];
  isLoading: boolean;
  serviceTypes: DictionaryItem[];
  statuses: DictionaryItem[];
  vehicles: VehicleListItem[];
  vehiclesQuery: ReturnType<typeof useVehicles>;
  workshops: Workshop[];
};

export function useClientRepairPresentation(
  repairs: RepairListItem[],
  appointments: AppointmentListItem[] = []
): ClientRepairPresentationResult {
  const vehiclesQuery = useVehicles();
  const brandsQuery = useBrands();
  const statusesQuery = useStatuses();
  const serviceTypesQuery = useServiceTypes();
  const workshopsQuery = useWorkshops();
  const vehicles = vehiclesQuery.data ?? [];
  const brands = brandsQuery.data ?? [];
  const statuses = statusesQuery.data ?? [];
  const serviceTypes = serviceTypesQuery.data ?? [];
  const workshops = workshopsQuery.data ?? [];
  const data = useMemo(
    () =>
      presentClientRepairs({
        appointments,
        brands,
        repairs,
        serviceTypes,
        statuses,
        vehicles,
        workshops,
      }),
    [appointments, brands, repairs, serviceTypes, statuses, vehicles, workshops]
  );

  return {
    brands,
    data,
    isLoading:
      vehiclesQuery.isLoading ||
      brandsQuery.isLoading ||
      statusesQuery.isLoading ||
      serviceTypesQuery.isLoading ||
      workshopsQuery.isLoading,
    serviceTypes,
    statuses,
    vehicles,
    vehiclesQuery,
    workshops,
  };
}
