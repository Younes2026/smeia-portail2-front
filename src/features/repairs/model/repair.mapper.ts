import type {
  DirectusBrand,
  DirectusCustomer,
  DirectusRelation,
  DirectusRepair,
  DirectusServiceType,
  DirectusStatus,
  DirectusVehicle,
  DirectusWorkshop,
  RepairDetailItem,
  RepairListItem,
} from '@/features/repairs/model/repair.types';

function isObjectRelation<T>(relation: DirectusRelation<T>): relation is T {
  return typeof relation === 'object' && relation !== null;
}

function getRelationId<T extends { id: number }>(
  relation: DirectusRelation<T>
): number | null {
  if (typeof relation === 'number') {
    return relation;
  }

  if (isObjectRelation(relation)) {
    return relation.id;
  }

  return null;
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

  const model = vehicle.model?.trim() || null;
  const registration = vehicle.registration_number?.trim() || null;

  if (model && registration) {
    return `${model} - ${registration}`;
  }

  return model ?? registration ?? 'Véhicule non renseigné';
}

function getVehicleModel(
  vehicle: DirectusRelation<DirectusVehicle>
): string {
  if (!isObjectRelation(vehicle)) {
    return 'Véhicule non renseigné';
  }

  return vehicle.model ?? 'Véhicule non renseigné';
}

function getRegistrationNumber(
  vehicle: DirectusRelation<DirectusVehicle>
): string {
  if (!isObjectRelation(vehicle)) {
    return 'Immatriculation non renseignée';
  }

  return vehicle.registration_number ?? 'Immatriculation non renseignée';
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

function getCustomerPhone(customer: DirectusRelation<DirectusCustomer>): string {
  if (!isObjectRelation(customer)) {
    return 'Téléphone non renseigné';
  }

  return customer.phone ?? 'Téléphone non renseigné';
}

function getCustomerEmail(customer: DirectusRelation<DirectusCustomer>): string {
  if (!isObjectRelation(customer)) {
    return 'Email non renseigné';
  }

  return customer.email ?? 'Email non renseigné';
}

function hasCustomerInformation(
  customer: DirectusRelation<DirectusCustomer>
): boolean {
  if (!isObjectRelation(customer)) {
    return false;
  }

  return Boolean(
    customer.first_name ||
      customer.last_name ||
      customer.phone ||
      customer.email
  );
}

export function mapRepairToListItem(repair: DirectusRepair): RepairListItem {
  const customer = getCustomerFromRepair(repair);

  return {
    id: repair.id,
    customerId: getRelationId(customer),
    documentNumber: repair.document_number ?? 'Document non renseigné',

    customerName: getCustomerName(customer),
    vehicleLabel: getVehicleLabel(repair.vehicle_id ?? null),
    vehicleModel: getVehicleModel(repair.vehicle_id ?? null),
    registrationNumber: getRegistrationNumber(repair.vehicle_id ?? null),

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
      'Type de service non renseigné'
    ),

    workshopName: getRelationName<DirectusWorkshop>(
      repair.workshop_id ?? null,
      'Atelier non renseigné'
    ),

    entryMileage: formatMileage(repair.entry_mileage),
    receptionistName:
      repair.receptionist_name ?? 'Réceptionniste non renseigné',
  };
}

export function mapRepairsToListItems(
  repairs: DirectusRepair[]
): RepairListItem[] {
  return repairs.map(mapRepairToListItem);
}

export function mapRepairToDetailItem(
  repair: DirectusRepair
): RepairDetailItem {
  const listItem = mapRepairToListItem(repair);
  const customer = getCustomerFromRepair(repair);
  const vehicle = getVehicleFromRepair(repair);

  return {
    ...listItem,
    customerPhone: getCustomerPhone(customer),
    customerEmail: getCustomerEmail(customer),
    hasCustomerInformation: hasCustomerInformation(customer),
    vehicleVin: vehicle?.vin ?? 'VIN non renseigné',
    vehicleYear: formatYear(vehicle?.year),
    vehicleMileage: formatMileage(vehicle?.mileage),
  };
}
