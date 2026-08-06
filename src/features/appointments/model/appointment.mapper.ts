import type { DirectusAppointment } from '@/core/api/appointments.api';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRelationId(relation: unknown): number | string | null {
  if (typeof relation === 'number' || typeof relation === 'string') {
    return relation;
  }

  if (!isRecord(relation)) {
    return null;
  }

  const id = relation.id;

  return typeof id === 'number' || typeof id === 'string' ? id : null;
}

function getRelationName(
  relation: number | { id: number; name?: string | null },
  fallback: string
): string {
  if (!isRecord(relation)) {
    return fallback;
  }

  return typeof relation.name === 'string' && relation.name
    ? relation.name
    : fallback;
}

function getVehicleLabel(
  relation: DirectusAppointment['vehicle_id']
): string {
  if (!isRecord(relation)) {
    return 'Véhicule non renseigné';
  }

  const model =
    typeof relation.model === 'string' && relation.model ? relation.model : '';
  const brandRelation = relation.brand_id;
  const brandName =
    isRecord(brandRelation) &&
    typeof brandRelation.name === 'string' &&
    brandRelation.name
      ? brandRelation.name
      : '';

  return `${brandName} ${model}`.trim() || 'Véhicule non renseigné';
}

function getRegistrationNumber(
  relation: DirectusAppointment['vehicle_id']
): string {
  if (
    !isRecord(relation) ||
    typeof relation.registration_number !== 'string' ||
    !relation.registration_number
  ) {
    return 'Immatriculation non renseignée';
  }

  return relation.registration_number;
}

function formatDate(value: string): string {
  if (!value) {
    return 'Date non renseignée';
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 'Date non renseignée';
  }

  return date.toLocaleDateString('fr-FR');
}

function formatTime(value: string): string {
  if (!value) {
    return 'Heure non renseignée';
  }

  const [hours, minutes] = value.split(':');

  if (!hours || !minutes) {
    return value;
  }

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

export function mapAppointmentToListItem(
  appointment: DirectusAppointment
): AppointmentListItem {
  return {
    id: appointment.id,
    vehicleId: getRelationId(appointment.vehicle_id),
    serviceTypeId: getRelationId(appointment.service_type_id),
    workshopId: getRelationId(appointment.workshop_id),
    vehicle: getVehicleLabel(appointment.vehicle_id),
    registrationNumber: getRegistrationNumber(appointment.vehicle_id),
    serviceType: getRelationName(
      appointment.service_type_id,
      'Service non renseigné'
    ),
    workshop: getRelationName(
      appointment.workshop_id,
      'Atelier non renseigné'
    ),
    requestedDate: formatDate(appointment.requested_date),
    requestedDateValue: appointment.requested_date,
    requestedTime: formatTime(appointment.requested_time),
    requestedTimeValue: appointment.requested_time,
    status: appointment.status,
    comment: appointment.comment?.trim() || 'Aucun commentaire',
    cancellationReason: appointment.cancellation_reason?.trim() || null,
    arrivalConfirmedAt: appointment.arrival_confirmed_at ?? null,
  };
}

export function mapAppointmentsToListItems(
  appointments: DirectusAppointment[]
): AppointmentListItem[] {
  return appointments.map(mapAppointmentToListItem);
}
