import type { DirectusAppointment } from '@/core/api/appointments.api';
import type { DictionaryItem, Workshop } from '@/core/api/dictionaries.api';
import type {
  DirectusRepair,
  DirectusResource,
} from '@/features/repairs/model/repair.types';

export type SavRepairStatusKey =
  | 'pending'
  | 'diagnostic'
  | 'in_progress'
  | 'completed'
  | 'ready_for_pickup'
  | 'cancelled'
  | 'unknown';

export type SavRepairStatusTone =
  | 'neutral'
  | 'diagnostic'
  | 'active'
  | 'success'
  | 'ready'
  | 'danger';

export type SavRepairProgress = {
  activeIndex: number;
  completedThrough: number;
};

export const SAV_REPAIR_PROGRESS_STEPS = [
  'Dossier ouvert',
  'Véhicule réceptionné',
  'Diagnostic',
  'Intervention',
  'Contrôle qualité',
  'Prêt à récupérer',
] as const;

export type SavRepairTechnicalItem = {
  key: string;
  label: string;
  value: string;
};

export type SavRepairViewModel = {
  id: number;
  raw: DirectusRepair;
  reference: string;
  customerLabel: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerContact: string | null;
  vehicleLabel: string;
  brandName: string | null;
  modelName: string | null;
  registrationLabel: string;
  serviceLabel: string;
  workshopLabel: string;
  technicianLabel: string;
  technicianSpecialty: string | null;
  assignmentDateLabel: string | null;
  statusKey: SavRepairStatusKey;
  statusLabel: string;
  statusTone: SavRepairStatusTone;
  entryDateValue: string | null;
  entryDateLabel: string;
  plannedExitDateValue: string | null;
  plannedExitDateLabel: string;
  progress: SavRepairProgress;
  appointmentId: number | string | null;
  isAssigned: boolean;
  isCompleted: boolean;
  isReadyForPickup: boolean;
  isActive: boolean;
  isUrgent: boolean;
  entryMileageLabel: string | null;
  vinLabel: string | null;
  yearLabel: string | null;
  hasIdentityGap: boolean;
  technicalItems: SavRepairTechnicalItem[];
  searchText: string;
  sortValue: number;
  priorityValue: number;
};

type PresentSavRepairsInput = {
  repairs: DirectusRepair[];
  appointments: DirectusAppointment[];
  brands: DictionaryItem[];
  statuses: DictionaryItem[];
  serviceTypes: DictionaryItem[];
  workshops: Workshop[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getSavRepairRelationId(
  relation: unknown
): number | string | null {
  if (typeof relation === 'number' || typeof relation === 'string') {
    return relation;
  }

  if (!isRecord(relation)) {
    return null;
  }

  const id = relation.id;
  return typeof id === 'number' || typeof id === 'string' ? id : null;
}

function relationsMatch(first: unknown, second: unknown): boolean {
  const firstId = getSavRepairRelationId(first);
  const secondId = getSavRepairRelationId(second);

  return firstId !== null && secondId !== null && String(firstId) === String(secondId);
}

export function normalizeSavRepairValue(value?: string | null): string {
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
  const normalized = normalizeSavRepairValue(value);

  if (
    !normalized ||
    normalized === '-' ||
    normalized.includes('unknown') ||
    normalized.includes('non renseigne') ||
    /^(client|vehicule|service|atelier|statut|dossier|document|resource)\s*#/.test(
      normalized
    )
  ) {
    return null;
  }

  return value?.trim().replace(/\s+-\s*$/, '').replace(/\s+/g, ' ') || null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned && cleaned !== '-' ? cleaned : null;
}

function getRecordLabel(record: unknown): string | null {
  if (!isRecord(record)) {
    return null;
  }

  return cleanLabel(
    typeof record.name === 'string'
      ? record.name
      : typeof record.label === 'string'
        ? record.label
        : null
  );
}

function getDictionaryLabel<T extends { id: number; name: string }>(
  items: T[],
  relation: unknown
): string | null {
  const relationId = getSavRepairRelationId(relation);

  return cleanLabel(
    items.find(
      (item) => relationId !== null && String(item.id) === String(relationId)
    )?.name
  );
}

function getRelationLabel<T extends { id: number; name: string }>(
  relation: unknown,
  dictionary: T[],
  fallback: string
): string {
  return getRecordLabel(relation) ?? getDictionaryLabel(dictionary, relation) ?? fallback;
}

function getLinkedAppointment(
  repair: DirectusRepair,
  appointments: DirectusAppointment[]
): DirectusAppointment | null {
  return (
    appointments.find((appointment) =>
      relationsMatch(appointment.id, repair.appointment_id)
    ) ?? null
  );
}

function getVehicleRecord(
  repair: DirectusRepair,
  appointment: DirectusAppointment | null
): Record<string, unknown> | null {
  if (isRecord(repair.vehicle_id)) {
    return repair.vehicle_id as unknown as Record<string, unknown>;
  }

  if (appointment && isRecord(appointment.vehicle_id)) {
    return appointment.vehicle_id as Record<string, unknown>;
  }

  return null;
}

function getCustomerRecord(
  repair: DirectusRepair,
  vehicle: Record<string, unknown> | null,
  appointment: DirectusAppointment | null
): Record<string, unknown> | null {
  if (isRecord(repair.customer_id)) {
    return repair.customer_id as unknown as Record<string, unknown>;
  }

  if (vehicle && isRecord(vehicle.customer_id)) {
    const vehicleCustomerId = getSavRepairRelationId(vehicle.customer_id);
    const appointmentCustomerId = getSavRepairRelationId(appointment?.customer_id);

    if (
      appointmentCustomerId === null ||
      !isRecord(appointment?.customer_id) ||
      (
      vehicleCustomerId !== null &&
      appointmentCustomerId !== null &&
      String(vehicleCustomerId) !== String(appointmentCustomerId)
      )
    ) {
      return vehicle.customer_id as Record<string, unknown>;
    }
  }

  return appointment && isRecord(appointment.customer_id)
    ? (appointment.customer_id as Record<string, unknown>)
    : null;
}

function getCustomerPresentation(customer: Record<string, unknown> | null): {
  label: string;
  phone: string | null;
  email: string | null;
} {
  if (!customer) {
    return { label: 'Client à identifier', phone: null, email: null };
  }

  const firstName = cleanLabel(
    typeof customer.first_name === 'string' ? customer.first_name : null
  );
  const lastName = cleanLabel(
    typeof customer.last_name === 'string' ? customer.last_name : null
  );
  const companyName = cleanLabel(
    typeof customer.company_name === 'string' ? customer.company_name : null
  );
  const phone = cleanText(customer.phone);
  const rawEmail = cleanText(customer.email);
  const email = rawEmail && !normalizeSavRepairValue(rawEmail).endsWith('.local')
    ? rawEmail
    : null;

  return {
    label:
      companyName ??
      ([firstName, lastName].filter(Boolean).join(' ') || 'Client à identifier'),
    phone,
    email,
  };
}

function getBrandLabel(
  repair: DirectusRepair,
  vehicle: Record<string, unknown> | null,
  brands: DictionaryItem[]
): string | null {
  const relation = vehicle?.brand_id ?? repair.brand_id;
  return getRecordLabel(relation) ?? getDictionaryLabel(brands, relation);
}

function getVehiclePresentation(
  repair: DirectusRepair,
  vehicle: Record<string, unknown> | null,
  brands: DictionaryItem[]
): {
  label: string;
  brand: string | null;
  model: string | null;
  registration: string;
  vin: string | null;
  year: string | null;
  mileage: string | null;
} {
  const brand = getBrandLabel(repair, vehicle, brands);
  const model = cleanLabel(typeof vehicle?.model === 'string' ? vehicle.model : null);
  const registration = cleanLabel(
    typeof vehicle?.registration_number === 'string'
      ? vehicle.registration_number
      : null
  );
  const vin = cleanLabel(typeof vehicle?.vin === 'string' ? vehicle.vin : null);
  const yearValue = vehicle?.year;
  const year =
    typeof yearValue === 'number' || typeof yearValue === 'string'
      ? String(yearValue)
      : null;
  const vehicleMileage = vehicle?.mileage;
  const mileageValue =
    typeof repair.entry_mileage === 'number'
      ? repair.entry_mileage
      : typeof vehicleMileage === 'number'
        ? vehicleMileage
        : null;
  const identity = [brand, model].filter(Boolean).join(' ');

  return {
    label: identity || 'Véhicule à identifier',
    brand,
    model,
    registration: registration ?? 'Immatriculation non renseignée',
    vin,
    year,
    mileage:
      mileageValue === null ? null : `${mileageValue.toLocaleString('fr-FR')} km`,
  };
}

function getRawStatus(repair: DirectusRepair, statuses: DictionaryItem[]): string | null {
  return getRecordLabel(repair.status_id) ?? getDictionaryLabel(statuses, repair.status_id);
}

export function getSavRepairStatusKey(
  value?: string | null
): SavRepairStatusKey {
  const status = normalizeSavRepairValue(value);

  if (
    status.includes('ready for pickup') ||
    status.includes('ready for pick up') ||
    status.includes('pret a recuperer') ||
    status.includes('pret pour retrait')
  ) return 'ready_for_pickup';
  if (status.includes('cancel') || status.includes('annul')) return 'cancelled';
  if (status.includes('diagnostic')) return 'diagnostic';
  if (
    status.includes('completed') ||
    status.includes('complete') ||
    status.includes('termine') ||
    status.includes('cloture')
  ) return 'completed';
  if (status.includes('in progress') || status.includes('en cours')) return 'in_progress';
  if (status.includes('pending') || status.includes('attente')) return 'pending';
  return 'unknown';
}

function getStatusPresentation(
  repair: DirectusRepair,
  statuses: DictionaryItem[]
): { key: SavRepairStatusKey; label: string; tone: SavRepairStatusTone } {
  const rawStatus = getRawStatus(repair, statuses);
  let key = getSavRepairStatusKey(rawStatus);

  if (repair.real_exit_date && key !== 'cancelled') {
    key = 'completed';
  } else if (key === 'unknown' && repair.work_done) {
    key = 'in_progress';
  } else if (key === 'unknown' && repair.real_diagnosis) {
    key = 'diagnostic';
  }

  const labels: Record<SavRepairStatusKey, string> = {
    pending: 'En attente',
    diagnostic: 'Diagnostic atelier',
    in_progress: 'En cours',
    completed: 'Terminée',
    ready_for_pickup: 'Prête à récupérer',
    cancelled: 'Annulée',
    unknown: 'Mise à jour en cours',
  };
  const tones: Record<SavRepairStatusKey, SavRepairStatusTone> = {
    pending: 'neutral',
    diagnostic: 'diagnostic',
    in_progress: 'active',
    completed: 'success',
    ready_for_pickup: 'ready',
    cancelled: 'danger',
    unknown: 'neutral',
  };

  return { key, label: labels[key], tone: tones[key] };
}

function formatDate(value?: string | null, fallback = 'Date non planifiée'): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);

  return Number.isNaN(date.getTime())
    ? cleanLabel(value) ?? fallback
    : new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
}

function getTimestamp(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? fallback : timestamp;
}

function getReference(repair: DirectusRepair, entryDate: string | null): string {
  const documentNumber = cleanLabel(repair.document_number);

  if (documentNumber && !normalizeSavRepairValue(documentNumber).startsWith('dossier')) {
    return normalizeSavRepairValue(documentNumber).startsWith('reference sav')
      ? documentNumber
      : `Référence SAV ${documentNumber}`;
  }

  const year = entryDate?.match(/^(\d{4})/)?.[1] ?? null;
  const datePart = year ? `${year}-` : '';
  return `Référence SAV SMEIA-${datePart}${String(repair.id).padStart(4, '0')}`;
}

function getTechnicianPresentation(relation: unknown): {
  label: string;
  specialty: string | null;
  isAssigned: boolean;
} {
  const relationId = getSavRepairRelationId(relation);

  if (!isRecord(relation)) {
    return {
      label: relationId === null ? 'Technicien non affecté' : 'Technicien affecté',
      specialty: null,
      isAssigned: relationId !== null,
    };
  }

  const resource = relation as unknown as DirectusResource;
  return {
    label: cleanLabel(resource.full_name) ?? 'Technicien affecté',
    specialty: cleanLabel(resource.specialty),
    isAssigned: relationId !== null,
  };
}

function getExplicitDate(record: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (typeof record[field] === 'string' && cleanText(record[field])) {
      return String(record[field]);
    }
  }
  return null;
}

function getUrgency(repair: DirectusRepair): { urgent: boolean; priority: number } {
  const record = repair as unknown as Record<string, unknown>;
  const rawPriority = [record.priority, record.urgency, record.urgency_level]
    .map((value) => (typeof value === 'string' ? normalizeSavRepairValue(value) : value))
    .find((value) => value !== null && value !== undefined);
  const urgent =
    rawPriority === true ||
    rawPriority === 1 ||
    rawPriority === 'urgent' ||
    rawPriority === 'high' ||
    rawPriority === 'haute' ||
    rawPriority === 'critique';

  return { urgent, priority: urgent ? 1 : 0 };
}

function getProgress(
  repair: DirectusRepair,
  statusKey: SavRepairStatusKey,
  appointment: DirectusAppointment | null
): SavRepairProgress {
  if (statusKey === 'cancelled') return { activeIndex: 0, completedThrough: -1 };
  if (statusKey === 'ready_for_pickup') return { activeIndex: 5, completedThrough: 4 };
  if (statusKey === 'completed') return { activeIndex: 4, completedThrough: 3 };
  if (statusKey === 'in_progress' || repair.work_done) {
    return { activeIndex: 3, completedThrough: repair.real_diagnosis ? 2 : 1 };
  }
  if (statusKey === 'diagnostic' || repair.real_diagnosis) {
    return { activeIndex: 2, completedThrough: 1 };
  }
  if (appointment?.arrival_confirmed_at) return { activeIndex: 2, completedThrough: 1 };
  if (repair.entry_date || repair.appointment_id) return { activeIndex: 1, completedThrough: 0 };
  return { activeIndex: 0, completedThrough: -1 };
}

function getTechnicalItems(repair: DirectusRepair): SavRepairTechnicalItem[] {
  return [
    { key: 'request', label: 'Description de la demande', value: cleanText(repair.description) },
    { key: 'diagnosis', label: 'Diagnostic réel', value: cleanText(repair.real_diagnosis) },
    { key: 'work', label: 'Travaux effectués', value: cleanText(repair.work_done) },
    { key: 'solution', label: 'Solution apportée', value: cleanText(repair.solution_description) },
    {
      key: 'recommendations',
      label: 'Recommandations du technicien',
      value: cleanText(repair.technician_recommendations),
    },
    { key: 'note', label: 'Note SAV', value: cleanText(repair.note) },
  ].filter((item): item is SavRepairTechnicalItem => item.value !== null);
}

function presentSavRepair(
  repair: DirectusRepair,
  context: Omit<PresentSavRepairsInput, 'repairs'>
): SavRepairViewModel {
  const appointment = getLinkedAppointment(repair, context.appointments);
  const vehicleRecord = getVehicleRecord(repair, appointment);
  const customerRecord = getCustomerRecord(repair, vehicleRecord, appointment);
  const customer = getCustomerPresentation(customerRecord);
  const vehicle = getVehiclePresentation(repair, vehicleRecord, context.brands);
  const status = getStatusPresentation(repair, context.statuses);
  const technician = getTechnicianPresentation(repair.resource_id);
  const entryDate =
    repair.entry_date ?? repair.start_date ?? repair.created_at ?? repair.date_created ?? null;
  const plannedExitDate = repair.planned_exit_date ?? repair.end_date ?? null;
  const repairRecord = repair as unknown as Record<string, unknown>;
  const assignmentDate = getExplicitDate(repairRecord, [
    'assigned_at',
    'assignment_date',
    'resource_assigned_at',
  ]);
  const urgency = getUrgency(repair);
  const serviceLabel = getRelationLabel(
    repair.service_type_id ?? appointment?.service_type_id,
    context.serviceTypes,
    'Service non renseigné'
  );
  const workshopLabel = getRelationLabel(
    repair.workshop_id ?? appointment?.workshop_id,
    context.workshops,
    'Atelier non renseigné'
  );
  const reference = getReference(repair, entryDate);
  const technicalItems = getTechnicalItems(repair);
  const isCompleted = status.key === 'completed' || Boolean(repair.real_exit_date);
  const isReadyForPickup = status.key === 'ready_for_pickup';
  const searchText = normalizeSavRepairValue(
    [
      reference,
      customer.label,
      vehicle.label,
      vehicle.registration,
      serviceLabel,
      technician.label,
      status.label,
    ].join(' ')
  );

  return {
    id: repair.id,
    raw: repair,
    reference,
    customerLabel: customer.label,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    customerContact: [customer.phone, customer.email].filter(Boolean).join(' · ') || null,
    vehicleLabel: vehicle.label,
    brandName: vehicle.brand,
    modelName: vehicle.model,
    registrationLabel: vehicle.registration,
    serviceLabel,
    workshopLabel,
    technicianLabel: technician.label,
    technicianSpecialty: technician.specialty,
    assignmentDateLabel: assignmentDate ? formatDate(assignmentDate) : null,
    statusKey: status.key,
    statusLabel: status.label,
    statusTone: status.tone,
    entryDateValue: entryDate,
    entryDateLabel: formatDate(entryDate),
    plannedExitDateValue: plannedExitDate,
    plannedExitDateLabel: formatDate(plannedExitDate),
    progress: getProgress(repair, status.key, appointment),
    appointmentId: getSavRepairRelationId(repair.appointment_id),
    isAssigned: technician.isAssigned,
    isCompleted,
    isReadyForPickup,
    isActive: !isCompleted && !isReadyForPickup && status.key !== 'cancelled',
    isUrgent: urgency.urgent,
    entryMileageLabel: vehicle.mileage,
    vinLabel: vehicle.vin,
    yearLabel: vehicle.year,
    hasIdentityGap:
      customer.label === 'Client à identifier' || vehicle.label === 'Véhicule à identifier',
    technicalItems,
    searchText,
    sortValue: getTimestamp(entryDate, repair.id),
    priorityValue: urgency.priority,
  };
}

export function presentSavRepairs({
  repairs,
  ...context
}: PresentSavRepairsInput): SavRepairViewModel[] {
  return repairs.map((repair) => presentSavRepair(repair, context));
}
