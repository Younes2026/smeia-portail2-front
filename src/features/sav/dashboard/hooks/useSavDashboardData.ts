import { useMemo } from 'react';

import {
  useBrands,
  useServiceTypes,
  useStatuses,
  useWorkshops,
} from '@/core/api/use-dictionaries';
import { useSavAiDiagnostics } from '@/features/sav/ai-diagnostics/hooks/useSavAiDiagnostics';
import { useSavAppointments } from '@/features/sav/appointments/hooks/useSavAppointments';
import {
  getSavRelationId,
  presentSavDashboard,
} from '@/features/sav/dashboard/model/sav-dashboard.presenter';
import { useSavRepairs } from '@/features/sav/repairs/hooks/useSavRepairs';
import { useAuthStore } from '@/store/auth.store';

function relationMatchesWorkshop(value: unknown, workshopId: number | null): boolean {
  const relationId = getSavRelationId(value);

  return workshopId !== null && relationId !== null && String(relationId) === String(workshopId);
}

export function useSavDashboardData() {
  const workshopId = useAuthStore((state) => state.savAgent?.workshopId ?? null);
  const appointmentsQuery = useSavAppointments();
  const diagnosticsQuery = useSavAiDiagnostics();
  const repairsQuery = useSavRepairs();
  const brandsQuery = useBrands();
  const serviceTypesQuery = useServiceTypes();
  const statusesQuery = useStatuses();
  const workshopsQuery = useWorkshops();

  const workshopAppointments = useMemo(
    () =>
      (appointmentsQuery.data ?? []).filter((appointment) =>
        relationMatchesWorkshop(appointment.workshop_id, workshopId)
      ),
    [appointmentsQuery.data, workshopId]
  );
  const workshopRepairs = useMemo(
    () =>
      (repairsQuery.data ?? []).filter((repair) =>
        relationMatchesWorkshop(repair.workshop_id, workshopId)
      ),
    [repairsQuery.data, workshopId]
  );
  const workshopDiagnostics = useMemo(() => {
    const appointmentIds = new Set(
      workshopAppointments.map((appointment) => String(appointment.id))
    );
    const vehicleIds = new Set(
      [...workshopAppointments, ...workshopRepairs]
        .map((item) => getSavRelationId(item.vehicle_id))
        .filter((id): id is number | string => id !== null)
        .map(String)
    );

    return (diagnosticsQuery.data ?? []).filter((diagnostic) => {
      const appointmentId = getSavRelationId(diagnostic.appointment_id);
      const vehicleId = getSavRelationId(diagnostic.vehicle_id);

      return (
        (appointmentId !== null && appointmentIds.has(String(appointmentId))) ||
        (vehicleId !== null && vehicleIds.has(String(vehicleId)))
      );
    });
  }, [diagnosticsQuery.data, workshopAppointments, workshopRepairs]);
  const data = useMemo(
    () =>
      presentSavDashboard({
        appointments: workshopAppointments,
        brands: brandsQuery.data ?? [],
        diagnostics: workshopDiagnostics,
        repairs: workshopRepairs,
        serviceTypes: serviceTypesQuery.data ?? [],
        statuses: statusesQuery.data ?? [],
        workshops: workshopsQuery.data ?? [],
      }),
    [
      brandsQuery.data,
      serviceTypesQuery.data,
      statusesQuery.data,
      workshopAppointments,
      workshopDiagnostics,
      workshopRepairs,
      workshopsQuery.data,
    ]
  );
  const primaryErrors = [
    appointmentsQuery.isError ? 'rendez-vous' : null,
    diagnosticsQuery.isError ? 'pré-diagnostics IA' : null,
    repairsQuery.isError ? 'réparations' : null,
  ].filter((value): value is string => Boolean(value));

  const refetch = async () => {
    await Promise.all([
      appointmentsQuery.refetch(),
      diagnosticsQuery.refetch(),
      repairsQuery.refetch(),
      brandsQuery.refetch(),
      serviceTypesQuery.refetch(),
      statusesQuery.refetch(),
      workshopsQuery.refetch(),
    ]);
  };

  return {
    data,
    dataErrors: primaryErrors,
    isError: primaryErrors.length === 3,
    isLoading:
      appointmentsQuery.isLoading ||
      diagnosticsQuery.isLoading ||
      repairsQuery.isLoading ||
      brandsQuery.isLoading ||
      serviceTypesQuery.isLoading ||
      statusesQuery.isLoading ||
      workshopsQuery.isLoading,
    refetch,
  };
}
