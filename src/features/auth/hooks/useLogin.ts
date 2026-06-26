import { useMutation } from '@tanstack/react-query';

import { HttpError } from '@/core/api/http-client';
import { authApi } from '@/features/auth/api/auth.api';
import type { AuthSession } from '@/store/auth.store';
import { useAuthStore } from '@/store/auth.store';

type LoginCredentials = {
  email: string;
  password: string;
};

function getLoginErrorMessage(error: Error): string {
  if (error instanceof HttpError && [400, 401, 403].includes(error.status)) {
    return 'Email ou mot de passe incorrect.';
  }

  return 'Connexion impossible pour le moment. Veuillez reessayer.';
}

export function useLogin() {
  const mutation = useMutation<AuthSession, Error, LoginCredentials>({
    mutationFn: async ({ email, password }) => {
      const loginSession = await authApi.loginWithEmail(email.trim(), password);

      useAuthStore.getState().setSession(loginSession);

      try {
        const user = await authApi.getMe();
        const customer = await authApi.getCurrentCustomer(user.id);

        if (!customer) {
          throw new Error('Aucun compte client SMEIA associé à cet utilisateur.');
        }

        const session = {
          ...loginSession,
          user,
          customer,
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
