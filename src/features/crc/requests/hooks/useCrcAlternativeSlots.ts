import { useQuery } from '@tanstack/react-query';

import {
  searchAiAppointmentCalendar,
  searchAiAppointmentAvailability,
  type AiBookingAvailabilityOption,
  type AiBookingAvailabilityResult,
  type AiBookingCalendarResult,
  type AiBookingPreferredPeriod,
} from '@/core/api/ai-booking.api';
import type { AiBookingWorkshopType } from '@/core/api/ai-diagnostics.api';
import {
  isCrcAlternativeSlotsEmptyError,
  parseCrcBookableServiceTypeId,
  selectCrcAlternativeDaySlots,
  selectCrcAlternativeSlots,
} from '@/features/crc/requests/model/crc-alternative-slots';

export type CrcAlternativeSlotsQuery = {
  appointmentId: number;
  vehicleId: number;
  serviceTypeId: number;
  showroomId: number;
  workshopId: number;
  workshopType: AiBookingWorkshopType;
  requestedDate: string;
  requestedTime: string;
};

export const crcAlternativeSlotsQueryKeys = {
  context: (query: CrcAlternativeSlotsQuery) =>
    [
      query.appointmentId,
      query.vehicleId,
      query.serviceTypeId,
      query.showroomId,
      query.workshopId,
      query.workshopType,
      query.requestedDate,
      query.requestedTime,
    ] as const,
  detail: (query: CrcAlternativeSlotsQuery) =>
    [
      'crc',
      'appointments',
      ...crcAlternativeSlotsQueryKeys.context(query),
      'alternative-slots',
    ] as const,
  calendar: (query: CrcAlternativeSlotsQuery) =>
    [
      'crc',
      'appointments',
      ...crcAlternativeSlotsQueryKeys.context(query),
      'availability-calendar',
    ] as const,
  daySlots: (
    query: CrcAlternativeSlotsQuery,
    date: string | null,
    period: AiBookingPreferredPeriod
  ) =>
    [
      'crc',
      'appointments',
      ...crcAlternativeSlotsQueryKeys.context(query),
      'day-slots',
      date,
      period,
    ] as const,
};

function getAvailabilityContext(query: CrcAlternativeSlotsQuery) {
  return {
    vehicle_id: query.vehicleId,
    service_type_id: parseCrcBookableServiceTypeId(query.serviceTypeId),
    showroom_id: query.showroomId,
    workshop_types: [query.workshopType],
  };
}

export function useCrcAlternativeSlots(
  query: CrcAlternativeSlotsQuery,
  enabled: boolean
) {
  return useQuery<AiBookingAvailabilityOption[], Error>({
    queryKey: crcAlternativeSlotsQueryKeys.detail(query),
    queryFn: async () => {
      let availability: AiBookingAvailabilityResult;
      try {
        availability = await searchAiAppointmentAvailability({
          ...getAvailabilityContext(query),
          preferred_date: null,
          preferred_period: 'any',
          result_mode: 'suggestions',
        });
      } catch (error: unknown) {
        if (isCrcAlternativeSlotsEmptyError(error)) {
          return [];
        }
        throw error;
      }

      return selectCrcAlternativeSlots(availability.options, {
        appointmentId: query.appointmentId,
        workshopId: query.workshopId,
        requestedDate: query.requestedDate,
        requestedTime: query.requestedTime,
      });
    },
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCrcAvailabilityCalendar(
  query: CrcAlternativeSlotsQuery,
  enabled: boolean
) {
  return useQuery<AiBookingCalendarResult, Error>({
    queryKey: crcAlternativeSlotsQueryKeys.calendar(query),
    queryFn: () =>
      searchAiAppointmentCalendar({
        ...getAvailabilityContext(query),
        preferred_date: null,
        preferred_period: 'any',
        result_mode: 'calendar',
      }),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCrcAlternativeDaySlots(
  query: CrcAlternativeSlotsQuery,
  selectedDate: string | null,
  period: AiBookingPreferredPeriod,
  enabled: boolean
) {
  return useQuery<AiBookingAvailabilityOption[], Error>({
    queryKey: crcAlternativeSlotsQueryKeys.daySlots(
      query,
      selectedDate,
      period
    ),
    queryFn: async () => {
      if (selectedDate === null) {
        return [];
      }

      let availability: AiBookingAvailabilityResult;
      try {
        availability = await searchAiAppointmentAvailability({
          ...getAvailabilityContext(query),
          preferred_date: selectedDate,
          preferred_period: period,
          result_mode: 'day_slots',
        });
      } catch (error: unknown) {
        if (isCrcAlternativeSlotsEmptyError(error)) {
          return [];
        }
        throw error;
      }

      return selectCrcAlternativeDaySlots(
        availability.options,
        {
          appointmentId: query.appointmentId,
          workshopId: query.workshopId,
          requestedDate: query.requestedDate,
          requestedTime: query.requestedTime,
        },
        selectedDate
      );
    },
    enabled: enabled && selectedDate !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
