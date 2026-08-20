import { useMutation } from '@tanstack/react-query';

import { isDirectusCrcRole } from '@/core/auth/directus-roles';
import { HttpError } from '@/core/api/http-client';
import { authApi } from '@/features/auth/api/auth.api';
import type {
  AuthCustomer,
  AuthSavAgent,
  AuthSession,
  AuthTechnician,
} from '@/store/auth.store';
import { useAuthStore } from '@/store/auth.store';

type LoginCredentials = {
  email: string;
  password: string;
};

class AuthProfileLinkError extends Error {
  constructor() {
    super(
      'Compte non lié à un profil client, SAV ou technicien. Veuillez contacter l’administrateur.'
    );
    this.name = 'AuthProfileLinkError';
  }
}

function getLoginErrorMessage(error: Error): string {
  if (error instanceof HttpError && [400, 401, 403].includes(error.status)) {
    return 'Email ou mot de passe incorrect.';
  }

  if (error instanceof AuthProfileLinkError) {
    return error.message;
  }

  return 'Connexion impossible pour le moment. Veuillez reessayer.';
}

function isProfileLookupAccessError(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    [400, 401, 403, 404].includes(error.status)
  );
}

async function getCustomerOrNull(
  userId: string,
  loginSession: AuthSession
): Promise<AuthCustomer | null> {
  try {
    return await authApi.getCurrentCustomer(userId);
  } catch (error) {
    if (isProfileLookupAccessError(error)) {
      useAuthStore.getState().setSession(loginSession);

      return null;
    }

    throw error;
  }
}

async function getSavAgentOrNull(
  userId: string,
  loginSession: AuthSession
): Promise<AuthSavAgent | null> {
  try {
    return await authApi.getCurrentSavAgent(userId);
  } catch (error) {
    if (isProfileLookupAccessError(error)) {
      useAuthStore.getState().setSession(loginSession);

      return null;
    }

    throw error;
  }
}

async function getTechnicianOrNull(
  userId: string,
  loginSession: AuthSession
): Promise<AuthTechnician | null> {
  try {
    return await authApi.getCurrentTechnician(userId);
  } catch (error) {
    if (isProfileLookupAccessError(error)) {
      useAuthStore.getState().setSession(loginSession);

      return null;
    }

    throw error;
  }
}

export function useLogin() {
  const mutation = useMutation<AuthSession, Error, LoginCredentials>({
    mutationFn: async ({ email, password }) => {
      const loginSession = await authApi.loginWithEmail(email.trim(), password);

      useAuthStore.getState().setSession(loginSession);

      try {
        const user = await authApi.getMe();
        const sessionWithUser = {
          ...loginSession,
          user,
        };

        if (isDirectusCrcRole(user.role)) {
          const crcSession = {
            ...sessionWithUser,
            customer: null,
            savAgent: null,
            technician: null,
          };

          useAuthStore.getState().setSession(crcSession);

          return crcSession;
        }

        const customer = await getCustomerOrNull(user.id, sessionWithUser);

        if (customer) {
          const session = {
            ...sessionWithUser,
            customer,
            savAgent: null,
            technician: null,
          };

          useAuthStore.getState().setSession(session);

          return session;
        }

        const savAgent = await getSavAgentOrNull(user.id, sessionWithUser);

        if (savAgent) {
          const session = {
            ...sessionWithUser,
            customer: null,
            savAgent,
            technician: null,
          };

          useAuthStore.getState().setSession(session);

          return session;
        }

        const technician = await getTechnicianOrNull(user.id, sessionWithUser);

        if (!technician) {
          throw new AuthProfileLinkError();
        }

        const session = {
          ...sessionWithUser,
          customer: null,
          savAgent: null,
          technician,
        };

        useAuthStore.getState().setSession(session);

        return session;
      } catch (error) {
        useAuthStore.getState().clearSession();

        throw error;
      }
    },
  });

  return {
    ...mutation,
    errorMessage: mutation.error ? getLoginErrorMessage(mutation.error) : null,
  };
}
