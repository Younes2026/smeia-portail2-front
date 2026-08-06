import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { TechnicianRepairsScreen } from '@/features/technician/repairs/ui/TechnicianRepairsScreen';

export default function TechnicianRepairsPage() {
  return (
    <ProtectedRoute>
      <TechnicianRepairsScreen />
    </ProtectedRoute>
  );
}
