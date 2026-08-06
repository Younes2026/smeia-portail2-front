import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 401
        ) {
          return false;
        }

        return failureCount < 1;
      },
    },
  },
});
