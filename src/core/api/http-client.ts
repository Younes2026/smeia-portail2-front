import { env } from '@/core/config/env';
import { useAuthStore } from '@/store/auth.store';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
};

type DirectusResponse<T> = {
  data: T;
};

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${env.directusUrl}${endpoint}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new HttpError(
      `Erreur API Directus : ${response.status}`,
      response.status
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  const json = (await response.json()) as DirectusResponse<T>;

  return json.data;
}

export const httpClient = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body,
    }),

  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, {
      method: 'DELETE',
    }),
};