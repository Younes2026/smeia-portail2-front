import type {
  DirectusRelation,
  DirectusVehicle,
  DirectusVehicleBrand,
  VehicleListItem,
  VehicleRepairListItem,
} from '@/features/vehicles/model/vehicle.types';
import type { DirectusRepair } from '@/features/repairs/model/repair.types';

type DirectusVehicleRepair = DirectusRepair & {
  date_created?: string | null;
  entry_date?: string | null;
  final_cost?: number | string | null;
  total_cost?: number | string | null;
};

function isObjectRelation<T>(relation: DirectusRelation<T>): relation is T {
  return typeof relation === 'object' && relation !== null;
}

function getFlexibleRelationId(relation: unknown): number | string | null {
  if (typeof relation === 'number' || typeof relation === 'string') {
    return relation;
  }

  if (typeof relation !== 'object' || relation === null || !('id' in relation)) {
    return null;
  }

  const id = relation.id;

  return typeof id === 'number' || typeof id === 'string' ? id : null;
}

function getBrandName(
  brand: DirectusRelation<DirectusVehicleBrand>
): string {
  if (!isObjectRelation(brand)) {
    return 'Marque non renseignée';
  }

  return (
    brand.name?.trim() ||
    brand.label?.trim() ||
    'Marque non renseignée'
  );
}

function formatMileage(value?: number | null): string {
  if (value === null || value === undefined) {
    return 'Kilométrage non renseigné';
  }

  return `${value.toLocaleString('fr-FR')} km`;
}

function formatYear(value?: number | null): string {
  if (value === null || value === undefined) {
    return 'Année non renseignée';
  }

  return String(value);
}

function getRelationName<T extends { name: string }>(
  relation: DirectusRelation<T>,
  fallback: string
): string {
  if (!isObjectRelation(relation)) {
    return fallback;
  }

  return relation.name || fallback;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Date non renseignée';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('fr-FR');
}

function formatCost(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') {
    return 'Non communiqué';
  }

  const numericValue =
    typeof value === 'string' ? Number.parseFloat(value) : value;

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function mapVehicleToListItem(
  vehicle: DirectusVehicle
): VehicleListItem {
  return {
    id: vehicle.id,
    brandId: getFlexibleRelationId(vehicle.brand_id),
    brandName: getBrandName(vehicle.brand_id ?? null),
    model: vehicle.model ?? 'Modèle non renseigné',
    registrationNumber:
      vehicle.registration_number ?? 'Immatriculation non renseignée',
    year: formatYear(vehicle.year),
    yearValue: vehicle.year ?? null,
    mileage: formatMileage(vehicle.mileage),
    mileageValue: vehicle.mileage ?? null,
    vin: vehicle.vin ?? 'VIN non renseigné',
    vinValue: vehicle.vin?.trim() || null,
  };
}

export function mapVehiclesToListItems(
  vehicles: DirectusVehicle[]
): VehicleListItem[] {
  return vehicles.map(mapVehicleToListItem);
}

export function mapVehicleRepairToListItem(
  repair: DirectusVehicleRepair
): VehicleRepairListItem {
  return {
    id: repair.id,
    documentNumber: repair.document_number ?? `Dossier #${repair.id}`,
    statusName: getRelationName(
      repair.status_id ?? null,
      'Statut non renseigné'
    ),
    serviceTypeName: getRelationName(
      repair.service_type_id ?? null,
      'Service non renseigné'
    ),
    workshopName: getRelationName(
      repair.workshop_id ?? null,
      'Atelier non renseigné'
    ),
    entryDate: formatDate(
      repair.entry_date ?? repair.start_date ?? repair.date_created
    ),
    finalCost: formatCost(repair.final_cost ?? repair.total_cost),
  };
}

export function mapVehicleRepairsToListItems(
  repairs: DirectusVehicleRepair[]
): VehicleRepairListItem[] {
  return repairs.map(mapVehicleRepairToListItem);
}
