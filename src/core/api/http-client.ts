import { env } from '@/core/config/env';
import { queryClient } from '@/core/query/query-client';
import { useAuthStore } from '@/store/auth.store';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type HttpDestination = 'directus' | 'aiBackend';

type DestinationOptions = {
  destination?: HttpDestination;
};

type PostOptions = DestinationOptions & {
  headers?: {
    'Idempotency-Key': string;
  };
};

type RequestOptions = DestinationOptions & {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
};

type SuccessResponse<T> = {
  data: T;
};

export class HttpError extends Error {
  status: number;
  code: string | null;
  retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }

  const retryDate = Date.parse(value);

  if (!Number.isFinite(retryDate)) {
    return null;
  }

  return Math.max(0, Math.ceil((retryDate - Date.now()) / 1_000));
}

function buildUrl(
  endpoint: string,
  destination: HttpDestination = 'directus'
): string {
  const normalizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;
  const baseUrl =
    destination === 'aiBackend' ? env.aiBackendUrl : env.directusUrl;

  return `${baseUrl}${normalizedEndpoint}`;
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

type ParsedHttpError = {
  message: string;
  code: string | null;
};

function getDirectusError(
  payload: unknown,
  status: number
): ParsedHttpError {
  const fallback: ParsedHttpError = {
    message: `Erreur API Directus (${status})`,
    code: null,
  };

  if (!isRecord(payload)) {
    return fallback;
  }

  const errors = payload.errors;

  if (Array.isArray(errors)) {
    const firstError = errors.find(
      (error): error is Record<string, unknown> =>
        isRecord(error) && typeof error.message === 'string'
    );

    if (!firstError) {
      return fallback;
    }

    const extensions = firstError.extensions;

    return {
      message: firstError.message as string,
      code:
        isRecord(extensions) && typeof extensions.code === 'string'
          ? extensions.code
          : null,
    };
  }

  return {
    message:
      typeof payload.message === 'string' ? payload.message : fallback.message,
    code: typeof payload.code === 'string' ? payload.code : null,
  };
}

function getAiBackendError(
  payload: unknown,
  status: number
): ParsedHttpError {
  const fallback: ParsedHttpError = {
    message: `AI backend request failed (${status})`,
    code: null,
  };

  if (!isRecord(payload) || !isRecord(payload.error)) {
    return fallback;
  }

  return {
    message:
      typeof payload.error.message === 'string'
        ? payload.error.message
        : fallback.message,
    code:
      typeof payload.error.code === 'string' ? payload.error.code : null,
  };
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

function readResponseData<T>(payload: unknown, destination: HttpDestination): T {
  if (!isRecord(payload) || !('data' in payload)) {
    throw new HttpError(
      destination === 'directus'
        ? 'Reponse Directus invalide : champ data manquant.'
        : 'The AI backend returned an invalid response.',
      500,
      destination === 'directus'
        ? 'INVALID_DIRECTUS_RESPONSE'
        : 'INVALID_AI_BACKEND_RESPONSE'
    );
  }

  return (payload as SuccessResponse<T>).data;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const destination = options.destination ?? 'directus';
  const body =
    options.body !== undefined ? JSON.stringify(options.body) : undefined;

  const response = await fetch(buildUrl(endpoint, destination), {
    method: options.method ?? 'GET',
    headers: createHeaders(options.body, options.headers),
    body,
  });

  if (!response.ok) {
    const errorPayload = await parseJson(response);
    const parsedError =
      destination === 'aiBackend'
        ? getAiBackendError(errorPayload, response.status)
        : getDirectusError(errorPayload, response.status);

    if (response.status === 401) {
      useAuthStore.getState().clearSession();
      queryClient.clear();
    }

    throw new HttpError(
      parsedError.message,
      response.status,
      parsedError.code,
      parseRetryAfter(response.headers.get('Retry-After'))
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parseJson(response);

  return readResponseData<T>(payload, destination);
}

export const httpClient = {
  get: <T>(endpoint: string, options: DestinationOptions = {}) =>
    request<T>(endpoint, options),

  post: <T>(
    endpoint: string,
    body: unknown,
    options: PostOptions = {}
  ) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body,
    }),

  patch: <T>(
    endpoint: string,
    body: unknown,
    options: DestinationOptions = {}
  ) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body,
    }),

  delete: <T>(endpoint: string, options: DestinationOptions = {}) =>
    request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    }),
};
