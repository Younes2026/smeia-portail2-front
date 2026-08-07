import { Link, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
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
import { colors } from '@/core/theme/colors';
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

            <TimelinePanel isNarrow={isNarrow} repair={repair} />

            <View style={[styles.overviewGrid, isNarrow && styles.stack]}>
              <VehiclePanel repair={repair} />
              <RepairPanel repair={repair} />
            </View>

            <InterventionPanel repair={repair} />

            <CarePanel isNarrow={isNarrow} repair={repair} />
            <WorkshopContactPanel isNarrow={isNarrow} repair={repair} />
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
      <InfoLine label="VIN" value={repair.vehicleVinLabel ?? 'Non renseigné'} />
    </InfoPanel>
  );
}

function RepairPanel({ repair }: RepairPanelProps) {
  return (
    <InfoPanel title="Réparation">
      <InfoLine label="Statut" value={repair.statusLabel} />
      <InfoLine label="Date de réception" value={repair.entryDateLabel} />
      <InfoLine
        label="Kilométrage d'entrée"
        value={repair.mileageLabel ?? 'À compléter par l’atelier'}
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

function CarePanel({
  isNarrow,
  repair,
}: RepairPanelProps & { isNarrow: boolean }) {
  return (
    <View style={[styles.panel, styles.lowerPanel]}>
      <View style={[styles.sectionCopy, styles.lowerSectionCopy]}>
        <Text style={styles.sectionKicker}>Organisation atelier</Text>
        <Text style={styles.sectionTitle}>Prise en charge</Text>
        <Text style={styles.sectionDescription}>
          Les informations associées à votre dossier de réparation.
        </Text>
      </View>
      <View style={[styles.careGrid, isNarrow && styles.careGridNarrow]}>
        <CareItem
          icon={{ ios: 'wrench', android: 'build', web: 'build' }}
          isNarrow={isNarrow}
          label="Prestation"
          value={repair.serviceLabel || 'Non renseigné'}
        />
        <CareItem
          icon={{ ios: 'mappin', android: 'location_on', web: 'location_on' }}
          isNarrow={isNarrow}
          label="Atelier responsable"
          value={repair.workshopLabel || 'Non renseigné'}
        />
      </View>
    </View>
  );
}

function CareItem({
  icon,
  isNarrow,
  label,
  value,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  isNarrow: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.careItem, isNarrow && styles.careItemNarrow]}>
      <View style={styles.careIcon}>
        <SymbolView name={icon} size={21} tintColor="#1E5AA8" />
      </View>
      <View style={styles.careCopy}>
        <Text style={styles.careLabel}>{label}</Text>
        <Text style={styles.careValue}>{value}</Text>
      </View>
    </View>
  );
}

function getContactInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('fr-FR'))
    .join('');
}

function WorkshopContactPanel({
  isNarrow,
  repair,
}: RepairPanelProps & { isNarrow: boolean }) {
  const receptionistName = repair.receptionistLabel?.trim() || null;

  return (
    <View style={[styles.panel, styles.lowerPanel]}>
      <View style={[styles.sectionCopy, styles.lowerSectionCopy]}>
        <Text style={styles.sectionKicker}>Accompagnement</Text>
        <Text style={styles.sectionTitle}>Votre contact atelier</Text>
        <Text style={styles.sectionDescription}>
          Retrouvez ici votre interlocuteur pour le suivi du dossier.
        </Text>
      </View>

      <View style={styles.contactIdentity}>
        <View style={styles.contactAvatar}>
          {receptionistName ? (
            <Text style={styles.contactInitials}>
              {getContactInitials(receptionistName)}
            </Text>
          ) : (
            <SymbolView
              name={{ ios: 'person', android: 'person', web: 'person' }}
              size={24}
              tintColor="#1E5AA8"
            />
          )}
        </View>
        <View style={styles.contactIdentityCopy}>
          <View style={styles.contactBadge}>
            <Text style={styles.contactBadgeText}>CONTACT ATELIER</Text>
          </View>
          <Text style={styles.contactName}>
            {receptionistName ?? 'Réceptionniste à confirmer'}
          </Text>
        </View>
      </View>

      <View style={styles.contactDetails}>
        <ContactDetail
          icon={{ ios: 'person', android: 'person', web: 'person' }}
          label="Réceptionniste"
          value={receptionistName ?? 'Réceptionniste à confirmer'}
        />
        <ContactDetail
          icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
          label="Email"
          muted
          value="Email à renseigner"
        />
        <ContactDetail
          icon={{ ios: 'phone', android: 'phone', web: 'phone' }}
          label="Téléphone"
          muted
          value="Téléphone à renseigner"
        />
      </View>

      <View
        style={[
          styles.contactActions,
          isNarrow && styles.contactActionsNarrow,
        ]}
      >
        <ContactAction
          icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
          isNarrow={isNarrow}
          label="Envoyer un email"
        />
        <ContactAction
          icon={{ ios: 'phone', android: 'phone', web: 'phone' }}
          isNarrow={isNarrow}
          label="Appeler"
        />
      </View>

      <View style={styles.contactPendingNotice}>
        <SymbolView
          name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
          size={16}
          tintColor={colors.light.text.secondary}
        />
        <Text style={styles.contactPendingText}>Coordonnées à venir</Text>
      </View>
    </View>
  );
}

function ContactDetail({
  icon,
  label,
  muted = false,
  value,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
  muted?: boolean;
  value: string;
}) {
  return (
    <View style={styles.contactDetail}>
      <View style={styles.contactDetailIcon}>
        <SymbolView name={icon} size={16} tintColor="#1E5AA8" />
      </View>
      <View style={styles.contactDetailCopy}>
        <Text style={styles.contactDetailLabel}>{label}</Text>
        <Text style={[styles.contactDetailValue, muted && styles.contactDetailValueMuted]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ContactAction({
  icon,
  isNarrow,
  label,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  isNarrow: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      disabled
      style={[styles.contactAction, isNarrow && styles.contactActionNarrow]}
    >
      <SymbolView name={icon} size={17} tintColor={colors.light.text.muted} />
      <Text style={styles.contactActionText}>{label}</Text>
    </Pressable>
  );
}

function TimelinePanel({
  isNarrow,
  repair,
}: RepairPanelProps & { isNarrow: boolean }) {
  const currentStepNumber = repair.progress.activeIndex + 1;
  const currentStep = CLIENT_REPAIR_PROGRESS_STEPS[repair.progress.activeIndex];

  return (
    <View style={styles.progressPanel}>
      <View
        style={[
          styles.progressHeader,
          isNarrow && styles.progressHeaderNarrow,
        ]}
      >
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionKicker}>Progression</Text>
          <Text style={styles.sectionTitle}>Suivi atelier</Text>
          <Text style={styles.sectionDescription}>
            Suivez les principales étapes de prise en charge de votre véhicule.
          </Text>
        </View>
        <View
          style={[styles.progressMeta, isNarrow && styles.progressMetaNarrow]}
        >
          <View style={styles.progressStepBadge}>
            <Text style={styles.progressStepBadgeText}>
              Étape {currentStepNumber} sur {CLIENT_REPAIR_PROGRESS_STEPS.length}
            </Text>
          </View>
          <View style={styles.progressStatusGroup}>
            <Text style={styles.progressStatusLabel}>Statut actuel</Text>
            <View style={styles.progressStatusBadge}>
              <View style={styles.progressStatusDot} />
              <Text style={styles.progressStatusText}>{repair.statusLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      <View
        accessibilityLabel={`Progression de la réparation : étape ${currentStepNumber} sur ${CLIENT_REPAIR_PROGRESS_STEPS.length}, ${currentStep}`}
        style={[styles.timeline, isNarrow && styles.timelineNarrow]}
      >
        {CLIENT_REPAIR_PROGRESS_STEPS.map((step, index) => {
          const isComplete = index <= repair.progress.completedThrough;
          const isActive = index === repair.progress.activeIndex;
          const connectorComplete = index < repair.progress.activeIndex;
          const stateLabel = isComplete
            ? 'terminée'
            : isActive
              ? 'actuelle'
              : 'à venir';

          return (
            <View
              key={step}
              accessible
              accessibilityLabel={`${step}, étape ${index + 1} sur ${CLIENT_REPAIR_PROGRESS_STEPS.length}, ${stateLabel}`}
              style={[
                styles.timelineStep,
                isNarrow && styles.timelineStepNarrow,
              ]}
            >
              <View style={[styles.timelineTrack, isNarrow && styles.timelineTrackNarrow]}>
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
                      size={15}
                      tintColor="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={[
                        styles.timelineDotText,
                        isActive && styles.timelineDotTextActive,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                {index < CLIENT_REPAIR_PROGRESS_STEPS.length - 1 ? (
                  <View
                    style={[
                      styles.timelineConnector,
                      connectorComplete && styles.timelineConnectorComplete,
                      isNarrow && styles.timelineConnectorNarrow,
                    ]}
                  />
                ) : null}
              </View>
              <View style={[styles.timelineCopy, isNarrow && styles.timelineCopyNarrow]}>
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
            </View>
          );
        })}
      </View>

      <View style={[styles.progressCurrent, isNarrow && styles.progressCurrentNarrow]}>
        <View style={styles.progressCurrentIcon}>
          <SymbolView
            name={{
              ios: 'shield.checkered',
              android: 'verified_user',
              web: 'verified_user',
            }}
            size={19}
            tintColor="#FFFFFF"
          />
        </View>
        <View style={styles.progressCurrentCopy}>
          <Text style={styles.progressCurrentLabel}>Étape actuelle</Text>
          <Text style={styles.progressCurrentTitle}>{currentStep}</Text>
          <Text style={styles.progressCurrentMessage}>{repair.message}</Text>
        </View>
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

  lowerPanel: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'stretch',
    gap: spacing.lg,
  },

  sectionCopy: {
    flex: 1,
    gap: spacing.xs,
  },

  lowerSectionCopy: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
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

  careGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  careGridNarrow: {
    flexDirection: 'column',
  },

  careItem: {
    flex: 1,
    flexBasis: 190,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: 18,
    backgroundColor: colors.light.background.secondary,
  },

  careItemNarrow: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },

  careIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E8F1FC',
  },

  careCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },

  careLabel: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  careValue: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  contactIdentity: {
    width: '100%',
    flexShrink: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: 18,
    backgroundColor: colors.light.background.secondary,
  },

  contactAvatar: {
    width: 54,
    height: 54,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 999,
    backgroundColor: '#E8F1FC',
  },

  contactInitials: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  contactIdentityCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },

  contactBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#DDEAF9',
  },

  contactBadgeText: {
    color: '#1E5AA8',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },

  contactName: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  contactDetails: {
    width: '100%',
    flexShrink: 0,
  },

  contactDetail: {
    width: '100%',
    flexShrink: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border.default,
  },

  contactDetailIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#EDF5FD',
  },

  contactDetailCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  contactDetailLabel: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
  },

  contactDetailValue: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  contactDetailValueMuted: {
    color: colors.light.text.muted,
  },

  contactActions: {
    width: '100%',
    flexShrink: 0,
    minWidth: 0,
    flexDirection: 'row',
    gap: spacing.sm,
  },

  contactActionsNarrow: {
    flexDirection: 'column',
  },

  contactAction: {
    minHeight: 44,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: 13,
    backgroundColor: colors.light.background.muted,
    opacity: 0.62,
  },

  contactActionNarrow: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },

  contactActionText: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  contactPendingNotice: {
    width: '100%',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.light.background.muted,
  },

  contactPendingText: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  progressPanel: {
    minWidth: 0,
    gap: spacing.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: 24,
    backgroundColor: '#FBFDFF',
    shadowColor: colors.light.brand.primary,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.08,
    shadowRadius: 30,
  },

  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },

  progressHeaderNarrow: {
    flexDirection: 'column',
  },

  progressMeta: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },

  progressMetaNarrow: {
    alignItems: 'flex-start',
  },

  progressStepBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.light.brand.primary,
  },

  progressStepBadgeText: {
    color: colors.light.text.inverse,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  progressStatusBadge: {
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 999,
    backgroundColor: '#EDF5FD',
  },

  progressStatusGroup: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },

  progressStatusLabel: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  progressStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.light.status.info,
  },

  progressStatusText: {
    flexShrink: 1,
    color: '#0F4C9A',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  timelineNarrow: {
    flexDirection: 'column',
  },

  timelineStep: {
    flex: 1,
    minWidth: 0,
  },

  timelineStepNarrow: {
    width: '100%',
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  timelineTrack: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },

  timelineTrackNarrow: {
    width: 36,
    alignSelf: 'stretch',
    flexDirection: 'column',
  },

  timelineDot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.light.border.strong,
    borderRadius: 999,
    backgroundColor: colors.light.background.primary,
  },

  timelineDotComplete: {
    borderColor: colors.light.status.success,
    backgroundColor: colors.light.status.success,
  },

  timelineDotActive: {
    borderWidth: 3,
    borderColor: colors.light.status.info,
    backgroundColor: '#1E5AA8',
    shadowColor: colors.light.status.info,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
  },

  timelineDotText: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  timelineDotTextActive: {
    color: colors.light.text.inverse,
  },

  timelineConnector: {
    flex: 1,
    height: 3,
    backgroundColor: colors.light.border.default,
  },

  timelineConnectorComplete: {
    backgroundColor: colors.light.status.success,
  },

  timelineConnectorNarrow: {
    width: 3,
    height: 'auto',
    minHeight: 30,
  },

  timelineCopy: {
    gap: 3,
    marginTop: spacing.sm,
    paddingRight: spacing.sm,
  },

  timelineCopyNarrow: {
    flex: 1,
    marginTop: 5,
    paddingLeft: spacing.sm,
    paddingRight: 0,
  },

  timelineLabel: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  timelineLabelComplete: {
    color: colors.light.status.success,
  },

  timelineLabelActive: {
    color: '#1E5AA8',
    fontWeight: typography.fontWeight.bold,
  },

  timelineActiveLabel: {
    color: '#1E5AA8',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },

  progressCurrent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.light.brand.primary,
  },

  progressCurrentNarrow: {
    alignItems: 'flex-start',
  },

  progressCurrentIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#1E5AA8',
  },

  progressCurrentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },

  progressCurrentLabel: {
    color: '#AFCBEF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },

  progressCurrentTitle: {
    color: colors.light.text.inverse,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  progressCurrentMessage: {
    color: '#DCE8F7',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
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
