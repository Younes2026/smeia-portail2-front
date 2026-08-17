import { HttpError } from '@/core/api/http-client';
import type { AiBookingWorkshopType } from '@/core/api/ai-diagnostics.api';

export const AI_BOOKING_TIME_ZONE = 'Africa/Casablanca';
export const AI_BOOKING_WINDOW_DAYS = 30;

const bookingErrorMessages: Readonly<Record<string, string>> = {
  INVALID_REQUEST: 'Les informations envoyées sont invalides.',
  INVALID_SLOT_TOKEN: "Ce créneau n’est plus valide.",
  SLOT_OFFER_EXPIRED:
    'Ce créneau a expiré. Recherchez de nouvelles disponibilités.',
  SLOT_NO_LONGER_AVAILABLE:
    'Ce créneau vient d’être réservé. Veuillez choisir une autre option.',
  IDEMPOTENCY_CONFLICT:
    'Cette confirmation ne correspond plus à la demande actuelle.',
  DIRECTUS_VEHICLE_NOT_ACCESSIBLE: 'Ce véhicule n’est plus accessible.',
  BOOKING_CONTEXT_INVALID:
    'Le service ou l’atelier sélectionné n’est plus disponible.',
  BOOKING_RATE_LIMIT_EXCEEDED: 'Trop de tentatives. Patientez un instant.',
  APPOINTMENT_CREATION_FAILED: 'La demande n’a pas pu être créée.',
  BOOKING_CONFIGURATION_UNAVAILABLE:
    'La réservation est temporairement indisponible.',
  BOOKING_CONFIGURATION_ERROR:
    'La réservation est temporairement indisponible.',
  DIRECTUS_TIMEOUT: 'Le service met trop de temps à répondre.',
  BOOKING_AVAILABILITY_NOT_FOUND:
    'Aucun créneau disponible pour cette préférence. Essayez une autre date ou un autre site.',
};

function getCasablancaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: AI_BOOKING_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function getCasablancaTodayIso(now = new Date()): string {
  const parts = getCasablancaDateParts(now);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addBookingDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day + days));

  return [
    String(parsed.getUTCFullYear()).padStart(4, '0'),
    String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    String(parsed.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function getBookingWindowEndIso(
  minimumDate = getCasablancaTodayIso()
): string {
  return addBookingDays(minimumDate, AI_BOOKING_WINDOW_DAYS - 1);
}

export function isValidBookingDate(
  value: string,
  minimumDate = getCasablancaTodayIso(),
  maximumDate = getBookingWindowEndIso(minimumDate)
): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isCalendarDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return isCalendarDate && value >= minimumDate && value <= maximumDate;
}

export const AI_BOOKING_WORKSHOP_TYPE_LABELS: Readonly<
  Record<AiBookingWorkshopType, string>
> = {
  diagnostic: 'Diagnostic',
  mecanique: 'Mécanique & diagnostic',
  carrosserie: 'Carrosserie',
  peinture: 'Peinture',
};

export function getCompatibleWorkshopTypes(
  qualificationCode: string | null | undefined
): readonly AiBookingWorkshopType[] {
  switch (qualificationCode?.trim()) {
    case 'MEC-DIAG B':
      return ['diagnostic', 'mecanique'];
    case 'CAR':
      return ['carrosserie'];
    case 'PEINT':
      return ['peinture'];
    default:
      return [];
  }
}

export function getWorkshopTypeLabel(
  workshopType: AiBookingWorkshopType
): string {
  return AI_BOOKING_WORKSHOP_TYPE_LABELS[workshopType];
}

export function formatBookingDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsed);
}

export function formatBookingTime(value: string): string {
  const match = /^(\d{2}):(\d{2}):\d{2}$/.exec(value);

  return match ? `${match[1]}:${match[2]}` : value;
}

export function isBookingOptionExpired(
  expiresAt: string,
  now = Date.now()
): boolean {
  const expiration = Date.parse(expiresAt);

  return Number.isNaN(expiration) || expiration <= now;
}

export function getAiBookingErrorMessage(error: unknown): string {
  if (!(error instanceof HttpError)) {
    return 'La réservation est temporairement indisponible.';
  }

  if (error.code && bookingErrorMessages[error.code]) {
    return bookingErrorMessages[error.code];
  }

  if (error.status === 401) {
    return 'Votre session a expiré. Veuillez vous reconnecter.';
  }

  if (error.status === 409) {
    return 'Ce créneau n’est plus disponible. Recherchez de nouvelles disponibilités.';
  }

  return 'La réservation est temporairement indisponible.';
}

export function getDaySlotsNotFoundMessage(
  period: 'any' | 'morning' | 'afternoon'
): string {
  if (period === 'morning') {
    return 'Aucun créneau disponible le matin pour cette date.';
  }

  if (period === 'afternoon') {
    return 'Aucun créneau disponible l’après-midi pour cette date.';
  }

  return 'Aucun créneau disponible pour cette date.';
}

export function isBookingConflict(error: unknown): boolean {
  return error instanceof HttpError && error.status === 409;
}
