import type {
  DirectusBrand,
  DirectusCustomer,
  DirectusRelation,
  DirectusRepair,
  DirectusServiceType,
  DirectusShowroom,
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
  relation: DirectusRelation<T> | string
): number | null {
  if (typeof relation === 'number') {
    return relation;
  }

  if (typeof relation === 'string') {
    const numericId = Number(relation);

    return Number.isFinite(numericId) ? numericId : null;
  }

  if (isObjectRelation(relation)) {
    return relation.id;
  }

  return null;
}

function getAppointmentId(
  relation: DirectusRepair['appointment_id']
): number | string | null {
  if (typeof relation === 'number' || typeof relation === 'string') {
    return relation;
  }

  return relation?.id ?? null;
}

function getFlexibleRelationId(
  relation: unknown
): number | string | null {
  if (typeof relation === 'number' || typeof relation === 'string') {
    return relation;
  }

  if (typeof relation !== 'object' || relation === null || !('id' in relation)) {
    return null;
  }

  const id = relation.id;

  return typeof id === 'number' || typeof id === 'string' ? id : null;
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
  if (typeof vehicle === 'number') {
    return `Véhicule #${vehicle}`;
  }

  if (!isObjectRelation(vehicle)) {
    return 'Véhicule non renseigné';
  }

  const model = vehicle.model?.trim() || null;
  const registration = vehicle.registration_number?.trim() || null;

  if (model && registration) {
    return `${model} - ${registration}`;
  }

  return model ?? registration ?? `Véhicule #${vehicle.id}`;
}

function getVehicleModel(
  vehicle: DirectusRelation<DirectusVehicle>
): string {
  if (typeof vehicle === 'number') {
    return `Véhicule #${vehicle}`;
  }

  if (!isObjectRelation(vehicle)) {
    return 'Véhicule non renseigné';
  }

  return vehicle.model ?? `Véhicule #${vehicle.id}`;
}

function getRegistrationNumber(
  vehicle: DirectusRelation<DirectusVehicle>
): string {
  if (!isObjectRelation(vehicle)) {
    return 'Immatriculation non renseignée';
  }

  return vehicle.registration_number ?? 'Immatriculation non renseignée';
}

function getRelationName<
  T extends { id: number; label?: string | null; name?: string | null },
>(
  relation: DirectusRelation<T>,
  relationLabel: string,
  fallback: string
): string {
  if (typeof relation === 'number') {
    return `${relationLabel} #${relation}`;
  }

  if (!isObjectRelation(relation)) {
    return fallback;
  }

  return (
    relation.name?.trim() ||
    relation.label?.trim() ||
    `${relationLabel} #${relation.id}`
  );
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

function getShowroomFromRepair(
  repair: DirectusRepair
): DirectusRelation<DirectusShowroom> {
  const workshop = repair.workshop_id ?? null;

  if (!isObjectRelation(workshop)) {
    return null;
  }

  return workshop.showroom_id ?? null;
}

function getShowroomName(
  showroom: DirectusRelation<DirectusShowroom>
): string | null {
  if (typeof showroom === 'number') {
    return `Showroom #${showroom}`;
  }

  if (!isObjectRelation(showroom)) {
    return null;
  }

  return showroom.name?.trim() || `Showroom #${showroom.id}`;
}

function getOptionalText(value?: string | null): string | null {
  return value?.trim() || null;
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
  const showroom = getShowroomFromRepair(repair);

  return {
    id: repair.id,
    appointmentId: getAppointmentId(repair.appointment_id ?? null),
    customerId: getRelationId(customer),
    vehicleId: getRelationId(repair.vehicle_id ?? null),
    statusId: getFlexibleRelationId(repair.status_id),
    serviceTypeId: getFlexibleRelationId(repair.service_type_id),
    workshopId: getFlexibleRelationId(repair.workshop_id),
    showroomId: getRelationId(showroom),
    realExitDate: repair.real_exit_date ?? null,
    entryDate: formatDate(repair.entry_date),
    entryDateValue: repair.entry_date ?? null,
    realDiagnosis: repair.real_diagnosis?.trim() || null,
    workDone: repair.work_done?.trim() || null,
    description: repair.description?.trim() || null,
    note: repair.note?.trim() || null,
    solutionDescription: repair.solution_description?.trim() || null,
    technicianRecommendations:
      repair.technician_recommendations?.trim() || null,
    entryMileageValue: repair.entry_mileage ?? null,
    finalCost: repair.final_cost ?? null,
    documentNumber: repair.document_number ?? `Dossier #${repair.id}`,

    customerName: getCustomerName(customer),
    vehicleLabel: getVehicleLabel(repair.vehicle_id ?? null),
    vehicleModel: getVehicleModel(repair.vehicle_id ?? null),
    registrationNumber: getRegistrationNumber(repair.vehicle_id ?? null),

    brandName: getRelationName<DirectusBrand>(
      getBrandFromRepair(repair),
      'Marque',
      'Marque non renseignée'
    ),

    statusName: getRelationName<DirectusStatus>(
      repair.status_id ?? null,
      'Statut',
      'Statut non renseigné'
    ),

    serviceTypeName: getRelationName<DirectusServiceType>(
      repair.service_type_id ?? null,
      'Service',
      'Service non renseigné'
    ),

    workshopName: getRelationName<DirectusWorkshop>(
      repair.workshop_id ?? null,
      'Atelier',
      'Atelier non renseigné'
    ),

    showroomName: getShowroomName(showroom),
    showroomAddress: isObjectRelation(showroom)
      ? getOptionalText(showroom.address)
      : null,
    showroomCity: isObjectRelation(showroom)
      ? getOptionalText(showroom.city)
      : null,
    showroomPhone: isObjectRelation(showroom)
      ? getOptionalText(showroom.phone)
      : null,

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
