import type { DictionaryItem } from '@/core/api/dictionaries.api';
import {
  getAppointmentStatusKey,
} from '@/features/appointments/model/history-event.presenter';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';
import {
  presentClientVehicle,
  type ClientRepairViewModel,
} from '@/features/repairs/model/client-repair.presenter';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';

export type GarageTrackingTone = 'neutral' | 'active' | 'ready';

export type GarageVehicleViewModel = {
  id: number;
  brandName: string | null;
  modelName: string | null;
  registrationLabel: string;
  mileageLabel: string;
  yearLabel: string;
  maskedVinLabel: string | null;
  fullVinLabel: string | null;
  trackingLabel: string;
  trackingTone: GarageTrackingTone;
  activeRepairsCount: number;
  nextAppointmentLabel: string | null;
  latestVisitLabel: string | null;
  latestInterventionLabel: string | null;
  recordedMileageLabel: string | null;
};

type PresentClientGarageInput = {
  appointments: AppointmentListItem[];
  brands: DictionaryItem[];
  repairs: ClientRepairViewModel[];
  vehicles: VehicleListItem[];
  now?: Date;
};

function relationMatches(
  first: number | string | null,
  second: number | string | null
): boolean {
  return first !== null && second !== null && String(first) === String(second);
}

function getAppointmentTimestamp(appointment: AppointmentListItem): number {
  if (!appointment.requestedDateValue) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(
    `${appointment.requestedDateValue}T${appointment.requestedTimeValue || '00:00'}`
  ).getTime();

  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function formatMileage(value: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/[\u00a0\u202f]/g, ' ');

  return `${formatted} km`;
}

function maskVin(value?: string | null): string | null {
  const vin = value?.trim();

  if (!vin) {
    return null;
  }

  if (vin.length <= 8) {
    return `${'•'.repeat(Math.max(4, vin.length - 3))}${vin.slice(-3)}`;
  }

  const prefixLength = Math.min(4, Math.max(2, vin.length - 7));
  const suffixLength = Math.min(6, vin.length - prefixLength);

  return `${vin.slice(0, prefixLength)}${'•'.repeat(
    vin.length - prefixLength - suffixLength
  )}${vin.slice(-suffixLength)}`;
}

function formatAppointment(appointment?: AppointmentListItem): string | null {
  if (!appointment) {
    return null;
  }

  return [appointment.requestedDate, appointment.requestedTime]
    .filter(Boolean)
    .join(' à ');
}

function getVehicleRepairs(
  vehicleId: number,
  repairs: ClientRepairViewModel[]
): ClientRepairViewModel[] {
  return repairs
    .filter((repair) => relationMatches(repair.vehicleId, vehicleId))
    .sort((first, second) => second.sortValue - first.sortValue);
}

function getVehicleAppointments(
  vehicleId: number,
  appointments: AppointmentListItem[],
  now: Date
): AppointmentListItem[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return appointments
    .filter((appointment) => {
      const status = getAppointmentStatusKey(appointment.status);

      return (
        relationMatches(appointment.vehicleId, vehicleId) &&
        !['cancelled', 'completed'].includes(status) &&
        getAppointmentTimestamp(appointment) >= today.getTime()
      );
    })
    .sort(
      (first, second) =>
        getAppointmentTimestamp(first) - getAppointmentTimestamp(second)
    );
}

function presentGarageVehicle(
  vehicle: VehicleListItem,
  input: PresentClientGarageInput
): GarageVehicleViewModel {
  const identity = presentClientVehicle(
    vehicle.id,
    input.vehicles,
    input.brands
  );
  const repairs = getVehicleRepairs(vehicle.id, input.repairs);
  const activeRepairs = repairs.filter(
    (repair) =>
      repair.isActive ||
      ['pending', 'confirmed', 'in_progress'].includes(repair.statusKey)
  );
  const readyRepair = repairs.find(
    (repair) => repair.statusKey === 'ready_for_pickup'
  );
  const nextAppointment = getVehicleAppointments(
    vehicle.id,
    input.appointments,
    input.now ?? new Date()
  )[0];
  const latestVisit = repairs[0] ?? null;
  const latestIntervention = repairs.find(
    (repair) => repair.statusKey === 'completed'
  );
  const recordedMileage =
    vehicle.mileageValue !== null
      ? formatMileage(vehicle.mileageValue)
      : repairs.find((repair) => repair.mileageLabel)?.mileageLabel ?? null;
  const tracking = readyRepair
    ? ({ label: 'Prêt à récupérer', tone: 'ready' } as const)
    : activeRepairs.length > 0
      ? ({ label: 'Intervention en cours', tone: 'active' } as const)
      : ({ label: 'Aucune intervention en cours', tone: 'neutral' } as const);

  return {
    id: vehicle.id,
    brandName: identity.brandName,
    modelName: identity.modelName,
    registrationLabel:
      identity.registrationLabel ?? 'Immatriculation à compléter',
    mileageLabel:
      vehicle.mileageValue !== null
        ? formatMileage(vehicle.mileageValue)
        : 'À compléter',
    yearLabel: vehicle.yearValue !== null ? String(vehicle.yearValue) : 'À compléter',
    maskedVinLabel: maskVin(vehicle.vinValue),
    fullVinLabel: vehicle.vinValue,
    trackingLabel: tracking.label,
    trackingTone: tracking.tone,
    activeRepairsCount: activeRepairs.length + (readyRepair ? 1 : 0),
    nextAppointmentLabel: formatAppointment(nextAppointment),
    latestVisitLabel: latestVisit?.entryDateLabel ?? null,
    latestInterventionLabel: latestIntervention?.entryDateLabel ?? null,
    recordedMileageLabel: recordedMileage,
  };
}

export function presentClientGarage(
  input: PresentClientGarageInput
): GarageVehicleViewModel[] {
  return input.vehicles.map((vehicle) => presentGarageVehicle(vehicle, input));
}
