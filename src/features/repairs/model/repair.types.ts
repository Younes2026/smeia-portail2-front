export type DirectusRelation<T> = T | number | null;

export type DirectusCustomer = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type DirectusVehicle = {
  id: number;
  model?: string | null;
  registration_number?: string | null;
  year?: number | null;
  mileage?: number | null;
  vin?: string | null;
  customer_id?: DirectusRelation<DirectusCustomer>;
  brand_id?: DirectusRelation<DirectusBrand>;
};

export type DirectusBrand = {
  id: number;
  name: string;
  label?: string | null;
};

export type DirectusStatus = {
  id: number;
  name: string;
  label?: string | null;
};

export type DirectusServiceType = {
  id: number;
  name: string;
  label?: string | null;
};

export type DirectusWorkshop = {
  id: number;
  name: string;
  label?: string | null;
  workshop_type?: string | null;
};

export type DirectusResource = {
  id: number;
  directus_user_id?: string | { id: string } | null;
  workshop_id?: DirectusRelation<DirectusWorkshop>;
  full_name?: string | null;
  specialty?: string | null;
  daily_hours?: number | null;
  active?: boolean | null;
};

export type DirectusRepair = {
  id: number;

  appointment_id?: DirectusRelation<{ id: number | string }>;
  document_number?: string | null;
  entry_mileage?: number | null;
  receptionist_name?: string | null;

  vehicle_id?: DirectusRelation<DirectusVehicle>;
  customer_id?: DirectusRelation<DirectusCustomer>;
  brand_id?: DirectusRelation<DirectusBrand>;
  status_id?: DirectusRelation<DirectusStatus>;
  service_type_id?: DirectusRelation<DirectusServiceType>;
  workshop_id?: DirectusRelation<DirectusWorkshop>;
  resource_id?: DirectusRelation<DirectusResource>;

  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string | null;
  date_created?: string | null;
  entry_date?: string | null;
  real_exit_date?: string | null;
  appointment_date?: string | null;
  planned_exit_date?: string | null;
  description?: string | null;
  note?: string | null;
  real_diagnosis?: string | null;
  work_done?: string | null;
  solution_description?: string | null;
  technician_recommendations?: string | null;
  type?: string | null;
  final_cost?: number | null;
  schedule_id?: number | string | null;
};

export type RepairListItem = {
  id: number;
  appointmentId: number | string | null;
  customerId: number | null;
  vehicleId: number | null;
  statusId: number | string | null;
  serviceTypeId: number | string | null;
  workshopId: number | string | null;
  realExitDate: string | null;
  entryDate: string;
  entryDateValue: string | null;
  realDiagnosis: string | null;
  workDone: string | null;
  description: string | null;
  note: string | null;
  solutionDescription: string | null;
  technicianRecommendations: string | null;
  entryMileageValue: number | null;
  finalCost: number | null;
  documentNumber: string;
  customerName: string;
  vehicleLabel: string;
  vehicleModel: string;
  registrationNumber: string;
  brandName: string;
  statusName: string;
  serviceTypeName: string;
  workshopName: string;
  entryMileage: string;
  receptionistName: string;
};

export type RepairDetailItem = RepairListItem & {
  customerPhone: string;
  customerEmail: string;
  hasCustomerInformation: boolean;
  vehicleVin: string;
  vehicleYear: string;
  vehicleMileage: string;
};
