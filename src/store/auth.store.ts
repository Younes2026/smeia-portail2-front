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
  hasHydrated: boolean;

  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
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

function hasProtectedSession(
  accessToken: string | null,
  customer: AuthCustomer | null
): boolean {
  return Boolean(accessToken && customer);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...emptySession,
      hasHydrated: false,

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
          isAuthenticated: hasProtectedSession(accessToken, customer),
        });
      },

      clearSession: () => {
        set(emptySession);
      },

      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },
    }),
    {
      name: 'smeia-auth-session',
      storage: createJSONStorage(() => localStorageStateStorage),
      onRehydrateStorage: (state) => (hydratedState) => {
        const authState = hydratedState ?? state;

        if (!authState.accessToken || !authState.customer) {
          authState.clearSession();
        } else {
          authState.setSession({
            accessToken: authState.accessToken,
            refreshToken: authState.refreshToken,
            expires: authState.expires,
            user: authState.user,
            customer: authState.customer,
          });
        }

        authState.setHasHydrated(true);
      },
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
