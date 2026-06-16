import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { localStorageStateStorage } from '@/core/storage/local-storage';

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type AuthCustomer = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expires: number | null;
  user?: AuthUser | null;
  customer?: AuthCustomer | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  expires: number | null;
  user: AuthUser | null;
  customer: AuthCustomer | null;
  isAuthenticated: boolean;

  setSession: (session: AuthSession) => void;
  clearSession: () => void;
};

const emptySession = {
  accessToken: null,
  refreshToken: null,
  expires: null,
  user: null,
  customer: null,
  isAuthenticated: false,
} satisfies Pick<
  AuthState,
  | 'accessToken'
  | 'refreshToken'
  | 'expires'
  | 'user'
  | 'customer'
  | 'isAuthenticated'
>;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...emptySession,

      setSession: ({
        accessToken,
        refreshToken,
        expires,
        user = null,
        customer = null,
      }) => {
        set({
          accessToken,
          refreshToken,
          expires,
          user,
          customer,
          isAuthenticated: Boolean(accessToken),
        });
      },

      clearSession: () => {
        set(emptySession);
      },
    }),
    {
      name: 'smeia-auth-session',
      storage: createJSONStorage(() => localStorageStateStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expires: state.expires,
        user: state.user,
        customer: state.customer,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);