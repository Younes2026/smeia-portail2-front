import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageContainer } from '@/components/layout/PageContainer';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';

export default function HomeScreen() {
  return (
    <PageContainer>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SMEIA-PORTAIL2</Text>

        <Text style={styles.title}>Portail Client</Text>

        <Text style={styles.subtitle}>
          Frontend initialisé avec Expo, React Native for Web, TypeScript,
          Expo Router, Zustand et TanStack Query.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Architecture frontend prête</Text>

        <Text style={styles.cardText}>
          La base du projet respecte la structure demandée : src/app, src/core,
          src/features, src/components, src/store et src/utils.
        </Text>

        <Text style={styles.cardText}>
          Prochaine étape : préparer le premier module métier avec les
          réparations.
        </Text>
      </View>

      <View style={styles.feedbackSection}>
        <LoadingState message="Chargement de test..." />

        <EmptyState
          title="Aucune réparation trouvée"
          message="Il n’y a aucune réparation à afficher pour le moment."
        />

        <ErrorState
          title="Erreur de chargement"
          message="Impossible de charger les réparations."
          onRetry={() => {
            console.log('Retry clicked');
          }}
        />
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  eyebrow: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.secondary,
    letterSpacing: 1,
  },

  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text.primary,
  },

  subtitle: {
    maxWidth: 720,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    color: colors.light.text.secondary,
  },

  card: {
    maxWidth: 820,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: 16,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.sm,
  },

  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  cardText: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    color: colors.light.text.secondary,
  },

  feedbackSection: {
    maxWidth: 820,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});