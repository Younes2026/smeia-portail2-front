import { httpClient } from '@/core/api/http-client';

export type DictionaryItem = {
  id: number;
  name: string;
  qualification_code?: string | null;
};

export type Workshop = {
  id: number;
  name: string;
  workshop_type: string | null;
  showroom_id: number | null;
  opening_time: string | null;
  closing_time: string | null;
};

export type Showroom = {
  id: number;
  name: string;
};

export const DICTIONARY_STALE_TIME = 1000 * 60 * 60 * 24;

export const dictionariesApi = {
  getBrands: () => {
    return httpClient.get<DictionaryItem[]>('/items/brands');
  },

  getStatuses: () => {
    return httpClient.get<DictionaryItem[]>('/items/statuses');
  },

  getServiceTypes: () => {
    return httpClient.get<DictionaryItem[]>('/items/service_types');
  },

  getWorkshops: () => {
    return httpClient.get<Workshop[]>('/items/workshops');
  },

  getShowrooms: () => {
    return httpClient.get<Showroom[]>('/items/showrooms');
  },
};
