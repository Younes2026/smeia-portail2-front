import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { SavAiDiagnosticsScreen } from '@/features/sav/ai-diagnostics/ui/SavAiDiagnosticsScreen';

export default function SavAiDiagnosticsPage() {
  return (
    <ProtectedRoute>
      <SavAiDiagnosticsScreen />
    </ProtectedRoute>
  );
}
