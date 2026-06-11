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
  const setSession = useAuthStore((state) => state.setSession);

  const mutation = useMutation<AuthSession, Error, LoginCredentials>({
    mutationFn: ({ email, password }) =>
      authApi.loginWithEmail(email.trim(), password),
    onSuccess: (session) => {
      setSession(session);
    },
  });

  return {
    ...mutation,
    errorMessage: mutation.error ? getLoginErrorMessage(mutation.error) : null,
  };
}
