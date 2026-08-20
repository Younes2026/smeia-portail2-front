import { CrcRequestsScreen } from '@/features/crc/requests/ui/CrcRequestsScreen';
import { CrcProtectedRoute } from '@/features/crc/shared/ui/CrcProtectedRoute';

export default function CrcRequestsPage() {
  return (
    <CrcProtectedRoute>
      <CrcRequestsScreen />
    </CrcProtectedRoute>
  );
}
