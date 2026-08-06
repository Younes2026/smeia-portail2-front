import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AiDiagnosticScreen } from '@/features/ai-diagnostic/ui/AiDiagnosticScreen';

export default function AiDiagnosticPage() {
  return (
    <ProtectedRoute>
      <AiDiagnosticScreen />
    </ProtectedRoute>
  );
}
