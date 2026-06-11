import { useMutation } from '@tanstack/react-query';

import { authApi } from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/store/auth.store';

export function useLogout() {
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation<void, Error, void>({
    mutationFn: () => authApi.logout(refreshToken),
    onSettled: () => {
      clearSession();
    },
  });
}
