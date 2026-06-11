import { useQuery } from '@tanstack/react-query';

import {
  dictionariesApi,
  DICTIONARY_STALE_TIME,
} from '@/core/api/dictionaries.api';

export const dictionaryQueryKeys = {
  brands: ['dictionary', 'brands'] as const,
  statuses: ['dictionary', 'statuses'] as const,
  serviceTypes: ['dictionary', 'service-types'] as const,
  workshops: ['dictionary', 'workshops'] as const,
  showrooms: ['dictionary', 'showrooms'] as const,
};

export function useBrands() {
  return useQuery({
    queryKey: dictionaryQueryKeys.brands,
    queryFn: dictionariesApi.getBrands,
    staleTime: DICTIONARY_STALE_TIME,
  });
}

export function useStatuses() {
  return useQuery({
    queryKey: dictionaryQueryKeys.statuses,
    queryFn: dictionariesApi.getStatuses,
    staleTime: DICTIONARY_STALE_TIME,
  });
}

export function useServiceTypes() {
  return useQuery({
    queryKey: dictionaryQueryKeys.serviceTypes,
    queryFn: dictionariesApi.getServiceTypes,
    staleTime: DICTIONARY_STALE_TIME,
  });
}

export function useWorkshops() {
  return useQuery({
    queryKey: dictionaryQueryKeys.workshops,
    queryFn: dictionariesApi.getWorkshops,
    staleTime: DICTIONARY_STALE_TIME,
  });
}

export function useShowrooms() {
  return useQuery({
    queryKey: dictionaryQueryKeys.showrooms,
    queryFn: dictionariesApi.getShowrooms,
    staleTime: DICTIONARY_STALE_TIME,
  });
}