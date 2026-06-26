import { env } from '@/core/config/env';
import { queryClient } from '@/core/query/query-client';
import { useAuthStore } from '@/store/auth.store';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
};

type DirectusSuccessResponse<T> = {
  data: T;
};

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function buildUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  return `${env.directusUrl}${normalizedEndpoint}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getDirectusErrorMessage(payload: unknown, status: number): string {
  const fallback = `Erreur API Directus (${status})`;

  if (!isRecord(payload)) {
    return fallback;
  }

  const errors = payload.errors;

  if (Array.isArray(errors)) {
    const firstMessage = errors.find(
      (error): error is { message: string } =>
        isRecord(error) && typeof error.message === 'string'
    )?.message;

    return firstMessage ?? fallback;
  }

  return typeof payload.message === 'string' ? payload.message : fallback;
}

function createHeaders(body: unknown, headers?: HeadersInit): Headers {
  const { accessToken } = useAuthStore.getState();
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json');
  }

  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  return requestHeaders;
}

function readDirectusData<T>(payload: unknown): T {
  if (!isRecord(payload) || !('data' in payload)) {
    throw new HttpError(
      'Reponse Directus invalide : champ data manquant.',
      500
    );
  }

  return (payload as DirectusSuccessResponse<T>).data;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const body =
    options.body !== undefined ? JSON.stringify(options.body) : undefined;

  const response = await fetch(buildUrl(endpoint), {
    method: options.method ?? 'GET',
    headers: createHeaders(options.body, options.headers),
    body,
  });

  if (!response.ok) {
    const errorPayload = await parseJson(response);

    if ([401, 403].includes(response.status)) {
      useAuthStore.getState().clearSession();
      queryClient.clear();
    }

    throw new HttpError(
      getDirectusErrorMessage(errorPayload, response.status),
      response.status
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parseJson(response);

  return readDirectusData<T>(payload);
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
