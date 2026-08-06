import type { DictionaryItem, Workshop } from '@/core/api/dictionaries.api';
import type { DirectusAppointment } from '@/core/api/appointments.api';
import type { DirectusAiDiagnostic } from '@/core/api/ai-diagnostics.api';
import {
  getClientStatusKey,
  getClientStatusLabel,
} from '@/features/repairs/model/client-repair.presenter';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';

export type SavMetricKey =
  | 'appointments'
  | 'arrivals'
  | 'diagnostics'
  | 'repairs'
  | 'ready';

export type SavMetricTone = 'info' | 'warning' | 'danger' | 'success';

export type SavDashboardMetric = {
  key: SavMetricKey;
  label: string;
  value: number;
  tone: SavMetricTone;
  href: '/sav/ai-diagnostics' | '/sav/appointments' | '/sav/repairs';
};

export type SavAgendaState = 'upcoming' | 'late' | 'arrived' | 'cancelled';

export type SavAgendaItem = {
  id: string;
  timeLabel: string;
  timestamp: number;
  customerLabel: string;
  vehicleLabel: string;
  serviceLabel: string;
  statusLabel: string;
  arrivalLabel: string;
  state: SavAgendaState;
};

export type SavPriorityTone = 'danger' | 'warning' | 'ready' | 'neutral';

export type SavPriorityItem = {
  id: string;
  priorityLabel: string;
  customerLabel: string;
  vehicleLabel: string;
  summary: string;
  tone: SavPriorityTone;
  href: '/sav/ai-diagnostics' | '/sav/appointments' | '/sav/repairs';
};

export type SavFlowKey =
  | 'received'
  | 'diagnostic'
  | 'intervention'
  | 'quality'
  | 'ready';

export type SavFlowItem = {
  key: SavFlowKey;
  label: string;
  value: number;
};

export type SavDiagnosticItem = {
  id: string;
  urgencyLabel: string;
  urgencyTone: SavPriorityTone;
  customerLabel: string;
  vehicleLabel: string;
  summary: string;
  dateLabel: string | null;
};

export type SavDashboardPresentation = {
  metrics: SavDashboardMetric[];
  agenda: SavAgendaItem[];
  priorities: SavPriorityItem[];
  flow: SavFlowItem[];
  diagnostics: SavDiagnosticItem[];
};

type PresentSavDashboardInput = {
  appointments: DirectusAppointment[];
  brands: DictionaryItem[];
  diagnostics: DirectusAiDiagnostic[];
  repairs: DirectusRepair[];
  serviceTypes: DictionaryItem[];
  statuses: DictionaryItem[];
  workshops: Workshop[];
  now?: Date;
};

type PresentationContext = {
  brands: DictionaryItem[];
  customers: Map<string, Record<string, unknown>>;
  serviceTypes: DictionaryItem[];
  statuses: DictionaryItem[];
  vehicles: Map<string, Record<string, unknown>>;
  workshops: Workshop[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getSavRelationId(value: unknown): number | string | null {
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
    /^(vehicule|client|service|atelier|statut|dossier)\s*#/.test(normalized)
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

function getDictionaryName<T extends { id: number; name: string }>(
  items: T[],
  relationId: number | string | null
): string | null {
  return (
    items.find((item) => relationMatches(item.id, relationId))?.name?.trim() ??
    null
  );
}

function getObjectName(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = typeof value.name === 'string' ? value.name : null;
  const label = typeof value.label === 'string' ? value.label : null;

  return cleanLabel(name) ?? cleanLabel(label);
}

function resolveRelationName<T extends { id: number; name: string }>(
  value: unknown,
  dictionary: T[],
  fallback: string
): string {
  return (
    getObjectName(value) ??
    cleanLabel(getDictionaryName(dictionary, getSavRelationId(value))) ??
    fallback
  );
}

function addRelationToMap(
  map: Map<string, Record<string, unknown>>,
  relation: unknown
): void {
  const id = getSavRelationId(relation);

  if (id !== null && isRecord(relation)) {
    map.set(String(id), relation);
  }
}

function buildContext(input: PresentSavDashboardInput): PresentationContext {
  const customers = new Map<string, Record<string, unknown>>();
  const vehicles = new Map<string, Record<string, unknown>>();

  input.appointments.forEach((appointment) => {
    addRelationToMap(customers, appointment.customer_id);
    addRelationToMap(vehicles, appointment.vehicle_id);
  });
  input.repairs.forEach((repair) => {
    addRelationToMap(customers, repair.customer_id);
    addRelationToMap(vehicles, repair.vehicle_id);

    if (isRecord(repair.vehicle_id)) {
      addRelationToMap(customers, repair.vehicle_id.customer_id);
    }
  });
  input.diagnostics.forEach((diagnostic) => {
    addRelationToMap(customers, diagnostic.customer_id);
    addRelationToMap(vehicles, diagnostic.vehicle_id);
  });

  return {
    brands: input.brands,
    customers,
    serviceTypes: input.serviceTypes,
    statuses: input.statuses,
    vehicles,
    workshops: input.workshops,
  };
}

function resolveRecord(
  value: unknown,
  map: Map<string, Record<string, unknown>>
): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }

  const id = getSavRelationId(value);

  return id === null ? null : map.get(String(id)) ?? null;
}

function getCustomerLabel(value: unknown, context: PresentationContext): string {
  const customer = resolveRecord(value, context.customers);

  if (!customer) {
    return 'Client atelier';
  }

  const firstName =
    typeof customer.first_name === 'string' ? customer.first_name : '';
  const lastName =
    typeof customer.last_name === 'string' ? customer.last_name : '';
  const fullName = cleanLabel(`${firstName} ${lastName}`);
  const email = typeof customer.email === 'string' ? cleanLabel(customer.email) : null;
  const phone = typeof customer.phone === 'string' ? cleanLabel(customer.phone) : null;

  return fullName ?? email ?? phone ?? 'Client atelier';
}

function getVehicleLabel(value: unknown, context: PresentationContext): string {
  const vehicle = resolveRecord(value, context.vehicles);

  if (!vehicle) {
    return 'Véhicule client';
  }

  const brandRelation = vehicle.brand_id;
  const brand = resolveRelationName(brandRelation, context.brands, '');
  const model =
    typeof vehicle.model === 'string' ? cleanLabel(vehicle.model) : null;
  const registration =
    typeof vehicle.registration_number === 'string'
      ? cleanLabel(vehicle.registration_number)
      : null;
  const identity = [cleanLabel(brand), model].filter(Boolean).join(' ');

  return [identity || null, registration].filter(Boolean).join(' • ') || 'Véhicule client';
}

function getRepairVehicleLabel(
  repair: DirectusRepair,
  context: PresentationContext
): string {
  if (isRecord(repair.vehicle_id) && !repair.vehicle_id.brand_id && repair.brand_id) {
    return getVehicleLabel(
      { ...repair.vehicle_id, brand_id: repair.brand_id },
      context
    );
  }

  return getVehicleLabel(repair.vehicle_id, context);
}

function getRepairCustomerLabel(
  repair: DirectusRepair,
  context: PresentationContext
): string {
  if (repair.customer_id) {
    return getCustomerLabel(repair.customer_id, context);
  }

  return isRecord(repair.vehicle_id)
    ? getCustomerLabel(repair.vehicle_id.customer_id, context)
    : 'Client atelier';
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatTime(value?: string | null): string {
  const [hours, minutes] = value?.split(':') ?? [];

  if (!hours || !minutes) {
    return 'Horaire à confirmer';
  }

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

function getAppointmentTimestamp(appointment: DirectusAppointment): number {
  const timestamp = new Date(
    `${appointment.requested_date}T${appointment.requested_time || '00:00'}`
  ).getTime();

  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function getAppointmentStatusKey(status?: string | null): string {
  const value = normalize(status);

  if (value.includes('cancel') || value.includes('annul')) return 'cancelled';
  if (value.includes('complet') || value.includes('termin')) return 'completed';
  if (value.includes('confirm')) return 'confirmed';
  if (value.includes('pending') || value.includes('attente')) return 'pending';
  return 'unknown';
}

function getAppointmentStatusLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    cancelled: 'Annulé',
    completed: 'Terminé',
    unknown: 'Suivi en cours',
  };

  return labels[getAppointmentStatusKey(status)];
}

function presentAgendaItem(
  appointment: DirectusAppointment,
  context: PresentationContext,
  now: Date
): SavAgendaItem {
  const timestamp = getAppointmentTimestamp(appointment);
  const statusKey = getAppointmentStatusKey(appointment.status);
  const arrived = Boolean(appointment.arrival_confirmed_at);
  const state: SavAgendaState =
    statusKey === 'cancelled'
      ? 'cancelled'
      : arrived
        ? 'arrived'
        : timestamp < now.getTime()
          ? 'late'
          : 'upcoming';

  return {
    id: String(appointment.id),
    timeLabel: formatTime(appointment.requested_time),
    timestamp,
    customerLabel: getCustomerLabel(appointment.customer_id, context),
    vehicleLabel: getVehicleLabel(appointment.vehicle_id, context),
    serviceLabel: resolveRelationName(
      appointment.service_type_id,
      context.serviceTypes,
      'Prestation atelier'
    ),
    statusLabel: getAppointmentStatusLabel(appointment.status),
    arrivalLabel:
      state === 'cancelled' ? 'Sans objet' : arrived ? 'Confirmée' : 'À confirmer',
    state,
  };
}

function getRepairRawStatus(
  repair: DirectusRepair,
  context: PresentationContext
): string {
  return resolveRelationName(repair.status_id, context.statuses, 'Suivi atelier');
}

function isReadyRepair(repair: DirectusRepair, context: PresentationContext): boolean {
  return getClientStatusKey(getRepairRawStatus(repair, context)) === 'ready_for_pickup';
}

function isRepairInProgress(
  repair: DirectusRepair,
  context: PresentationContext
): boolean {
  return !['completed', 'cancelled', 'ready_for_pickup'].includes(
    getClientStatusKey(getRepairRawStatus(repair, context))
  );
}

function isDiagnosticToTreat(diagnostic: DirectusAiDiagnostic): boolean {
  const status = normalize(diagnostic.status);

  return !['completed', 'complete', 'resolved', 'traite', 'cancelled', 'annule'].some(
    (terminalStatus) => status.includes(terminalStatus)
  );
}

function getUrgency(value?: string | null): {
  label: string;
  tone: SavPriorityTone;
  rank: number;
} {
  const urgency = normalize(value);

  if (urgency === 'high' || urgency.includes('elevee')) {
    return { label: 'Urgence élevée', tone: 'danger', rank: 0 };
  }

  if (urgency === 'medium' || urgency.includes('moyenne')) {
    return { label: 'À traiter', tone: 'warning', rank: 1 };
  }

  return { label: 'Priorité normale', tone: 'neutral', rank: 2 };
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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getDiagnosticSummary(diagnostic: DirectusAiDiagnostic): string {
  return (
    cleanLabel(diagnostic.problem_summary) ??
    cleanLabel(diagnostic.problem_description) ??
    'Pré-diagnostic à examiner'
  );
}

function presentDiagnostic(
  diagnostic: DirectusAiDiagnostic,
  context: PresentationContext
): SavDiagnosticItem {
  const urgency = getUrgency(diagnostic.urgency_level);

  return {
    id: String(diagnostic.id),
    urgencyLabel: urgency.label,
    urgencyTone: urgency.tone,
    customerLabel: getCustomerLabel(diagnostic.customer_id, context),
    vehicleLabel: getVehicleLabel(diagnostic.vehicle_id, context),
    summary: getDiagnosticSummary(diagnostic),
    dateLabel: formatDateTime(diagnostic.created_at),
  };
}

function getRepairServiceLabel(
  repair: DirectusRepair,
  context: PresentationContext
): string {
  return resolveRelationName(
    repair.service_type_id,
    context.serviceTypes,
    'Dossier atelier'
  );
}

function getRepairStage(
  repair: DirectusRepair,
  context: PresentationContext
): SavFlowKey | null {
  const rawStatus = getRepairRawStatus(repair, context);
  const normalizedStatus = normalize(rawStatus);
  const statusKey = getClientStatusKey(rawStatus);

  if (statusKey === 'ready_for_pickup') return 'ready';
  if (
    statusKey === 'completed' ||
    normalizedStatus.includes('controle') ||
    normalizedStatus.includes('quality')
  ) {
    return 'quality';
  }
  if (normalizedStatus.includes('diagnos')) return 'diagnostic';
  if (
    statusKey === 'in_progress' ||
    normalizedStatus.includes('intervention') ||
    normalizedStatus.includes('travaux')
  ) {
    return 'intervention';
  }
  if (
    ['pending', 'confirmed'].includes(statusKey) ||
    normalizedStatus.includes('reception') ||
    normalizedStatus.includes('recu') ||
    normalizedStatus.includes('ouvert')
  ) {
    return 'received';
  }

  return null;
}

function getRepairDateValue(repair: DirectusRepair): number {
  const value =
    repair.entry_date ?? repair.start_date ?? repair.created_at ?? repair.date_created;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;

  return Number.isNaN(timestamp) ? repair.id : timestamp;
}

export function presentSavDashboard(
  input: PresentSavDashboardInput
): SavDashboardPresentation {
  const now = input.now ?? new Date();
  const today = formatLocalDate(now);
  const context = buildContext(input);
  const agenda = input.appointments
    .filter((appointment) => appointment.requested_date === today)
    .map((appointment) => presentAgendaItem(appointment, context, now))
    .sort((first, second) => first.timestamp - second.timestamp);
  const diagnostics = [...input.diagnostics]
    .sort((first, second) => {
      const urgencyDifference =
        getUrgency(first.urgency_level).rank - getUrgency(second.urgency_level).rank;

      if (urgencyDifference !== 0) return urgencyDifference;

      return (
        new Date(second.created_at ?? 0).getTime() -
        new Date(first.created_at ?? 0).getTime()
      );
    })
    .map((diagnostic) => presentDiagnostic(diagnostic, context));
  const highDiagnostics = input.diagnostics.filter(
    (diagnostic) => getUrgency(diagnostic.urgency_level).tone === 'danger'
  );
  const lateArrivals = agenda.filter((appointment) => appointment.state === 'late');
  const readyRepairs = input.repairs.filter((repair) => isReadyRepair(repair, context));
  const unassignedRepairs = input.repairs.filter(
    (repair) =>
      'resource_id' in repair &&
      getSavRelationId(repair.resource_id) === null &&
      isRepairInProgress(repair, context)
  );
  const priorities: SavPriorityItem[] = [
    ...highDiagnostics.map((diagnostic) => ({
      id: `diagnostic-${String(diagnostic.id)}`,
      priorityLabel: 'Urgence élevée',
      customerLabel: getCustomerLabel(diagnostic.customer_id, context),
      vehicleLabel: getVehicleLabel(diagnostic.vehicle_id, context),
      summary: getDiagnosticSummary(diagnostic),
      tone: 'danger' as const,
      href: '/sav/ai-diagnostics' as const,
    })),
    ...lateArrivals.map((appointment) => ({
      id: `arrival-${appointment.id}`,
      priorityLabel: 'Arrivée à confirmer',
      customerLabel: appointment.customerLabel,
      vehicleLabel: appointment.vehicleLabel,
      summary: `Créneau de ${appointment.timeLabel} dépassé`,
      tone: 'warning' as const,
      href: '/sav/appointments' as const,
    })),
    ...readyRepairs.map((repair) => ({
      id: `ready-${repair.id}`,
      priorityLabel: 'Prêt à récupérer',
      customerLabel: getRepairCustomerLabel(repair, context),
      vehicleLabel: getRepairVehicleLabel(repair, context),
      summary: getRepairServiceLabel(repair, context),
      tone: 'ready' as const,
      href: '/sav/repairs' as const,
    })),
    ...unassignedRepairs.map((repair) => ({
      id: `unassigned-${repair.id}`,
      priorityLabel: 'Affectation requise',
      customerLabel: getRepairCustomerLabel(repair, context),
      vehicleLabel: getRepairVehicleLabel(repair, context),
      summary: getRepairServiceLabel(repair, context),
      tone: 'neutral' as const,
      href: '/sav/repairs' as const,
    })),
  ];
  const flowOrder: ReadonlyArray<{ key: SavFlowKey; label: string }> = [
    { key: 'received', label: 'Réceptionnés' },
    { key: 'diagnostic', label: 'Diagnostic' },
    { key: 'intervention', label: 'En intervention' },
    { key: 'quality', label: 'Contrôle final' },
    { key: 'ready', label: 'Prêts à récupérer' },
  ];
  const flowCounts = input.repairs.reduce<Record<SavFlowKey, number>>(
    (counts, repair) => {
      const stage = getRepairStage(repair, context);

      if (stage) counts[stage] += 1;

      return counts;
    },
    { received: 0, diagnostic: 0, intervention: 0, quality: 0, ready: 0 }
  );
  const repairsInProgress = input.repairs.filter((repair) =>
    isRepairInProgress(repair, context)
  );

  return {
    metrics: [
      {
        key: 'appointments',
        label: 'Rendez-vous aujourd’hui',
        value: agenda.length,
        tone: 'info',
        href: '/sav/appointments',
      },
      {
        key: 'arrivals',
        label: 'Arrivées à confirmer',
        value: agenda.filter(
          (appointment) =>
            appointment.state !== 'arrived' && appointment.state !== 'cancelled'
        ).length,
        tone: 'warning',
        href: '/sav/appointments',
      },
      {
        key: 'diagnostics',
        label: 'Pré-diagnostics à traiter',
        value: input.diagnostics.filter(isDiagnosticToTreat).length,
        tone: highDiagnostics.length > 0 ? 'danger' : 'info',
        href: '/sav/ai-diagnostics',
      },
      {
        key: 'repairs',
        label: 'Réparations en cours',
        value: repairsInProgress.length,
        tone: 'info',
        href: '/sav/repairs',
      },
      {
        key: 'ready',
        label: 'Véhicules prêts à récupérer',
        value: readyRepairs.length,
        tone: 'success',
        href: '/sav/repairs',
      },
    ],
    agenda,
    priorities,
    flow: flowOrder.map(({ key, label }) => ({ key, label, value: flowCounts[key] })),
    diagnostics,
  };
}

export function getResolvedRepairStatusLabel(
  repair: DirectusRepair,
  statuses: DictionaryItem[]
): string {
  const rawStatus = resolveRelationName(repair.status_id, statuses, 'Suivi atelier');

  return getClientStatusLabel(rawStatus);
}
