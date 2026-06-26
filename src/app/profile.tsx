import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ProfileScreen } from '@/features/profile/ui/ProfileScreen';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileScreen />
    </ProtectedRoute>
  );
}
