import type {
  DirectusRelation,
  DirectusVehicle,
  DirectusVehicleBrand,
  VehicleListItem,
} from '@/features/vehicles/model/vehicle.types';

function isObjectRelation<T>(relation: DirectusRelation<T>): relation is T {
  return typeof relation === 'object' && relation !== null;
}

function getBrandName(
  brand: DirectusRelation<DirectusVehicleBrand>
): string {
  if (!isObjectRelation(brand)) {
    return 'Marque non renseignée';
  }

  return brand.name ?? 'Marque non renseignée';
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

export function mapVehicleToListItem(
  vehicle: DirectusVehicle
): VehicleListItem {
  return {
    id: vehicle.id,
    brandName: getBrandName(vehicle.brand_id ?? null),
    model: vehicle.model ?? 'Modèle non renseigné',
    registrationNumber:
      vehicle.registration_number ?? 'Immatriculation non renseignée',
    year: formatYear(vehicle.year),
    mileage: formatMileage(vehicle.mileage),
    vin: vehicle.vin ?? 'VIN non renseigné',
  };
}

export function mapVehiclesToListItems(
  vehicles: DirectusVehicle[]
): VehicleListItem[] {
  return vehicles.map(mapVehicleToListItem);
}
