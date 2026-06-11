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
};

export type DirectusBrand = {
  id: number;
  name: string;
};

export type DirectusStatus = {
  id: number;
  name: string;
};

export type DirectusServiceType = {
  id: number;
  name: string;
};

export type DirectusWorkshop = {
  id: number;
  name: string;
  workshop_type?: string | null;
};

export type DirectusRepair = {
  id: number;

  document_number?: string | null;
  entry_mileage?: number | null;
  receptionist_name?: string | null;

  vehicle_id?: DirectusRelation<DirectusVehicle>;
  customer_id?: DirectusRelation<DirectusCustomer>;
  brand_id?: DirectusRelation<DirectusBrand>;
  status_id?: DirectusRelation<DirectusStatus>;
  service_type_id?: DirectusRelation<DirectusServiceType>;
  workshop_id?: DirectusRelation<DirectusWorkshop>;

  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type RepairListItem = {
  id: number;
  documentNumber: string;
  customerName: string;
  vehicleLabel: string;
  brandName: string;
  statusName: string;
  serviceTypeName: string;
  workshopName: string;
  entryMileage: string;
  receptionistName: string;
};