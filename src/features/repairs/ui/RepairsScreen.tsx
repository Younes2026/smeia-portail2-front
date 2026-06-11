import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageContainer } from '@/components/layout/PageContainer';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useRepairs } from '@/features/repairs/hooks/useRepairs';

export function RepairsScreen() {
  const { data: repairs, isLoading, isError, refetch } = useRepairs();

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Chargement des réparations..." />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Erreur de chargement"
          message="Impossible de charger les réparations depuis Directus."
          onRetry={() => {
            refetch();
          }}
        />
      </PageContainer>
    );
  }

  if (!repairs || repairs.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          title="Aucune réparation trouvée"
          message="Il n’y a aucune réparation à afficher pour le moment."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SMEIA-PORTAIL2</Text>
        <Text style={styles.title}>Réparations</Text>
        <Text style={styles.subtitle}>
          Liste des réparations récupérées depuis Directus avec TanStack Query.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{repairs.length}</Text>
        <Text style={styles.summaryLabel}>réparation(s) trouvée(s)</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.headerCell]}>Document</Text>
            <Text style={[styles.cell, styles.headerCell]}>Client</Text>
            <Text style={[styles.cell, styles.headerCell]}>Véhicule</Text>
            <Text style={[styles.cell, styles.headerCell]}>Marque</Text>
            <Text style={[styles.cell, styles.headerCell]}>Statut</Text>
            <Text style={[styles.cell, styles.headerCell]}>Service</Text>
            <Text style={[styles.cell, styles.headerCell]}>Atelier</Text>
            <Text style={[styles.cell, styles.headerCell]}>Kilométrage</Text>
            <Text style={[styles.cell, styles.headerCell]}>Réceptionniste</Text>
          </View>

          {repairs.map((repair) => (
            <View key={repair.id} style={styles.row}>
              <Text style={styles.cell}>{repair.documentNumber}</Text>
              <Text style={styles.cell}>{repair.customerName}</Text>
              <Text style={styles.cell}>{repair.vehicleLabel}</Text>
              <Text style={styles.cell}>{repair.brandName}</Text>
              <Text style={styles.cell}>{repair.statusName}</Text>
              <Text style={styles.cell}>{repair.serviceTypeName}</Text>
              <Text style={styles.cell}>{repair.workshopName}</Text>
              <Text style={styles.cell}>{repair.entryMileage}</Text>
              <Text style={styles.cell}>{repair.receptionistName}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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

  summaryCard: {
    width: 220,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: 16,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.xs,
  },

  summaryValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text.primary,
  },

  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },

  table: {
    minWidth: 1320,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.light.background.primary,
  },

  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border.default,
  },

  headerRow: {
    backgroundColor: colors.light.background.secondary,
  },

  cell: {
    width: 145,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },

  headerCell: {
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },
});