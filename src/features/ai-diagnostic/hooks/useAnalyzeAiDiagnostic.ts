import { useMutation } from '@tanstack/react-query';

import {
  analyzeAiDiagnostic,
  type AiDiagnosticResult,
  type AnalyzeAiDiagnosticInput,
} from '@/core/api/ai-diagnostics.api';

export function useAnalyzeAiDiagnostic() {
  return useMutation<AiDiagnosticResult, Error, AnalyzeAiDiagnosticInput>({
    mutationFn: analyzeAiDiagnostic,
  });
}
