export type DirectusRelation<T> = T | number | null;

export type DirectusVehicleBrand = {
  id: number;
  name?: string | null;
};

export type DirectusVehicleCustomer = {
  id: number;
};

export type DirectusVehicle = {
  id: number;
  model?: string | null;
  registration_number?: string | null;
  year?: number | null;
  mileage?: number | null;
  vin?: string | null;
  brand_id?: DirectusRelation<DirectusVehicleBrand>;
  customer_id?: DirectusRelation<DirectusVehicleCustomer>;
};

export type VehicleListItem = {
  id: number;
  brandName: string;
  model: string;
  registrationNumber: string;
  year: string;
  mileage: string;
  vin: string;
};

export type VehicleRepairListItem = {
  id: number;
  documentNumber: string;
  statusName: string;
  serviceTypeName: string;
  workshopName: string;
  entryDate: string;
  finalCost: string;
};
