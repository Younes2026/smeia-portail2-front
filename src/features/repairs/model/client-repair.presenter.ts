import type {
  DictionaryItem,
  Workshop,
} from '@/core/api/dictionaries.api';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';
import type { RepairListItem } from '@/features/repairs/model/repair.types';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';

export type ClientRepairStatusKey =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'ready_for_pickup'
  | 'unknown';

export type ClientRepairProgress = {
  activeIndex: number;
  completedThrough: number;
};

export const CLIENT_REPAIR_PROGRESS_STEPS = [
  'Dossier ouvert',
  'Véhicule réceptionné',
  'Diagnostic atelier',
  'Intervention',
  'Contrôle final',
  'Prêt à récupérer',
] as const;

export type ClientRepairViewModel = {
  id: number;
  appointmentId: number | string | null;
  vehicleId: number | null;
  brandName: string | null;
  description: string | null;
  diagnosticLabel: string | null;
  entryDateLabel: string;
  entryDateValue: string | null;
  finalCostLabel: string | null;
  isActive: boolean;
  message: string;
  mileageLabel: string | null;
  note: string | null;
  progress: ClientRepairProgress;
  receptionistLabel: string | null;
  referenceLabel: string;
  registrationLabel: string | null;
  realExitDateLabel: string | null;
  recommendationsLabel: string | null;
  serviceLabel: string;
  solutionLabel: string | null;
  sortValue: number;
  statusKey: ClientRepairStatusKey;
  statusLabel: string;
  vehicleLabel: string;
  workDoneLabel: string | null;
  workshopLabel: string;
};

export type PresentClientRepairsInput = {
  appointments: AppointmentListItem[];
  brands: DictionaryItem[];
  repairs: RepairListItem[];
  serviceTypes: DictionaryItem[];
  statuses: DictionaryItem[];
  vehicles: VehicleListItem[];
  workshops: Workshop[];
};

function normalizeValue(value?: string | null): string {
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

function isUsableLabel(value?: string | null): value is string {
  const normalized = normalizeValue(value);

  return Boolean(
    normalized &&
      !normalized.includes('unknown') &&
      !normalized.includes('non renseigne') &&
      !normalized.includes("en attente d'information") &&
      !/^(statut|status|service|atelier|vehicule|dossier|document|marque)\s*#/.test(
        normalized
      )
  );
}

function relationIdsMatch(
  first: number | string | null,
  second: number | string | null
): boolean {
  return first !== null && second !== null && String(first) === String(second);
}

function getDictionaryName<T extends { id: number; name: string }>(
  items: T[],
  relationId: number | string | null
): string | null {
  if (relationId === null) {
    return null;
  }

  return (
    items.find((item) => relationIdsMatch(item.id, relationId))?.name?.trim() ||
    null
  );
}

export function getClientStatusKey(
  value?: string | null
): ClientRepairStatusKey {
  const status = normalizeValue(value);

  if (
    status.includes('ready for pickup') ||
    status.includes('ready for pick up') ||
    status.includes('ready to pickup') ||
    status.includes('pret a recuperer') ||
    status.includes('pret pour retrait') ||
    status.includes('pret a retirer')
  ) {
    return 'ready_for_pickup';
  }

  if (
    status.includes('cancelled') ||
    status.includes('canceled') ||
    status.includes('annule')
  ) {
    return 'cancelled';
  }

  if (
    status.includes('completed') ||
    status.includes('complete') ||
    status.includes('termine') ||
    status.includes('cloture')
  ) {
    return 'completed';
  }

  if (status.includes('in progress') || status.includes('en cours')) {
    return 'in_progress';
  }

  if (status.includes('confirmed') || status.includes('confirme')) {
    return 'confirmed';
  }

  if (status.includes('pending') || status.includes('en attente')) {
    return 'pending';
  }

  return 'unknown';
}

export function getClientStatusLabel(value?: string | null): string {
  const labels: Record<ClientRepairStatusKey, string> = {
    pending: 'Dossier enregistré',
    confirmed: 'Prise en charge confirmée',
    in_progress: 'Intervention en cours',
    completed: 'Intervention terminée',
    cancelled: 'Dossier annulé',
    ready_for_pickup: 'Prêt à récupérer',
    unknown: 'Suivi en cours',
  };

  return labels[getClientStatusKey(value)];
}

function getProgress(
  repair: RepairListItem,
  statusKey: ClientRepairStatusKey,
  arrivalConfirmedAt: string | null
): ClientRepairProgress {
  if (statusKey === 'ready_for_pickup') {
    return { activeIndex: 5, completedThrough: 4 };
  }

  if (statusKey === 'completed') {
    return { activeIndex: 4, completedThrough: 3 };
  }

  if (statusKey === 'in_progress') {
    return { activeIndex: 3, completedThrough: 2 };
  }

  if (repair.realDiagnosis) {
    return { activeIndex: 3, completedThrough: 2 };
  }

  if (arrivalConfirmedAt) {
    return { activeIndex: 2, completedThrough: 1 };
  }

  if (statusKey === 'confirmed') {
    return { activeIndex: 1, completedThrough: 0 };
  }

  return { activeIndex: 0, completedThrough: -1 };
}

function getProgressMessage(statusKey: ClientRepairStatusKey): string {
  if (statusKey === 'in_progress') {
    return 'Votre véhicule est actuellement en cours d’intervention dans nos ateliers.';
  }

  if (statusKey === 'completed') {
    return "L’intervention est terminée. Nos équipes effectuent les dernières vérifications.";
  }

  if (statusKey === 'ready_for_pickup') {
    return 'Votre véhicule est prêt à être récupéré à l’atelier SMEIA.';
  }

  return 'Le suivi de votre véhicule sera mis à jour prochainement.';
}

function getReferenceLabel(repair: RepairListItem): string {
  if (
    isUsableLabel(repair.documentNumber) &&
    !normalizeValue(repair.documentNumber).startsWith('dossier')
  ) {
    return normalizeValue(repair.documentNumber).startsWith('reference sav')
      ? repair.documentNumber.trim()
      : `Référence SAV ${repair.documentNumber.trim()}`;
  }

  const year = repair.entryDateValue?.match(/^(\d{4})/)?.[1] ?? null;
  const paddedId = String(repair.id).padStart(4, '0');
  const reference = year ? `SMEIA-${year}-${paddedId}` : `SMEIA-${paddedId}`;

  return `Référence SAV ${reference}`;
}

export type ClientVehiclePresentation = {
  brandName: string | null;
  label: string;
  modelName: string | null;
  registrationLabel: string | null;
};

export function presentClientVehicle(
  vehicleId: number | string | null,
  vehicles: VehicleListItem[],
  brands: DictionaryItem[],
  fallback: {
    brandName?: string | null;
    model?: string | null;
    registration?: string | null;
  } = {}
): ClientVehiclePresentation {
  const vehicle = vehicles.find(
    (item) => vehicleId !== null && String(item.id) === String(vehicleId)
  );
  const dictionaryBrand = getDictionaryName(brands, vehicle?.brandId ?? null);
  const brandName = isUsableLabel(dictionaryBrand)
    ? dictionaryBrand
    : isUsableLabel(vehicle?.brandName)
      ? vehicle.brandName.trim()
    : isUsableLabel(fallback.brandName)
      ? fallback.brandName.trim()
      : null;
  const model = isUsableLabel(vehicle?.model)
    ? vehicle.model.trim()
    : isUsableLabel(fallback.model)
      ? fallback.model.trim()
      : null;
  const registrationLabel = isUsableLabel(vehicle?.registrationNumber)
    ? vehicle.registrationNumber.trim()
    : isUsableLabel(fallback.registration)
      ? fallback.registration.trim()
      : null;
  const identity = [brandName, model].filter(Boolean).join(' ').trim();
  const label = [identity, registrationLabel].filter(Boolean).join(' • ');

  return {
    brandName,
    label: label || 'Votre véhicule',
    modelName: model,
    registrationLabel,
  };
}

function formatOptionalDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR');
}

function formatOptionalMileage(value?: number | null): string | null {
  return value === null || value === undefined
    ? null
    : `${value.toLocaleString('fr-FR')} km`;
}

function formatOptionalCost(value?: number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(value);
}

function getSortValue(repair: RepairListItem): number {
  const timestamp = repair.entryDateValue
    ? new Date(repair.entryDateValue).getTime()
    : Number.NaN;

  return Number.isNaN(timestamp) ? repair.id : timestamp;
}

function presentClientRepair(
  repair: RepairListItem,
  input: Omit<PresentClientRepairsInput, 'repairs'>
): ClientRepairViewModel {
  const dictionaryStatus = getDictionaryName(input.statuses, repair.statusId);
  const rawStatus = dictionaryStatus ?? repair.statusName;
  const statusKey = getClientStatusKey(rawStatus);
  const appointment = input.appointments.find((item) =>
    relationIdsMatch(item.id, repair.appointmentId)
  );
  const dictionaryService = getDictionaryName(
    input.serviceTypes,
    repair.serviceTypeId
  );
  const dictionaryWorkshop = getDictionaryName(
    input.workshops,
    repair.workshopId
  );
  const vehicle = presentClientVehicle(
    repair.vehicleId,
    input.vehicles,
    input.brands,
    {
      brandName: repair.brandName,
      model: repair.vehicleModel,
      registration: repair.registrationNumber,
    }
  );

  return {
    id: repair.id,
    appointmentId: repair.appointmentId,
    vehicleId: repair.vehicleId,
    brandName: vehicle.brandName,
    description: repair.description,
    diagnosticLabel: repair.realDiagnosis,
    entryDateLabel: isUsableLabel(repair.entryDate)
      ? repair.entryDate
      : 'Date à confirmer',
    entryDateValue: repair.entryDateValue,
    finalCostLabel: formatOptionalCost(repair.finalCost),
    isActive:
      repair.realExitDate === null &&
      !['cancelled', 'completed', 'ready_for_pickup'].includes(statusKey),
    message: getProgressMessage(statusKey),
    mileageLabel: formatOptionalMileage(repair.entryMileageValue),
    note: repair.note,
    progress: getProgress(
      repair,
      statusKey,
      appointment?.arrivalConfirmedAt ?? null
    ),
    receptionistLabel: isUsableLabel(repair.receptionistName)
      ? repair.receptionistName.trim()
      : null,
    referenceLabel: getReferenceLabel(repair),
    registrationLabel: vehicle.registrationLabel,
    realExitDateLabel: formatOptionalDate(repair.realExitDate),
    recommendationsLabel: repair.technicianRecommendations,
    serviceLabel: isUsableLabel(dictionaryService)
      ? dictionaryService
      : isUsableLabel(repair.serviceTypeName)
        ? repair.serviceTypeName
        : 'Service atelier',
    sortValue: getSortValue(repair),
    statusKey,
    statusLabel: getClientStatusLabel(rawStatus),
    solutionLabel: repair.solutionDescription,
    vehicleLabel: vehicle.label,
    workDoneLabel: repair.workDone,
    workshopLabel: isUsableLabel(dictionaryWorkshop)
      ? dictionaryWorkshop
      : isUsableLabel(repair.workshopName)
        ? repair.workshopName
        : 'Atelier SMEIA',
  };
}

export function presentClientRepairs(
  input: PresentClientRepairsInput
): ClientRepairViewModel[] {
  const { repairs, ...context } = input;

  return repairs.map((repair) => presentClientRepair(repair, context));
}
