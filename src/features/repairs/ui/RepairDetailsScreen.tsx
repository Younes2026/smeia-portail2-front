import { Link, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
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
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useClientRepairPresentation } from '@/features/repairs/hooks/useClientRepairPresentation';
import { useRepairDetail } from '@/features/repairs/hooks/useRepairs';
import {
  CLIENT_REPAIR_PROGRESS_STEPS,
  type ClientRepairViewModel,
} from '@/features/repairs/model/client-repair.presenter';

function parseRepairId(value: string | string[] | undefined): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return null;
  }

  const repairId = Number.parseInt(rawValue, 10);

  return Number.isNaN(repairId) ? null : repairId;
}

export function RepairDetailsScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const params = useLocalSearchParams();
  const repairId = parseRepairId(params.id);
  const repairQuery = useRepairDetail(repairId);
  const rawRepair = repairQuery.data ?? null;
  const repairPresentation = useClientRepairPresentation(
    rawRepair ? [rawRepair] : []
  );
  const repair = repairPresentation.data[0] ?? null;
  const isLoading = repairQuery.isLoading || repairPresentation.isLoading;

  if (isLoading) {
    return (
      <ClientPortalLayout activeRoute="/repairs">
        <View style={styles.stateContainer}>
          <LoadingState message="Chargement du détail de la réparation..." />
        </View>
      </ClientPortalLayout>
    );
  }

  if (repairQuery.isError) {
    return (
      <ClientPortalLayout activeRoute="/repairs">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Impossible de charger cette réparation."
            message="Veuillez réessayer dans quelques instants."
            onRetry={() => {
              repairQuery.refetch();
            }}
          />
        </View>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout activeRoute="/repairs">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        {repair ? (
          <>
            <View style={[styles.header, isNarrow && styles.headerNarrow]}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Détail réparation</Text>
                <Text style={styles.title}>{repair.referenceLabel}</Text>
                <Text style={styles.subtitle}>
                  Suivi atelier du dossier associé à votre véhicule.
                </Text>
              </View>

              <View style={[styles.headerActions, isNarrow && styles.stack]}>
                <StatusBadge label={repair.statusLabel} />

                <Link href="/repairs" asChild>
                  <Pressable
                    accessibilityRole="link"
                    style={({ hovered, pressed }) => [
                      styles.secondaryAction,
                      hovered && styles.secondaryActionHovered,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryActionText}>
                      Mes réparations
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </View>

            <View style={[styles.overviewGrid, isNarrow && styles.stack]}>
              <VehiclePanel repair={repair} />
              <RepairPanel repair={repair} />
            </View>

            <InterventionPanel repair={repair} />

            <TimelinePanel repair={repair} />
          </>
        ) : (
          <View style={styles.statePanel}>
            <EmptyState
              title="Réparation introuvable."
              message="Ce dossier n'existe pas ou n'est pas lié à votre compte client."
            />
          </View>
        )}
      </ScrollView>
    </ClientPortalLayout>
  );
}

type RepairPanelProps = {
  repair: ClientRepairViewModel;
};

function VehiclePanel({ repair }: RepairPanelProps) {
  return (
    <InfoPanel title="Véhicule">
      <InfoLine label="Véhicule" value={repair.vehicleLabel} />
      {repair.brandName ? (
        <InfoLine label="Marque" value={repair.brandName} />
      ) : null}
      {repair.registrationLabel ? (
        <InfoLine label="Immatriculation" value={repair.registrationLabel} />
      ) : null}
    </InfoPanel>
  );
}

function RepairPanel({ repair }: RepairPanelProps) {
  return (
    <InfoPanel title="Réparation">
      <InfoLine label="Statut" value={repair.statusLabel} />
      <InfoLine label="Prestation" value={repair.serviceLabel} />
      <InfoLine label="Atelier" value={repair.workshopLabel} />
      <InfoLine label="Date de réception" value={repair.entryDateLabel} />
      <InfoLine
        label="Kilométrage d'entrée"
        value={repair.mileageLabel ?? 'À compléter par l’atelier'}
      />
      <InfoLine
        label="Réceptionniste"
        value={repair.receptionistLabel ?? 'À compléter par l’atelier'}
      />
    </InfoPanel>
  );
}

function InterventionPanel({ repair }: RepairPanelProps) {
  const details = [
    { label: 'Demande initiale', value: repair.description },
    { label: 'Diagnostic réel', value: repair.diagnosticLabel },
    { label: 'Travaux effectués', value: repair.workDoneLabel },
    { label: 'Solution apportée', value: repair.solutionLabel },
    { label: 'Recommandations', value: repair.recommendationsLabel },
    { label: 'Note atelier', value: repair.note },
    { label: 'Date de sortie', value: repair.realExitDateLabel },
    { label: 'Coût final', value: repair.finalCostLabel },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  if (details.length === 0) {
    return null;
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionKicker}>Compte rendu</Text>
      <Text style={styles.sectionTitle}>Intervention atelier</Text>
      <View style={styles.interventionGrid}>
        {details.map((detail) => (
          <View key={detail.label} style={styles.interventionItem}>
            <Text style={styles.detailLabel}>{detail.label}</Text>
            <Text style={styles.interventionValue}>{detail.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TimelinePanel({ repair }: RepairPanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionKicker}>Progression</Text>
          <Text style={styles.sectionTitle}>Suivi atelier</Text>
          <Text style={styles.sectionDescription}>
            Statut actuel : {repair.statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {CLIENT_REPAIR_PROGRESS_STEPS.map((step, index) => {
          const isComplete = index <= repair.progress.completedThrough;
          const isActive = index === repair.progress.activeIndex;

          return (
            <View
              key={step}
              style={[
                styles.timelineStep,
                isComplete && styles.stepComplete,
                isActive && styles.stepActive,
              ]}
            >
              <View
                style={[
                  styles.timelineDot,
                  isComplete && styles.timelineDotComplete,
                  isActive && styles.timelineDotActive,
                ]}
              >
                {isComplete ? (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={16}
                    tintColor="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={[
                      styles.timelineDotText,
                      isActive && styles.timelineDotTextComplete,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.timelineLabel,
                  isComplete && styles.timelineLabelComplete,
                  isActive && styles.timelineLabelActive,
                ]}
              >
                {step}
              </Text>
              {isActive ? (
                <Text style={styles.timelineActiveLabel}>Étape actuelle</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

type InfoPanelProps = {
  children: ReactNode;
  title: string;
};

function InfoPanel({ children, title }: InfoPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionKicker}>Informations</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.detailGrid}>{children}</View>
    </View>
  );
}

type InfoLineProps = {
  label: string;
  value: string;
};

function InfoLine({ label, value }: InfoLineProps) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

type StatusBadgeProps = {
  label: string;
};

function StatusBadge({ label }: StatusBadgeProps) {
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  scroll: {
    flex: 1,
  },

  content: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.06,
    shadowRadius: 28,
  },

  headerNarrow: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },

  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },

  headerActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },

  stack: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },

  eyebrow: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0,
  },

  title: {
    color: '#071832',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },

  subtitle: {
    maxWidth: 760,
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  secondaryAction: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#C8D5E6',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  secondaryActionHovered: {
    backgroundColor: '#F4F8FD',
  },

  secondaryActionText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  statusBadge: {
    alignSelf: 'flex-start',
    maxWidth: 220,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 999,
    backgroundColor: '#EDF5FD',
  },

  statusText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },

  overviewGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },

  panel: {
    flex: 1,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.06,
    shadowRadius: 26,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  sectionCopy: {
    flex: 1,
    gap: spacing.xs,
  },

  sectionKicker: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  sectionTitle: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  sectionDescription: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  detailGrid: {
    gap: spacing.sm,
  },

  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  detailLabel: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
  },

  detailValue: {
    flex: 1,
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'right',
  },

  interventionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  interventionItem: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 240,
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
  },

  interventionValue: {
    color: '#071832',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  timeline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },

  timelineStep: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 16,
    backgroundColor: '#F7F9FC',
  },

  stepComplete: {
    borderColor: '#B9DCCF',
    backgroundColor: '#F0F8F5',
  },

  stepActive: {
    borderColor: '#9BB9DE',
    backgroundColor: '#EDF4FF',
  },

  timelineDot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CDD7E4',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  timelineDotComplete: {
    borderColor: '#2F7D67',
    backgroundColor: '#2F7D67',
  },

  timelineDotActive: {
    borderColor: '#2F5FA6',
    backgroundColor: '#2F5FA6',
  },

  timelineDotText: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  timelineDotTextComplete: {
    color: '#FFFFFF',
  },

  timelineLabel: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'center',
  },

  timelineLabelComplete: {
    color: '#2F7D67',
  },

  timelineLabelActive: {
    color: '#2F5FA6',
    fontWeight: typography.fontWeight.bold,
  },

  timelineActiveLabel: {
    color: '#2F5FA6',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },

  statePanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  pressed: {
    opacity: 0.86,
  },
});
