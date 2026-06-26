import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppointmentsScreen } from '@/features/appointments/ui/AppointmentsScreen';

export default function AppointmentsPage() {
  return (
    <ProtectedRoute>
      <AppointmentsScreen />
    </ProtectedRoute>
  );
}
