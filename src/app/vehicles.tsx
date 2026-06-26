import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { VehiclesScreen } from '@/features/vehicles/ui/VehiclesScreen';

export default function VehiclesPage() {
  return (
    <ProtectedRoute>
      <VehiclesScreen />
    </ProtectedRoute>
  );
}
