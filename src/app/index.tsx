import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { HomeScreen } from '@/features/home/ui/HomeScreen';

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomeScreen />
    </ProtectedRoute>
  );
}
