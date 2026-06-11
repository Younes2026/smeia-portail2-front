import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';

type EmptyStateProps = {
  title?: string;
  message?: string;
};

export function EmptyState({
  title = 'Aucune donnée trouvée',
  message = 'Il n’y a aucun élément à afficher pour le moment.',
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.light.border.strong,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },
  message: {
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
    textAlign: 'center',
  },
});
