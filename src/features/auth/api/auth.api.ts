import { httpClient } from '@/core/api/http-client';
import type { AuthCustomer, AuthSession, AuthUser } from '@/store/auth.store';

type DirectusLoginResponse = {
  access_token: string;
  refresh_token?: string | null;
  expires?: number | null;
};

type LoginBody = {
  email: string;
  password: string;
  mode: 'json';
};

type LogoutBody = {
  refresh_token: string;
  mode: 'json';
};

type DirectusUserResponse = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

type DirectusCustomerResponse = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export const authApi = {
  loginWithEmail: async (
    email: string,
    password: string
  ): Promise<AuthSession> => {
    const response = await httpClient.post<DirectusLoginResponse>(
      '/auth/login',
      {
        email,
        password,
        mode: 'json',
      } satisfies LoginBody
    );

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? null,
      expires: response.expires ?? null,
      user: null,
      customer: null,
    };
  },

  getMe: async (): Promise<AuthUser> => {
    const response = await httpClient.get<DirectusUserResponse>('/users/me');

    return {
      id: response.id,
      email: response.email,
      firstName: response.first_name ?? null,
      lastName: response.last_name ?? null,
    };
  },

  getCurrentCustomer: async (
    directusUserId: string
  ): Promise<AuthCustomer | null> => {
    const customers = await httpClient.get<DirectusCustomerResponse[]>(
      `/items/customers?filter[directus_user_id][_eq]=${directusUserId}`
    );

    const customer = customers[0];

    if (!customer) {
      return null;
    }

    return {
      id: customer.id,
      firstName: customer.first_name ?? null,
      lastName: customer.last_name ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
    };
  },

  logout: async (refreshToken?: string | null): Promise<void> => {
    if (!refreshToken) {
      return;
    }

    await httpClient.post<void>('/auth/logout', {
      refresh_token: refreshToken,
      mode: 'json',
    } satisfies LogoutBody);
  },
};