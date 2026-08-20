import type {
  CrcAppointment,
  CrcAppointmentQueue,
  CrcAppointmentStatus,
} from '@/core/api/crc-appointments.api';

export type CrcStatusTone = 'danger' | 'info' | 'muted' | 'success' | 'warning';

export type CrcAppointmentViewModel = {
  id: number;
  reference: string;
  customerName: string;
  customerInitials: string;
  customerEmail: string;
  customerPhone: string;
  vehicleLabel: string;
  registrationNumber: string;
  serviceTypeName: string;
  requestedSlot: string;
  statusLabel: string;
  statusTone: CrcStatusTone;
  workshopName: string;
  showroomName: string;
  locationLabel: string;
  problemSummary: string;
};

export type CrcQueueTab = {
  queue: CrcAppointmentQueue;
  label: string;
  emptyTitle: string;
  emptyMessage: string;
};

export const CRC_QUEUE_TABS: readonly CrcQueueTab[] = [
  {
    queue: 'new',
    label: 'Nouvelles demandes',
    emptyTitle: 'Aucune nouvelle demande',
    emptyMessage: 'La file des nouvelles demandes est à jour.',
  },
  {
    queue: 'callback',
    label: 'Clients à relancer',
    emptyTitle: 'Aucun client à relancer',
    emptyMessage: 'Aucun rendez-vous ne nécessite de rappel actuellement.',
  },
  {
    queue: 'proposed',
    label: 'Propositions envoyées',
    emptyTitle: 'Aucune proposition envoyée',
    emptyMessage: 'Aucune proposition n’est en attente dans cette file.',
  },
  {
    queue: 'processed',
    label: 'Demandes traitées',
    emptyTitle: 'Aucune demande traitée',
    emptyMessage: 'Les demandes traitées apparaîtront ici.',
  },
] as const;

const STATUS_PRESENTATION: Record<
  CrcAppointmentStatus,
  { label: string; tone: CrcStatusTone }
> = {
  pending: { label: 'Nouvelle demande', tone: 'info' },
  callback_pending: { label: 'À relancer', tone: 'warning' },
  alternative_proposed: { label: 'Proposition envoyée', tone: 'info' },
  confirmed: { label: 'Confirmée', tone: 'success' },
  rejected: { label: 'Refusée', tone: 'danger' },
  cancelled: { label: 'Annulée', tone: 'muted' },
};

function joinNonEmpty(parts: (string | null | undefined)[]): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ');
}

function getInitials(name: string): string {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'CL';
}

function formatRequestedSlot(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  const dateLabel = Number.isNaN(parsedDate.getTime())
    ? date
    : new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsedDate);
  const timeLabel = time.slice(0, 5);

  return `${dateLabel} · ${timeLabel}`;
}

export function presentCrcAppointment(
  appointment: CrcAppointment
): CrcAppointmentViewModel {
  const customerName =
    joinNonEmpty([
      appointment.customer?.first_name,
      appointment.customer?.last_name,
    ]) || 'Client non renseigné';
  const vehicleLabel =
    joinNonEmpty([
      appointment.vehicle.brand_name,
      appointment.vehicle.model,
    ]) || 'Véhicule non renseigné';
  const locationLabel =
    joinNonEmpty([
      appointment.workshop.showroom.city,
      appointment.workshop.showroom.address,
    ]) || 'Adresse non renseignée';
  const status = STATUS_PRESENTATION[appointment.status];

  return {
    id: appointment.id,
    reference: `Demande #${appointment.id}`,
    customerName,
    customerInitials: getInitials(customerName),
    customerEmail: appointment.customer?.email ?? 'Non renseigné',
    customerPhone: appointment.customer?.phone ?? 'Non renseigné',
    vehicleLabel,
    registrationNumber:
      appointment.vehicle.registration_number ?? 'Non renseignée',
    serviceTypeName: appointment.service_type.name,
    requestedSlot: formatRequestedSlot(
      appointment.requested_date,
      appointment.requested_time
    ),
    statusLabel: status.label,
    statusTone: status.tone,
    workshopName: appointment.workshop.name,
    showroomName: appointment.workshop.showroom.name,
    locationLabel,
    problemSummary:
      appointment.problem_summary ?? 'Aucun motif renseigné par le client.',
  };
}

export function getCrcQueueTab(queue: CrcAppointmentQueue): CrcQueueTab {
  return CRC_QUEUE_TABS.find((tab) => tab.queue === queue) ?? CRC_QUEUE_TABS[0];
}
