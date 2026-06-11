import type {
  DirectusBrand,
  DirectusCustomer,
  DirectusRelation,
  DirectusRepair,
  DirectusServiceType,
  DirectusStatus,
  DirectusVehicle,
  DirectusWorkshop,
  RepairListItem,
} from '@/features/repairs/model/repair.types';

function isObjectRelation<T>(relation: DirectusRelation<T>): relation is T {
  return typeof relation === 'object' && relation !== null;
}

function getCustomerName(customer: DirectusRelation<DirectusCustomer>): string {
  if (!isObjectRelation(customer)) {
    return 'Client non renseigné';
  }

  const firstName = customer.first_name ?? '';
  const lastName = customer.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || 'Client non renseigné';
}

function getVehicleLabel(vehicle: DirectusRelation<DirectusVehicle>): string {
  if (!isObjectRelation(vehicle)) {
    return 'Véhicule non renseigné';
  }

  const model = vehicle.model ?? 'Modèle inconnu';
  const registration = vehicle.registration_number ?? 'Sans immatriculation';

  return `${model} - ${registration}`;
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

function getVehicleFromRepair(
  repair: DirectusRepair
): DirectusVehicle | null {
  const vehicle = repair.vehicle_id ?? null;

  if (!isObjectRelation(vehicle)) {
    return null;
  }

  return vehicle;
}

function getCustomerFromRepair(
  repair: DirectusRepair
): DirectusRelation<DirectusCustomer> {
  const customer = repair.customer_id ?? null;

  if (isObjectRelation(customer)) {
    return customer;
  }

  const vehicle = getVehicleFromRepair(repair);

  return vehicle?.customer_id ?? customer;
}

function getBrandFromRepair(
  repair: DirectusRepair
): DirectusRelation<DirectusBrand> {
  const brand = repair.brand_id ?? null;

  if (isObjectRelation(brand)) {
    return brand;
  }

  const vehicle = getVehicleFromRepair(repair);

  return vehicle?.brand_id ?? brand;
}

function formatMileage(value?: number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${value.toLocaleString('fr-FR')} km`;
}

export function mapRepairToListItem(repair: DirectusRepair): RepairListItem {
  return {
    id: repair.id,
    documentNumber: repair.document_number ?? '-',

    customerName: getCustomerName(getCustomerFromRepair(repair)),
    vehicleLabel: getVehicleLabel(repair.vehicle_id ?? null),

    brandName: getRelationName<DirectusBrand>(
      getBrandFromRepair(repair),
      'Marque non renseignée'
    ),

    statusName: getRelationName<DirectusStatus>(
      repair.status_id ?? null,
      'Statut non renseigné'
    ),

    serviceTypeName: getRelationName<DirectusServiceType>(
      repair.service_type_id ?? null,
      'Service non renseigné'
    ),

    workshopName: getRelationName<DirectusWorkshop>(
      repair.workshop_id ?? null,
      'Atelier non renseigné'
    ),

    entryMileage: formatMileage(repair.entry_mileage),
    receptionistName: repair.receptionist_name ?? '-',
  };
}

export function mapRepairsToListItems(
  repairs: DirectusRepair[]
): RepairListItem[] {
  return repairs.map(mapRepairToListItem);
}
