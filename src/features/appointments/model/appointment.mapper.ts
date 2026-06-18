import type { DirectusAppointment } from '@/core/api/appointments.api';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
    typeof relation.model === 'string' && relation.model
      ? relation.model
      : 'Modèle non renseigné';
  const brandRelation = relation.brand_id;
  const brandName =
    isRecord(brandRelation) &&
    typeof brandRelation.name === 'string' &&
    brandRelation.name
      ? brandRelation.name
      : '';

  return `${brandName} ${model}`.trim();
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
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('fr-FR');
}

export function mapAppointmentToListItem(
  appointment: DirectusAppointment
): AppointmentListItem {
  return {
    id: appointment.id,
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
    requestedTime: appointment.requested_time,
    status: appointment.status,
    comment: appointment.comment?.trim() || 'Aucun commentaire',
  };
}

export function mapAppointmentsToListItems(
  appointments: DirectusAppointment[]
): AppointmentListItem[] {
  return appointments.map(mapAppointmentToListItem);
}
