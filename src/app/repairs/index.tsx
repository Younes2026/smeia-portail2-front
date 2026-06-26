import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { RepairsScreen } from '@/features/repairs/ui/RepairsScreen';

export default function RepairsPage() {
  return (
    <ProtectedRoute>
      <RepairsScreen />
    </ProtectedRoute>
  );
}
