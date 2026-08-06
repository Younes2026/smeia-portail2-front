import { useQuery } from '@tanstack/react-query';

import {
  aiDiagnosticsApi,
  type DirectusAiDiagnostic,
} from '@/core/api/ai-diagnostics.api';

export const savAiDiagnosticsQueryKeys = {
  all: ['sav', 'ai-diagnostics'] as const,
};

export function useSavAiDiagnostics() {
  return useQuery<DirectusAiDiagnostic[], Error>({
    queryKey: savAiDiagnosticsQueryKeys.all,
    queryFn: aiDiagnosticsApi.getAiDiagnostics,
    refetchOnWindowFocus: true,
  });
}
