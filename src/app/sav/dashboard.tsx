import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { SavDashboardScreen } from '@/features/sav/dashboard/ui/SavDashboardScreen';

export default function SavDashboardPage() {
  return (
    <ProtectedRoute>
      <SavDashboardScreen />
    </ProtectedRoute>
  );
}
