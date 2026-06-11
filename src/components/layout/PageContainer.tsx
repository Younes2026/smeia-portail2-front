import { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';

type PageContainerProps = PropsWithChildren<{
  padded?: boolean;
}>;

export function PageContainer({
  children,
  padded = true,
}: PageContainerProps) {
  return (
    <SafeAreaView style={[styles.container, padded && styles.padded]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background.primary,
  },
  padded: {
    padding: spacing.lg,
  },
});