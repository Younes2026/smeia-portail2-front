import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { localStorageStateStorage } from '@/core/storage/local-storage';

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expires: number | null;
  user?: AuthUser | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  expires: number | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  setSession: (session: AuthSession) => void;
  clearSession: () => void;
};

const emptySession = {
  accessToken: null,
  refreshToken: null,
  expires: null,
  user: null,
  isAuthenticated: false,
} satisfies Pick<
  AuthState,
  'accessToken' | 'refreshToken' | 'expires' | 'user' | 'isAuthenticated'
>;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...emptySession,

      setSession: ({ accessToken, refreshToken, expires, user = null }) => {
        set({
          accessToken,
          refreshToken,
          expires,
          user,
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
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
