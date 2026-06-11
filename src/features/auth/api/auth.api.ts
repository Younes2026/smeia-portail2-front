import { httpClient } from '@/core/api/http-client';
import type { AuthSession } from '@/store/auth.store';

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
