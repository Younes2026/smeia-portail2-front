import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { RepairDetailsScreen } from '@/features/repairs/ui/RepairDetailsScreen';

export default function RepairDetailsPage() {
  return (
    <ProtectedRoute>
      <RepairDetailsScreen />
    </ProtectedRoute>
  );
}
