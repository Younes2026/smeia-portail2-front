import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isDirectusCrcRole } from '@/core/auth/directus-roles';
import { localStorageStateStorage } from '@/core/storage/local-storage';

export type AuthUserRole = {
  id: string | null;
  name: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: AuthUserRole | null;
};

export type AuthCustomer = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type AuthSavAgent = {
  id: number;
  userId: string;
  active: boolean;
  workshopId?: number | null;
  workshopName?: string | null;
};

export type AuthTechnician = {
  id: number;
  userId: string;
  active: boolean;
  workshopId?: number | null;
  workshopName?: string | null;
  fullName?: string | null;
  specialty?: string | null;
  dailyHours?: number | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expires: number | null;
  user?: AuthUser | null;
  customer?: AuthCustomer | null;
  savAgent?: AuthSavAgent | null;
  technician?: AuthTechnician | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  expires: number | null;
  user: AuthUser | null;
  customer: AuthCustomer | null;
  savAgent: AuthSavAgent | null;
  technician: AuthTechnician | null;
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
  savAgent: null,
  technician: null,
  isAuthenticated: false,
} satisfies Pick<
  AuthState,
  | 'accessToken'
  | 'refreshToken'
  | 'expires'
  | 'user'
  | 'customer'
  | 'savAgent'
  | 'technician'
  | 'isAuthenticated'
>;

function hasProtectedSession(
  accessToken: string | null,
  user: AuthUser | null,
  customer: AuthCustomer | null,
  savAgent: AuthSavAgent | null,
  technician: AuthTechnician | null
): boolean {
  return Boolean(
    accessToken &&
      (customer || savAgent || technician || isDirectusCrcRole(user?.role))
  );
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
        savAgent = null,
        technician = null,
      }) => {
        set({
          accessToken,
          refreshToken,
          expires,
          user,
          customer,
          savAgent,
          technician,
          isAuthenticated: hasProtectedSession(
            accessToken,
            user,
            customer,
            savAgent,
            technician
          ),
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

        if (
          !authState.accessToken ||
          (!authState.customer &&
            !authState.savAgent &&
            !authState.technician &&
            !isDirectusCrcRole(authState.user?.role))
        ) {
          authState.clearSession();
        } else {
          authState.setSession({
            accessToken: authState.accessToken,
            refreshToken: authState.refreshToken,
            expires: authState.expires,
            user: authState.user,
            customer: authState.customer,
            savAgent: authState.savAgent,
            technician: authState.technician,
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
        savAgent: state.savAgent,
        technician: state.technician,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
