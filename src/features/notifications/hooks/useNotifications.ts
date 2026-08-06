import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  notificationsApi,
  type DirectusNotification,
} from '@/core/api/notifications.api';
import { useAuthStore } from '@/store/auth.store';

export const notificationsQueryKeys = {
  all: (customerId: number | null) =>
    ['notifications', 'customer', customerId] as const,
};

export function useNotifications() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);

  return useQuery<DirectusNotification[], Error>({
    queryKey: notificationsQueryKeys.all(customerId),
    queryFn: async () => {
      if (customerId === null) {
        return [];
      }

      return notificationsApi.getNotifications(customerId);
    },
    enabled: customerId !== null,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationAsRead() {
  const customerId = useAuthStore((state) => state.customer?.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<DirectusNotification, Error, number | string>({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: notificationsQueryKeys.all(customerId),
      });
    },
  });
}
