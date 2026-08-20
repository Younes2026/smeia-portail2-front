import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/feedback/LoadingState';
import { isDirectusCrcRole } from '@/core/auth/directus-roles';
import { colors } from '@/core/theme/colors';
import { useAuthStore } from '@/store/auth.store';

export function CrcProtectedRoute({ children }: PropsWithChildren) {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const customer = useAuthStore((state) => state.customer);
  const savAgent = useAuthStore((state) => state.savAgent);
  const technician = useAuthStore((state) => state.technician);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const clearSession = useAuthStore((state) => state.clearSession);
  const hasCrcAccess = Boolean(
    accessToken && isDirectusCrcRole(user?.role)
  );

  useEffect(() => {
    if (!hasHydrated || hasCrcAccess) {
      return;
    }

    if (accessToken && savAgent && !customer) {
      router.replace('/sav/dashboard');
      return;
    }

    if (accessToken && technician && !customer && !savAgent) {
      router.replace('/technician/dashboard' as never);
      return;
    }

    if (accessToken && customer) {
      router.replace('/');
      return;
    }

    clearSession();
    router.replace('/login');
  }, [
    accessToken,
    clearSession,
    customer,
    hasCrcAccess,
    hasHydrated,
    router,
    savAgent,
    technician,
  ]);

  if (!hasHydrated) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <LoadingState message="Vérification de l’accès CRC..." />
      </SafeAreaView>
    );
  }

  if (!hasCrcAccess) {
    return null;
  }

  return children;
}

const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.light.background.secondary,
  },
});
