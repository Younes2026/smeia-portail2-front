import { useMutation } from '@tanstack/react-query';

import {
  aiDiagnosticsApi,
  type CreateAiDiagnosticInput,
  type DirectusAiDiagnostic,
} from '@/core/api/ai-diagnostics.api';

export function useCreateAiDiagnostic() {
  return useMutation<DirectusAiDiagnostic, Error, CreateAiDiagnosticInput>({
    mutationFn: aiDiagnosticsApi.createAiDiagnostic,
  });
}
