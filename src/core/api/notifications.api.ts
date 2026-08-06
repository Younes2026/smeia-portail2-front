import { httpClient } from '@/core/api/http-client';
import { getDirectusRelationId } from '@/core/api/directus-relation';

export type DirectusNotification = {
  id: number | string;
  customer_id: number | { id: number } | null;
  appointment_id?: number | string | { id: number | string } | null;
  repair_id?: number | string | { id: number | string } | null;
  title: string;
  message: string;
  type: string;
  read_at?: string | null;
  created_at?: string | null;
};

export type CreateNotificationInput = {
  customerId: number;
  appointmentId?: number | string;
  repairId?: number | string;
  title: string;
  message: string;
  type: string;
};

const NOTIFICATION_FIELDS = [
  'id',
  'customer_id',
  'appointment_id',
  'repair_id',
  'title',
  'message',
  'type',
  'read_at',
  'created_at',
] as const;

function buildNotificationsEndpoint(customerId: number): string {
  const searchParams = new URLSearchParams({
    fields: NOTIFICATION_FIELDS.join(','),
    sort: '-created_at',
  });

  searchParams.set('filter[customer_id][_eq]', String(customerId));

  return `/items/notifications?${searchParams.toString()}`;
}

export const notificationsApi = {
  getNotifications: async (customerId: number) => {
    const notifications = await httpClient.get<DirectusNotification[]>(
      buildNotificationsEndpoint(customerId)
    );

    return notifications.filter(
      (notification) =>
        getDirectusRelationId(notification.customer_id) === customerId
    );
  },

  createNotification: ({
    appointmentId,
    customerId,
    message,
    repairId,
    title,
    type,
  }: CreateNotificationInput) => {
    return httpClient.post<DirectusNotification>('/items/notifications', {
      customer_id: customerId,
      appointment_id: appointmentId,
      repair_id: repairId,
      title,
      message,
      type,
    });
  },

  markAsRead: (notificationId: number | string) => {
    return httpClient.patch<DirectusNotification>(
      `/items/notifications/${encodeURIComponent(String(notificationId))}`,
      {
        read_at: new Date().toISOString(),
      }
    );
  },
};
