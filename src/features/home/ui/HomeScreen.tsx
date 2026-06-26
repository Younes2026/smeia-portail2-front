import { Link } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useAppointmentsHistory } from '@/features/appointments/hooks/useAppointmentsHistory';
import { useRepairs } from '@/features/repairs/hooks/useRepairs';
import type { RepairListItem } from '@/features/repairs/model/repair.types';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import type { AuthCustomer, AuthUser } from '@/store/auth.store';
import { useAuthStore } from '@/store/auth.store';

const serviceSteps = [
  'Véhicule',
  'Vérification',
  'Atelier / concession',
  'Type de service',
  'Date & heure',
  'Confirmation',
] as const;

const repairProgressSteps = [
  'Réception',
  'Diagnostic',
  'Intervention',
  'Contrôle qualité',
  'Véhicule prêt',
] as const;

function getDisplayName(
  customer: AuthCustomer | null,
  user: AuthUser | null
): string {
  const customerName = `${customer?.firstName ?? ''} ${
    customer?.lastName ?? ''
  }`.trim();
  const userName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  return customerName || userName || customer?.email || user?.email || 'Client SMEIA';
}

function getFirstName(displayName: string): string {
  return displayName.split(' ').filter(Boolean)[0] ?? displayName;
}

function getProgressIndex(status: string): number {
  const normalizedStatus = status.toLocaleLowerCase('fr-FR');

  if (normalizedStatus.includes('prêt') || normalizedStatus.includes('pret')) {
    return 4;
  }

  if (normalizedStatus.includes('qualité') || normalizedStatus.includes('controle')) {
    return 3;
  }

  if (
    normalizedStatus.includes('intervention') ||
    normalizedStatus.includes('réparation') ||
    normalizedStatus.includes('reparation')
  ) {
    return 2;
  }

  if (normalizedStatus.includes('diagnostic')) {
    return 1;
  }

  return 0;
}

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const repairsQuery = useRepairs();
  const vehiclesQuery = useVehicles();
  const appointmentsQuery = useAppointmentsHistory();
  const repairs = repairsQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];
  const clientName = getDisplayName(customer, user);
  const primaryVehicle = vehicles[0] ?? null;
  const currentRepair = repairs[0] ?? null;
  const nextAppointment =
    appointments.find(
      (appointment) => appointment.status.trim().toLowerCase() === 'pending'
    ) ?? null;

  return (
    <ClientPortalLayout activeRoute="/">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={[styles.welcomePanel, isNarrow && styles.stack]}>
          <View style={styles.welcomeCopy}>
            <Text style={styles.eyebrow}>Bonjour</Text>
            <Text style={styles.title}>{getFirstName(clientName)}</Text>
            <Text style={styles.subtitle}>
              Bienvenue dans votre espace SMEIA. Suivez vos véhicules,
              réparations et rendez-vous en toute simplicité.
            </Text>
          </View>

          <Link href="/appointments" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.primaryAction,
                hovered && styles.primaryActionHovered,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryActionText}>Prendre rendez-vous</Text>
            </Pressable>
          </Link>
        </View>

        <View style={[styles.summaryGrid, isNarrow && styles.stack]}>
          <SummaryCard
            detail={
              primaryVehicle
                ? primaryVehicle.registrationNumber
                : 'Aucun véhicule enregistré'
            }
            label="Véhicule principal"
            value={
              primaryVehicle
                ? `${primaryVehicle.brandName} ${primaryVehicle.model}`
                : 'Non renseigné'
            }
          />
          <SummaryCard
            detail={
              currentRepair
                ? `${currentRepair.serviceTypeName} · ${currentRepair.workshopName}`
                : 'Aucun dossier atelier actif'
            }
            label="Réparation en cours"
            value={currentRepair?.statusName ?? 'Aucune'}
          />
          <SummaryCard
            detail={
              nextAppointment
                ? `${nextAppointment.requestedDate} à ${nextAppointment.requestedTime}`
                : 'Planifier une visite atelier'
            }
            label="Prochaine action"
            value={nextAppointment?.serviceType ?? 'Prendre rendez-vous'}
          />
        </View>

        <View style={[styles.dashboardGrid, isNarrow && styles.stack]}>
          <View style={styles.servicePanel}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionKicker}>Parcours service</Text>
                <Text style={styles.sectionTitle}>Préparez votre rendez-vous</Text>
                <Text style={styles.sectionDescription}>
                  Un parcours guidé pour transmettre votre demande à l'atelier.
                </Text>
              </View>

              <Link href="/appointments" asChild>
                <Pressable
                  accessibilityRole="link"
                  style={({ hovered, pressed }) => [
                    styles.secondaryAction,
                    hovered && styles.secondaryActionHovered,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryActionText}>Commencer</Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.serviceSteps}>
              {serviceSteps.map((step, index) => (
                <View key={step} style={styles.serviceStep}>
                  <Text style={styles.serviceStepNumber}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text style={styles.serviceStepLabel}>{step}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.quickPanel}>
            <Text style={styles.quickPanelKicker}>Accès rapide</Text>
            <Text style={styles.quickPanelTitle}>Vos espaces essentiels</Text>

            <QuickLink
              detail={`${repairs.length} dossier(s) associé(s) à votre compte`}
              href="/repairs"
              label="Mes réparations"
            />
            <QuickLink
              detail={`${vehicles.length} véhicule(s) dans votre garage`}
              href="/vehicles"
              label="Mes véhicules"
            />
          </View>
        </View>

        <RepairProgressCard
          isLoading={repairsQuery.isLoading}
          repair={currentRepair}
        />
      </ScrollView>
    </ClientPortalLayout>
  );
}

type SummaryCardProps = {
  detail: string;
  label: string;
  value: string;
};

function SummaryCard({ detail, label, value }: SummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.summaryValue}>
        {value}
      </Text>
      <Text numberOfLines={2} style={styles.summaryDetail}>
        {detail}
      </Text>
    </View>
  );
}

type QuickLinkProps = {
  detail: string;
  href: '/repairs' | '/vehicles';
  label: string;
};

function QuickLink({ detail, href, label }: QuickLinkProps) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ hovered, pressed }) => [
          styles.quickLink,
          hovered && styles.quickLinkHovered,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.quickLinkCopy}>
          <Text style={styles.quickLinkLabel}>{label}</Text>
          <Text style={styles.quickLinkDetail}>{detail}</Text>
        </View>
        <Text style={styles.quickLinkArrow}>›</Text>
      </Pressable>
    </Link>
  );
}

type RepairProgressCardProps = {
  isLoading: boolean;
  repair: RepairListItem | null;
};

function RepairProgressCard({ isLoading, repair }: RepairProgressCardProps) {
  const progressIndex = repair ? getProgressIndex(repair.statusName) : -1;

  return (
    <View style={styles.progressPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionKicker}>Suivi atelier</Text>
          <Text style={styles.sectionTitle}>
            {repair ? repair.vehicleLabel : 'Aucune réparation en cours'}
          </Text>
          <Text style={styles.sectionDescription}>
            {isLoading
              ? 'Chargement du suivi atelier...'
              : repair
                ? `${repair.documentNumber} · ${repair.workshopName}`
                : 'Vos prochaines étapes atelier apparaîtront ici.'}
          </Text>
        </View>

        <Link href="/repairs" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ hovered, pressed }) => [
              styles.secondaryAction,
              hovered && styles.secondaryActionHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>Voir les dossiers</Text>
          </Pressable>
        </Link>
      </View>

      {repair ? (
        <View style={styles.progressTrack}>
          {repairProgressSteps.map((step, index) => {
            const isComplete = index <= progressIndex;

            return (
              <View key={step} style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    isComplete && styles.progressDotComplete,
                  ]}
                >
                  <Text
                    style={[
                      styles.progressDotText,
                      isComplete && styles.progressDotTextComplete,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.progressLabel,
                    isComplete && styles.progressLabelComplete,
                  ]}
                >
                  {step}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },

  content: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.sm,
    paddingBottom: spacing.xl,
  },

  welcomePanel: {
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

  stack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  welcomeCopy: {
    flex: 1,
    gap: spacing.xs,
  },

  eyebrow: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
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

  primaryAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    backgroundColor: '#0F4C9A',
    shadowColor: '#0F4C9A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },

  primaryActionHovered: {
    backgroundColor: '#123F79',
  },

  primaryActionText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },

  summaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 168,
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E7F0',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },

  summaryLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  summaryValue: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  summaryDetail: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  dashboardGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },

  servicePanel: {
    flex: 2,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    gap: spacing.lg,
  },

  quickPanel: {
    flex: 1,
    minWidth: 280,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: '#071832',
    gap: spacing.md,
  },

  quickPanelKicker: {
    color: '#8FB7E8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  quickPanelTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
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

  secondaryAction: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#C8D5E6',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  secondaryActionHovered: {
    backgroundColor: '#F4F8FD',
  },

  secondaryActionText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  serviceSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  serviceStep: {
    flexGrow: 1,
    flexBasis: 180,
    minHeight: 84,
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E0E8F2',
    borderRadius: 16,
    backgroundColor: '#F7F9FC',
    gap: spacing.sm,
  },

  serviceStepNumber: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  serviceStepLabel: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  quickLink: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  quickLinkHovered: {
    borderColor: 'rgba(143, 183, 232, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  quickLinkCopy: {
    flex: 1,
    gap: spacing.xs,
  },

  quickLinkLabel: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  quickLinkDetail: {
    color: '#C8D5E6',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },

  quickLinkArrow: {
    color: '#8FB7E8',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  progressPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    gap: spacing.lg,
  },

  progressTrack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  progressStep: {
    flexGrow: 1,
    flexBasis: 150,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: '#F7F9FC',
  },

  progressDot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CDD7E4',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  progressDotComplete: {
    borderColor: '#0F4C9A',
    backgroundColor: '#0F4C9A',
  },

  progressDotText: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  progressDotTextComplete: {
    color: '#FFFFFF',
  },

  progressLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'center',
  },

  progressLabelComplete: {
    color: '#0F4C9A',
  },

  pressed: {
    opacity: 0.84,
  },
});
