import type { DirectusAppointment } from '@/core/api/appointments.api';
import type { DictionaryItem, Workshop } from '@/core/api/dictionaries.api';
import { presentProfile } from '@/features/profile/model/profile.presenter';
import { presentClientVehicle } from '@/features/repairs/model/client-repair.presenter';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';

export type SavAppointmentStatusKey =
  | 'pending'
  | 'confirmed'
  | 'received'
  | 'cancelled'
  | 'unknown';

export type SavAppointmentPeriod = 'today' | 'tomorrow' | 'week' | 'all';
export type SavAppointmentSort = 'ascending' | 'descending';

export type SavAppointmentViewModel = {
  id: string;
  raw: DirectusAppointment;
  referenceLabel: string;
  dateValue: string;
  dateLabel: string;
  timeLabel: string;
  timestamp: number;
  customerLabel: string;
  phoneLabel: string | null;
  emailLabel: string | null;
  vehicleLabel: string;
  brandName: string | null;
  modelName: string | null;
  registrationLabel: string | null;
  serviceLabel: string;
  workshopLabel: string;
  statusKey: SavAppointmentStatusKey;
  statusLabel: string;
  arrivalConfirmedAt: string | null;
  arrivalLabel: string | null;
  comment: string | null;
  cancellationReason: string | null;
  linkedRepairId: number | string | null;
  hasLinkedRepair: boolean;
  searchText: string;
};

type PresentSavAppointmentsInput = {
  appointments: DirectusAppointment[];
  brands: DictionaryItem[];
  serviceTypes: DictionaryItem[];
  workshops: Workshop[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRelationId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;

  return typeof id === 'number' || typeof id === 'string' ? id : null;
}

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
    normalized === '-' ||
    normalized.includes('unknown') ||
    normalized.includes('non renseigne') ||
    normalized.endsWith('.local') ||
    /^(vehicule|service|atelier|statut|rendez vous)\s*#/.test(normalized)
  ) {
    return null;
  }

  return value?.trim().replace(/\s+-\s*$/, '').replace(/\s+/g, ' ') || null;
}

function relationMatches(
  first: number | string | null,
  second: number | string | null
): boolean {
  return first !== null && second !== null && String(first) === String(second);
}

function getDictionaryName<T extends { id: number; name: string }>(
  items: T[],
  relationId: number | string | null
): string | null {
  return (
    items.find((item) => relationMatches(item.id, relationId))?.name?.trim() ??
    null
  );
}

function getRelationName<T extends { id: number; name: string }>(
  relation: unknown,
  dictionary: T[],
  fallback: string
): string {
  const objectName = isRecord(relation)
    ? cleanLabel(
        typeof relation.name === 'string'
          ? relation.name
          : typeof relation.label === 'string'
            ? relation.label
            : null
      )
    : null;

  return (
    objectName ??
    cleanLabel(getDictionaryName(dictionary, getRelationId(relation))) ??
    fallback
  );
}

function mapVehicleRelation(appointment: DirectusAppointment): VehicleListItem | null {
  const vehicle = appointment.vehicle_id;

  if (!isRecord(vehicle)) {
    return null;
  }

  const id = getRelationId(vehicle);
  const numericId =
    typeof id === 'number'
      ? id
      : typeof id === 'string' && /^\d+$/.test(id)
        ? Number(id)
        : null;

  if (numericId === null) {
    return null;
  }

  const brandRelation = vehicle.brand_id;
  const brandName = isRecord(brandRelation)
    ? cleanLabel(
        typeof (brandRelation as Record<string, unknown>).name === 'string'
          ? String((brandRelation as Record<string, unknown>).name)
          : typeof (brandRelation as Record<string, unknown>).label === 'string'
            ? String((brandRelation as Record<string, unknown>).label)
            : null
      )
    : null;
  const model = typeof vehicle.model === 'string' ? vehicle.model : '';
  const registration =
    typeof vehicle.registration_number === 'string'
      ? vehicle.registration_number
      : '';
  const vehicleRecord = vehicle as Record<string, unknown>;
  const year = typeof vehicleRecord.year === 'number' ? vehicleRecord.year : null;
  const mileage =
    typeof vehicleRecord.mileage === 'number' ? vehicleRecord.mileage : null;
  const vin =
    typeof vehicleRecord.vin === 'string' ? vehicleRecord.vin.trim() : null;

  return {
    id: numericId,
    brandId: getRelationId(brandRelation),
    brandName: brandName ?? '',
    model,
    registrationNumber: registration,
    year: year === null ? '' : String(year),
    yearValue: year,
    mileage: mileage === null ? '' : `${mileage} km`,
    mileageValue: mileage,
    vin: vin ?? '',
    vinValue: vin,
  };
}

function getCustomerPresentation(appointment: DirectusAppointment) {
  const customer = appointment.customer_id;

  if (!isRecord(customer)) {
    return presentProfile({ customer: null, user: null });
  }

  const id = typeof customer.id === 'number' ? customer.id : 0;

  return presentProfile({
    customer: {
      id,
      firstName:
        typeof customer.first_name === 'string' ? customer.first_name : null,
      lastName:
        typeof customer.last_name === 'string' ? customer.last_name : null,
      email: typeof customer.email === 'string' ? customer.email : null,
      phone: typeof customer.phone === 'string' ? customer.phone : null,
      address: null,
    },
    user: null,
  });
}

function getStatusKey(appointment: DirectusAppointment): SavAppointmentStatusKey {
  const status = normalize(appointment.status);

  if (status.includes('cancel') || status.includes('annul')) return 'cancelled';
  if (appointment.arrival_confirmed_at) return 'received';
  if (status.includes('confirm')) return 'confirmed';
  if (status.includes('pending') || status.includes('attente')) return 'pending';
  return 'unknown';
}

export function getSavAppointmentStatus(
  appointment: DirectusAppointment
): { key: SavAppointmentStatusKey; label: string } {
  const key = getStatusKey(appointment);
  const labels: Record<SavAppointmentStatusKey, string> = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    received: 'Véhicule réceptionné',
    cancelled: 'Annulé',
    unknown: 'Suivi à vérifier',
  };

  return { key, label: labels[key] };
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return cleanLabel(value) ?? 'Date à confirmer';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatTime(value?: string | null): string {
  const [hours, minutes] = value?.split(':') ?? [];

  return hours && minutes
    ? `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
    : 'Horaire à confirmer';
}

function formatDateTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return cleanLabel(value);
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getTimestamp(dateValue: string, timeValue: string): number {
  const timestamp = new Date(`${dateValue}T${timeValue || '00:00'}`).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getReference(appointment: DirectusAppointment): string {
  const year = appointment.requested_date.match(/^(\d{4})/)?.[1] ?? 'SAV';
  const numericId = Number(appointment.id);
  const idLabel = Number.isFinite(numericId)
    ? String(numericId).padStart(4, '0')
    : String(appointment.id).toLocaleUpperCase('fr-FR');

  return `Référence RDV SMEIA-${year}-${idLabel}`;
}

function getLinkedRepair(appointment: DirectusAppointment): {
  hasLinkedRepair: boolean;
  linkedRepairId: number | string | null;
} {
  const repairs = appointment.repairs;

  if (Array.isArray(repairs)) {
    return {
      hasLinkedRepair: repairs.length > 0,
      linkedRepairId: repairs[0] ?? null,
    };
  }

  if (typeof repairs === 'number' || typeof repairs === 'string') {
    return { hasLinkedRepair: true, linkedRepairId: repairs };
  }

  return { hasLinkedRepair: false, linkedRepairId: null };
}

function buildSearchText(view: Omit<SavAppointmentViewModel, 'searchText'>): string {
  return normalize(
    [
      view.referenceLabel,
      view.customerLabel,
      view.vehicleLabel,
      view.registrationLabel,
      view.serviceLabel,
      view.statusLabel,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

export function presentSavAppointments({
  appointments,
  brands,
  serviceTypes,
  workshops,
}: PresentSavAppointmentsInput): SavAppointmentViewModel[] {
  const vehicles = appointments
    .map(mapVehicleRelation)
    .filter((vehicle): vehicle is VehicleListItem => vehicle !== null);

  return appointments.map((appointment) => {
    const vehicle = presentClientVehicle(
      getRelationId(appointment.vehicle_id),
      vehicles,
      brands
    );
    const customer = getCustomerPresentation(appointment);
    const status = getSavAppointmentStatus(appointment);
    const linkedRepair = getLinkedRepair(appointment);
    const viewWithoutSearch: Omit<SavAppointmentViewModel, 'searchText'> = {
      id: String(appointment.id),
      raw: appointment,
      referenceLabel: getReference(appointment),
      dateValue: appointment.requested_date,
      dateLabel: formatDate(appointment.requested_date),
      timeLabel: formatTime(appointment.requested_time),
      timestamp: getTimestamp(
        appointment.requested_date,
        appointment.requested_time
      ),
      customerLabel:
        customer.displayName === 'Client SMEIA'
          ? 'Client atelier'
          : customer.displayName,
      phoneLabel:
        customer.phoneState === 'missing' ? null : customer.phoneLabel,
      emailLabel:
        customer.emailState === 'complete' ? customer.emailLabel : null,
      vehicleLabel: vehicle.label,
      brandName: vehicle.brandName,
      modelName: vehicle.modelName,
      registrationLabel: vehicle.registrationLabel,
      serviceLabel: getRelationName(
        appointment.service_type_id,
        serviceTypes,
        'Prestation atelier'
      ),
      workshopLabel: getRelationName(
        appointment.workshop_id,
        workshops,
        'Atelier SAV'
      ),
      statusKey: status.key,
      statusLabel: status.label,
      arrivalConfirmedAt: appointment.arrival_confirmed_at ?? null,
      arrivalLabel: formatDateTime(appointment.arrival_confirmed_at),
      comment: cleanLabel(appointment.comment),
      cancellationReason: cleanLabel(appointment.cancellation_reason),
      linkedRepairId: linkedRepair.linkedRepairId,
      hasLinkedRepair: linkedRepair.hasLinkedRepair,
    };

    return {
      ...viewWithoutSearch,
      searchText: buildSearchText(viewWithoutSearch),
    };
  });
}

export function isSavAppointmentInPeriod(
  appointment: SavAppointmentViewModel,
  period: SavAppointmentPeriod,
  now = new Date()
): boolean {
  if (period === 'all') {
    return true;
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${appointment.dateValue}T12:00:00`);

  if (Number.isNaN(target.getTime())) {
    return false;
  }

  if (period === 'today') {
    return target.toDateString() === today.toDateString();
  }

  if (period === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return target.toDateString() === tomorrow.toDateString();
  }

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return target >= today && target < weekEnd;
}

export function normalizeSavAppointmentSearch(value: string): string {
  return normalize(value);
}
