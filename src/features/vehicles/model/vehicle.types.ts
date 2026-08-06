export type DirectusRelation<T> = T | number | string | null;

export type DirectusVehicleBrand = {
  id: number;
  label?: string | null;
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
  customer_id?: DirectusVehicleCustomer | number | null;
};

export type VehicleListItem = {
  id: number;
  brandId: number | string | null;
  brandName: string;
  model: string;
  registrationNumber: string;
  year: string;
  yearValue: number | null;
  mileage: string;
  mileageValue: number | null;
  vin: string;
  vinValue: string | null;
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
