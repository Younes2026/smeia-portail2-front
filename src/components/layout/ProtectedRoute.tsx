import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingState } from '@/components/feedback/LoadingState';
import { useAuthStore } from '@/store/auth.store';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const customer = useAuthStore((state) => state.customer);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const clearSession = useAuthStore((state) => state.clearSession);
  const hasProtectedSession = Boolean(accessToken && customer);

  useEffect(() => {
    if (!hasHydrated || hasProtectedSession) {
      return;
    }

    clearSession();
    router.replace('/login');
  }, [clearSession, hasHydrated, hasProtectedSession, router]);

  if (!hasHydrated) {
    return (
      <View style={styles.stateContainer}>
        <LoadingState message="Vérification de la session..." />
      </View>
    );
  }

  if (!hasProtectedSession) {
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});
