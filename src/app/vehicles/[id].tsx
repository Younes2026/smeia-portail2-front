import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { VehicleDetailScreen } from '@/features/vehicles/ui/VehicleDetailScreen';

export default function VehicleDetailPage() {
  return (
    <ProtectedRoute>
      <VehicleDetailScreen />
    </ProtectedRoute>
  );
}
