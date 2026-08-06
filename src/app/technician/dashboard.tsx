import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { TechnicianDashboardScreen } from '@/features/technician/dashboard/ui/TechnicianDashboardScreen';

export default function TechnicianDashboardPage() {
  return (
    <ProtectedRoute>
      <TechnicianDashboardScreen />
    </ProtectedRoute>
  );
}
