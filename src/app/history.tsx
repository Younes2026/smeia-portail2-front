import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { HistoryScreen } from '@/features/appointments/ui/HistoryScreen';

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryScreen />
    </ProtectedRoute>
  );
}
