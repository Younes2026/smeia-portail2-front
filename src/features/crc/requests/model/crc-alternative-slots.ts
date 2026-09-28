import type {
  AiBookingAvailabilityOption,
  AiBookingCalendarResult,
  AiBookingPreferredPeriod,
} from '@/core/api/ai-booking.api';
import type { AiDiagnosticServiceTypeId } from '@/core/api/ai-diagnostics.api';
import { HttpError } from '@/core/api/http-client';

const CRC_BOOKABLE_SERVICE_TYPE_IDS = new Set<number>([2, 3, 4, 5, 6, 7, 8]);

export const CRC_AVAILABILITY_PERIOD_OPTIONS: ReadonlyArray<{
  label: string;
  value: AiBookingPreferredPeriod;
}> = [
  { label: 'Toute la journée', value: 'any' },
  { label: 'Matin', value: 'morning' },
  { label: 'Après-midi', value: 'afternoon' },
];

export type CrcAlternativeSlotsContext = {
  appointmentId: number;
  workshopId: number;
  requestedDate: string;
  requestedTime: string;
};

export type CrcRetainedSlot = {
  requestedDate: string;
  requestedTime: string;
};

export function parseCrcBookableServiceTypeId(
  serviceTypeId: number
): AiDiagnosticServiceTypeId {
  if (!CRC_BOOKABLE_SERVICE_TYPE_IDS.has(serviceTypeId)) {
    throw new Error('Le service de cette demande ne permet pas la recherche de créneaux.');
  }

  return serviceTypeId as AiDiagnosticServiceTypeId;
}

function normalizeSlotTime(value: string): string {
  return value.slice(0, 5);
}

function isCurrentAppointmentSlot(
  option: AiBookingAvailabilityOption,
  context: CrcAlternativeSlotsContext
): boolean {
  return (
    option.requested_date === context.requestedDate &&
    normalizeSlotTime(option.requested_time) ===
      normalizeSlotTime(context.requestedTime)
  );
}

export function selectCrcAlternativeSlots(
  options: readonly AiBookingAvailabilityOption[],
  context: CrcAlternativeSlotsContext
): AiBookingAvailabilityOption[] {
  return options
    .filter(
      (option) =>
        option.workshop_id === context.workshopId &&
        !isCurrentAppointmentSlot(option, context)
    )
    .slice(0, 3);
}

export function selectCrcAlternativeDaySlots(
  options: readonly AiBookingAvailabilityOption[],
  context: CrcAlternativeSlotsContext,
  selectedDate: string
): AiBookingAvailabilityOption[] {
  return options
    .filter(
      (option) =>
        option.workshop_id === context.workshopId &&
        option.requested_date === selectedDate &&
        !isCurrentAppointmentSlot(option, context)
    )
    .sort((first, second) =>
      first.requested_time.localeCompare(second.requested_time)
    );
}

type IsoDateParts = {
  year: number;
  month: number;
  day: number;
};

function parseIsoDate(value: string): IsoDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function addIsoDateDays(value: string, amount: number): string {
  const parsed = parseIsoDate(value);

  if (!parsed) {
    return value;
  }

  const date = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + amount, 12)
  );

  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function crcIsoDateToCalendarDate(value: string): Date | null {
  const parsed = parseIsoDate(value);

  return parsed
    ? new Date(parsed.year, parsed.month - 1, parsed.day, 12)
    : null;
}

export function crcCalendarDateToIso(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getCrcCalendarUnavailableDates(
  calendar: AiBookingCalendarResult
): Date[] {
  const availableDates = new Set(
    calendar.days
      .filter((day) => day.available_slot_count > 0)
      .map((day) => day.date)
  );
  const unavailableDates: Date[] = [];

  for (let offset = 0; offset < 30; offset += 1) {
    const date = addIsoDateDays(calendar.horizon_start, offset);

    if (date > calendar.horizon_end) {
      break;
    }

    if (!availableDates.has(date)) {
      const calendarDate = crcIsoDateToCalendarDate(date);

      if (calendarDate) {
        unavailableDates.push(calendarDate);
      }
    }
  }

  return unavailableDates;
}

export function getCrcCalendarInitialVisibleDate(
  requestedDate: string,
  calendar: AiBookingCalendarResult
): Date | null {
  const initialDate =
    requestedDate >= calendar.horizon_start &&
    requestedDate <= calendar.horizon_end
      ? requestedDate
      : calendar.horizon_start;

  return crcIsoDateToCalendarDate(initialDate);
}

export function createCrcRetainedSlot(
  option: AiBookingAvailabilityOption
): CrcRetainedSlot {
  return {
    requestedDate: option.requested_date,
    requestedTime: normalizeSlotTime(option.requested_time),
  };
}

export function isCrcRetainedSlot(
  option: AiBookingAvailabilityOption,
  retainedSlot: CrcRetainedSlot | null
): boolean {
  return (
    retainedSlot?.requestedDate === option.requested_date &&
    retainedSlot.requestedTime === normalizeSlotTime(option.requested_time)
  );
}

export function formatCrcAlternativeSlotDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsedDate);
}

export function formatCrcAlternativeSlotTime(value: string): string {
  return normalizeSlotTime(value);
}

export function isCrcAlternativeSlotsEmptyError(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    error.code === 'BOOKING_AVAILABILITY_NOT_FOUND'
  );
}

export function getCrcAlternativeSlotsErrorMessage(error: Error): string {
  if (error instanceof HttpError && error.status === 403) {
    return 'Permission Read manquante sur service_types pour le rôle Agent CRC. Les champs id, name et qualification_code sont requis par le moteur de disponibilité.';
  }

  if (
    error instanceof HttpError &&
    error.code === 'DIRECTUS_VEHICLE_NOT_ACCESSIBLE'
  ) {
    return 'Le véhicule n’est pas lisible par l’Agent CRC. Vérifiez les permissions Read sur vehicles et la relation brands.';
  }

  if (error instanceof HttpError && error.status === 401) {
    return 'Votre session Agent CRC a expiré. Reconnectez-vous avant de relancer la recherche.';
  }

  if (!(error instanceof HttpError) && error.message.length > 0) {
    return error.message;
  }

  return 'Les disponibilités ne peuvent pas être chargées pour le moment.';
}
