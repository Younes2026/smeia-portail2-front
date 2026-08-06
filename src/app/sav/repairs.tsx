import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { SavRepairsScreen } from '@/features/sav/repairs/ui/SavRepairsScreen';

export default function SavRepairsPage() {
  return (
    <ProtectedRoute>
      <SavRepairsScreen />
    </ProtectedRoute>
  );
}
