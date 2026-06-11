import { create } from 'zustand';

type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  setAuth: (payload: {
    accessToken: string;
    refreshToken?: string | null;
    user?: AuthUser | null;
  }) => void;

  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: ({ accessToken, refreshToken = null, user = null }) => {
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
    });
  },

  clearAuth: () => {
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));