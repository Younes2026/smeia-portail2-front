import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { SavAppointmentsScreen } from '@/features/sav/appointments/ui/SavAppointmentsScreen';

export default function SavAppointmentsPage() {
  return (
    <ProtectedRoute>
      <SavAppointmentsScreen />
    </ProtectedRoute>
  );
}
