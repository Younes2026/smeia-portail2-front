import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageContainer } from '@/components/layout/PageContainer';
import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useRepairs } from '@/features/repairs/hooks/useRepairs';

export function RepairsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;
  const { data: repairs, isLoading, isError, refetch } = useRepairs();
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);

  const selectedRepair = useMemo(() => {
    if (!repairs || repairs.length === 0) {
      return null;
    }

    return (
      repairs.find((repair) => repair.id === selectedRepairId) ?? repairs[0]
    );
  }, [repairs, selectedRepairId]);

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Chargement des reparations..." />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Erreur de chargement"
          message="Impossible de charger les reparations depuis Directus."
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
          title="Aucune reparation trouvee"
          message="Il n'y a aucune reparation a afficher pour le moment."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer padded={false}>
      <ScrollView
        style={styles.verticalScroll}
        contentContainerStyle={styles.verticalContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SMEIA-PORTAIL2</Text>
          <Text style={styles.title}>Reparations</Text>
          <Text style={styles.subtitle}>
            Liste des reparations recuperees depuis Directus avec TanStack Query.
          </Text>
        </View>

        <View style={[styles.summaryGrid, isCompact && styles.summaryGridCompact]}>
          <View style={styles.summaryPanel}>
            <Text style={styles.summaryValue}>{repairs.length}</Text>
            <Text style={styles.summaryLabel}>reparation(s) trouvee(s)</Text>
          </View>

          <View style={styles.summaryPanel}>
            <Text style={styles.summaryValue}>
              {selectedRepair?.statusName ?? '-'}
            </Text>
            <Text style={styles.summaryLabel}>statut selectionne</Text>
          </View>
        </View>

        <View style={styles.content}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.horizontalContent}
          >
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.headerCell]}>Document</Text>
                <Text style={[styles.cell, styles.headerCell]}>Client</Text>
                <Text style={[styles.cell, styles.headerCell]}>Vehicule</Text>
                <Text style={[styles.cell, styles.headerCell]}>Marque</Text>
                <Text style={[styles.cell, styles.headerCell]}>Statut</Text>
                <Text style={[styles.cell, styles.headerCell]}>Service</Text>
                <Text style={[styles.cell, styles.headerCell]}>Atelier</Text>
                <Text style={[styles.cell, styles.headerCell]}>Kilometrage</Text>
                <Text style={[styles.cell, styles.headerCell]}>Receptionniste</Text>
              </View>

              {repairs.map((repair) => {
                const isSelected = selectedRepair?.id === repair.id;

                return (
                  <Pressable
                    key={repair.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedRepairId(repair.id);
                    }}
                    style={({ hovered, pressed }) => [
                      styles.row,
                      isSelected && styles.selectedRow,
                      hovered && styles.hoveredRow,
                      pressed && styles.pressedRow,
                    ]}
                  >
                    <Text style={styles.cell}>{repair.documentNumber}</Text>
                    <Text style={styles.cell}>{repair.customerName}</Text>
                    <Text style={styles.cell}>{repair.vehicleLabel}</Text>
                    <Text style={styles.cell}>{repair.brandName}</Text>
                    <Text style={styles.cell}>{repair.statusName}</Text>
                    <Text style={styles.cell}>{repair.serviceTypeName}</Text>
                    <Text style={styles.cell}>{repair.workshopName}</Text>
                    <Text style={styles.cell}>{repair.entryMileage}</Text>
                    <Text style={styles.cell}>{repair.receptionistName}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {selectedRepair ? (
            <View style={styles.detailPanel}>
              <Text style={styles.detailTitle}>Detail reparation</Text>
              <View style={styles.detailGrid}>
                <DetailLine label="Document" value={selectedRepair.documentNumber} />
                <DetailLine label="Client" value={selectedRepair.customerName} />
                <DetailLine label="Vehicule" value={selectedRepair.vehicleLabel} />
                <DetailLine label="Marque" value={selectedRepair.brandName} />
                <DetailLine label="Statut" value={selectedRepair.statusName} />
                <DetailLine label="Service" value={selectedRepair.serviceTypeName} />
                <DetailLine label="Atelier" value={selectedRepair.workshopName} />
                <DetailLine label="Kilometrage" value={selectedRepair.entryMileage} />
                <DetailLine
                  label="Receptionniste"
                  value={selectedRepair.receptionistName}
                />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </PageContainer>
  );
}

type DetailLineProps = {
  label: string;
  value: string;
};

function DetailLine({ label, value }: DetailLineProps) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  verticalScroll: {
    flex: 1,
  },

  verticalContent: {
    flexGrow: 1,
    width: '100%',
    padding: spacing.lg,
    gap: spacing.lg,
  },

  header: {
    gap: spacing.sm,
  },

  eyebrow: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.secondary,
    letterSpacing: 0,
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

  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  summaryGridCompact: {
    flexDirection: 'column',
  },

  summaryPanel: {
    minWidth: 220,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.xs,
  },

  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text.primary,
  },

  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },

  content: {
    gap: spacing.lg,
  },

  horizontalContent: {
    flexGrow: 1,
  },

  table: {
    minWidth: 1320,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
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

  hoveredRow: {
    backgroundColor: colors.light.background.secondary,
  },

  pressedRow: {
    opacity: 0.86,
  },

  selectedRow: {
    backgroundColor: colors.light.background.muted,
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

  detailPanel: {
    maxWidth: 720,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.md,
  },

  detailTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  detailGrid: {
    gap: spacing.sm,
  },

  detailLine: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  detailLabel: {
    width: 140,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  detailValue: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },
});
