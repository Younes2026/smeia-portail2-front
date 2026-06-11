import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({
  message = 'Chargement des données...',
}: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  message: {
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },
});