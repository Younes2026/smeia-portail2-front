import type {
  CrcAppointmentAction,
  CrcAppointmentStatus,
  CrcRejectionReasonCode,
} from '@/core/api/crc-appointments.api';
import { HttpError } from '@/core/api/http-client';

export const CRC_REJECTION_REASON_OPTIONS: readonly {
  code: CrcRejectionReasonCode;
  label: string;
}[] = [
  { code: 'service_unavailable', label: 'Service indisponible' },
  { code: 'insufficient_information', label: 'Informations insuffisantes' },
  {
    code: 'vehicle_ineligible_or_incorrect',
    label: 'Véhicule inéligible ou incorrect',
  },
  { code: 'other', label: 'Autre motif' },
] as const;

export function isCrcAppointmentActionable(
  status: CrcAppointmentStatus
): status is 'pending' | 'callback_pending' {
  return status === 'pending' || status === 'callback_pending';
}

export function createCrcIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = token === 'x' ? randomValue : (randomValue & 0x3) | 0x8;

    return value.toString(16);
  });
}

export function optionalCrcNote(value: string): string | undefined {
  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

export function getCrcActionSuccessCopy(action: CrcAppointmentAction): {
  title: string;
  message: string;
} {
  switch (action) {
    case 'callback':
      return {
        title: 'Client ajouté à la relance',
        message: 'La demande est maintenant dans la file Clients à relancer.',
      };
    case 'reject':
      return {
        title: 'Demande refusée',
        message: 'Le refus et son historique ont été enregistrés.',
      };
    case 'confirm':
      return {
        title: 'Rendez-vous confirmé',
        message: 'La confirmation et son historique ont été enregistrés.',
      };
  }
}

export function getCrcActionErrorMessage(error: Error): string {
  if (!(error instanceof HttpError)) {
    return 'L’action n’a pas pu être enregistrée. Vous pouvez réessayer.';
  }

  switch (error.code) {
    case 'CRC_APPOINTMENT_CONFLICT':
    case 'CRC_APPOINTMENT_NOT_TREATABLE':
      return 'Cette demande a changé entre-temps. Actualisez la file avant de réessayer.';
    case 'CRC_IDEMPOTENCY_CONFLICT':
      return 'Cette tentative ne correspond plus à l’action initiale. Fermez ce panneau puis recommencez.';
    case 'CRC_HISTORY_WRITE_FAILED':
      return 'Le statut a pu changer, mais l’historique n’a pas été enregistré. Actualisez la file avant toute nouvelle action.';
    case 'CRC_WRITE_CONFIGURATION_UNAVAILABLE':
      return 'Les actions CRC sont temporairement indisponibles. Réessayez plus tard.';
    case 'CRC_APPOINTMENT_NOT_FOUND':
      return 'Cette demande n’existe plus ou n’est plus accessible.';
    case 'DIRECTUS_FORBIDDEN':
    case 'CRC_ROLE_REQUIRED':
      return 'Votre session ne permet pas d’effectuer cette action CRC.';
    default:
      return 'L’action n’a pas pu être enregistrée. Vous pouvez réessayer.';
  }
}
