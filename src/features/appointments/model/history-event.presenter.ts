import type { DictionaryItem, Workshop } from '@/core/api/dictionaries.api';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';
import {
  presentClientVehicle,
  type ClientRepairStatusKey,
  type ClientRepairViewModel,
} from '@/features/repairs/model/client-repair.presenter';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';

export type HistoryEventType = 'appointment' | 'repair' | 'serviceJourney';
export type HistoryStatusTone =
  | 'info'
  | 'warning'
  | 'active'
  | 'success'
  | 'danger'
  | 'ready'
  | 'neutral';
export type HistorySectionKey = 'upcoming' | 'inProgress' | 'history';

export type HistoryEvent = {
  id: string;
  type: HistoryEventType;
  date: string;
  dateValue: string | null;
  timestamp: number;
  time: string | null;
  vehicleId: number | string | null;
  vehicleLabel: string;
  brandName: string | null;
  registrationLabel: string | null;
  serviceLabel: string;
  workshopLabel: string;
  statusLabel: string;
  statusTone: HistoryStatusTone;
  comment: string | null;
  referenceLabel: string | null;
  appointment: AppointmentListItem | null;
  repair: ClientRepairViewModel | null;
  searchText: string;
};

type PresentHistoryEventsInput = {
  appointments: AppointmentListItem[];
  brands: DictionaryItem[];
  repairs: ClientRepairViewModel[];
  serviceTypes: DictionaryItem[];
  vehicles: VehicleListItem[];
  workshops: Workshop[];
};

function normalize(value?: string | null): string {
  return (
    value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr-FR')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ') ?? ''
  );
}

function cleanLabel(value?: string | null): string | null {
  const normalized = normalize(value);

  if (
    !normalized ||
    normalized.includes('unknown') ||
    normalized.includes('non renseigne') ||
    normalized === 'aucun commentaire' ||
    /^(vehicule|atelier|service|statut|dossier)\s*#/.test(normalized)
  ) {
    return null;
  }

  return value?.trim() || null;
}

function relationMatches(
  first: number | string | null,
  second: number | string | null
): boolean {
  return first !== null && second !== null && String(first) === String(second);
}

function resolveDictionaryLabel<T extends { id: number; name: string }>(
  items: T[],
  relationId: number | string | null,
  relationLabel: string | null,
  fallback: string
): string {
  const dictionaryLabel = items.find((item) =>
    relationMatches(item.id, relationId)
  )?.name;

  return cleanLabel(dictionaryLabel) ?? cleanLabel(relationLabel) ?? fallback;
}

export function getAppointmentStatusKey(
  status?: string | null
): 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'unknown' {
  const normalized = normalize(status);

  if (normalized.includes('cancel')) {
    return 'cancelled';
  }

  if (
    normalized.includes('completed') ||
    normalized.includes('complete') ||
    normalized.includes('termine') ||
    normalized.includes('cloture')
  ) {
    return 'completed';
  }

  if (normalized.includes('confirmed') || normalized.includes('confirme')) {
    return 'confirmed';
  }

  if (normalized.includes('pending') || normalized.includes('en attente')) {
    return 'pending';
  }

  return 'unknown';
}

export function getAppointmentStatusLabel(status?: string | null): string {
  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    cancelled: 'Annulé',
    completed: 'Terminé',
    unknown: 'Suivi en cours',
  } as const;

  return labels[getAppointmentStatusKey(status)];
}

function getAppointmentStatusTone(status?: string | null): HistoryStatusTone {
  const key = getAppointmentStatusKey(status);

  if (key === 'pending') return 'warning';
  if (key === 'confirmed') return 'info';
  if (key === 'cancelled') return 'danger';
  if (key === 'completed') return 'success';
  return 'neutral';
}

function getRepairStatusTone(key: ClientRepairStatusKey): HistoryStatusTone {
  if (key === 'pending') return 'warning';
  if (key === 'confirmed') return 'info';
  if (key === 'in_progress') return 'active';
  if (key === 'completed') return 'success';
  if (key === 'cancelled') return 'danger';
  if (key === 'ready_for_pickup') return 'ready';
  return 'neutral';
}

function getTimestamp(dateValue?: string | null, timeValue?: string | null): number {
  if (!dateValue) {
    return 0;
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours = '0', minutes = '0'] = (timeValue ?? '').split(':');

  if (year && month && day) {
    const timestamp = new Date(
      year,
      month - 1,
      day,
      Number(hours) || 0,
      Number(minutes) || 0
    ).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  const timestamp = new Date(dateValue).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildSearchText(event: Omit<HistoryEvent, 'searchText'>): string {
  return normalize(
    [
      event.vehicleLabel,
      event.brandName,
      event.registrationLabel,
      event.serviceLabel,
      event.workshopLabel,
      event.referenceLabel,
      event.statusLabel,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function presentAppointment(
  appointment: AppointmentListItem,
  input: PresentHistoryEventsInput
): HistoryEvent {
  const vehicle = presentClientVehicle(
    appointment.vehicleId,
    input.vehicles,
    input.brands,
    {
      model: appointment.vehicle,
      registration: appointment.registrationNumber,
    }
  );
  const eventWithoutSearch: Omit<HistoryEvent, 'searchText'> = {
    id: `appointment-${String(appointment.id)}`,
    type: 'appointment',
    date: cleanLabel(appointment.requestedDate) ?? 'Date à confirmer',
    dateValue: cleanLabel(appointment.requestedDateValue),
    timestamp: getTimestamp(
      appointment.requestedDateValue,
      appointment.requestedTimeValue
    ),
    time: cleanLabel(appointment.requestedTime),
    vehicleId: appointment.vehicleId,
    vehicleLabel: vehicle.label,
    brandName: vehicle.brandName,
    registrationLabel: vehicle.registrationLabel,
    serviceLabel: resolveDictionaryLabel(
      input.serviceTypes,
      appointment.serviceTypeId,
      appointment.serviceType,
      'Service atelier'
    ),
    workshopLabel: resolveDictionaryLabel(
      input.workshops,
      appointment.workshopId,
      appointment.workshop,
      'Atelier SMEIA'
    ),
    statusLabel: getAppointmentStatusLabel(appointment.status),
    statusTone: getAppointmentStatusTone(appointment.status),
    comment: cleanLabel(appointment.comment),
    referenceLabel: null,
    appointment,
    repair: null,
  };

  return {
    ...eventWithoutSearch,
    searchText: buildSearchText(eventWithoutSearch),
  };
}

function presentRepair(
  repair: ClientRepairViewModel,
  appointment: AppointmentListItem | null
): HistoryEvent {
  const eventWithoutSearch: Omit<HistoryEvent, 'searchText'> = {
    id: appointment
      ? `journey-${String(appointment.id)}-${repair.id}`
      : `repair-${repair.id}`,
    type: appointment ? 'serviceJourney' : 'repair',
    date: repair.entryDateLabel,
    dateValue: repair.entryDateValue,
    timestamp: repair.sortValue,
    time: appointment ? cleanLabel(appointment.requestedTime) : null,
    vehicleId: repair.vehicleId,
    vehicleLabel: repair.vehicleLabel,
    brandName: repair.brandName,
    registrationLabel: repair.registrationLabel,
    serviceLabel: repair.serviceLabel,
    workshopLabel: repair.workshopLabel,
    statusLabel: repair.statusLabel,
    statusTone: getRepairStatusTone(repair.statusKey),
    comment: cleanLabel(appointment?.comment),
    referenceLabel: repair.referenceLabel,
    appointment,
    repair,
  };

  return {
    ...eventWithoutSearch,
    searchText: buildSearchText(eventWithoutSearch),
  };
}

export function presentHistoryEvents(input: PresentHistoryEventsInput): HistoryEvent[] {
  const appointmentMap = new Map(
    input.appointments.map((appointment) => [String(appointment.id), appointment])
  );
  const groupedAppointmentIds = new Set<string>();
  const repairEvents = input.repairs.map((repair) => {
    const appointment =
      repair.appointmentId !== null
        ? appointmentMap.get(String(repair.appointmentId)) ?? null
        : null;

    if (appointment) {
      groupedAppointmentIds.add(String(appointment.id));
    }

    return presentRepair(repair, appointment);
  });
  const appointmentEvents = input.appointments
    .filter((appointment) => !groupedAppointmentIds.has(String(appointment.id)))
    .map((appointment) => presentAppointment(appointment, input));

  return [...repairEvents, ...appointmentEvents];
}

export function getHistoryEventSection(
  event: HistoryEvent,
  now = new Date()
): HistorySectionKey {
  if (event.repair) {
    return ['completed', 'cancelled'].includes(event.repair.statusKey)
      ? 'history'
      : 'inProgress';
  }

  if (event.appointment?.arrivalConfirmedAt) {
    return 'inProgress';
  }

  const appointmentStatus = getAppointmentStatusKey(event.appointment?.status);

  if (appointmentStatus === 'cancelled' || appointmentStatus === 'completed') {
    return 'history';
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return event.timestamp >= today.getTime() ? 'upcoming' : 'history';
}

export function getServiceJourneyProgress(event: HistoryEvent): {
  activeIndex: number;
  completedThrough: number;
} {
  const repair = event.repair;

  if (!repair) {
    return event.appointment?.arrivalConfirmedAt
      ? { activeIndex: 2, completedThrough: 1 }
      : { activeIndex: 1, completedThrough: 0 };
  }

  if (repair.statusKey === 'ready_for_pickup') {
    return { activeIndex: 4, completedThrough: 3 };
  }

  if (repair.statusKey === 'completed') {
    return { activeIndex: 4, completedThrough: 4 };
  }

  if (repair.statusKey === 'in_progress') {
    return { activeIndex: 3, completedThrough: 2 };
  }

  if (repair.diagnosticLabel) {
    return { activeIndex: 3, completedThrough: 2 };
  }

  return { activeIndex: 2, completedThrough: 1 };
}
