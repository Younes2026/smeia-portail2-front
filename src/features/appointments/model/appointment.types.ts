export type AppointmentListItem = {
  id: number | string;
  vehicleId: number | string | null;
  serviceTypeId: number | string | null;
  workshopId: number | string | null;
  vehicle: string;
  registrationNumber: string;
  serviceType: string;
  workshop: string;
  requestedDate: string;
  requestedDateValue: string;
  requestedTime: string;
  requestedTimeValue: string;
  status: string;
  comment: string;
  cancellationReason: string | null;
  arrivalConfirmedAt: string | null;
};
