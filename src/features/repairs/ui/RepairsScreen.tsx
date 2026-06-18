import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageContainer } from '@/components/layout/PageContainer';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useRepairs } from '@/features/repairs/hooks/useRepairs';
import type { RepairListItem } from '@/features/repairs/model/repair.types';
import { useAuthStore } from '@/store/auth.store';

const navigationItems = [
  {
    href: '/repairs',
    label: 'Tableau de bord',
  },
  {
    href: '/repairs',
    label: 'Mes réparations',
  },
  {
    href: '/appointments',
    label: 'Prendre rendez-vous',
  },
  {
    href: '/vehicles',
    label: 'Mes véhicules',
  },
  {
    href: '/repairs',
    label: 'Historique',
  },
  {
    href: '/repairs',
    label: 'Profil',
  },
] as const;

const bookingSteps = [
  {
    title: 'Véhicule',
    description: 'Sélection du véhicule concerné par la demande.',
  },
  {
    title: 'Vérification',
    description: 'Contrôle des informations client et véhicule.',
  },
  {
    title: 'Atelier / concession',
    description: 'Choix du point de service SMEIA le plus adapté.',
  },
  {
    title: 'Type de service',
    description: 'Entretien, diagnostic, réparation ou contrôle.',
  },
  {
    title: 'Date & heure',
    description: 'Planification selon vos disponibilités.',
  },
  {
    title: 'Confirmation',
    description: 'Récapitulatif final avant validation.',
  },
] as const;

const repairStages = [
  'Réception',
  'Diagnostic',
  'Intervention',
  'Contrôle qualité',
  'Véhicule prêt',
] as const;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'client SMEIA';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getTrackingIndex(statusName?: string | null): number {
  const status = normalize(statusName ?? '');

  if (status.includes('pret') || status.includes('livre')) {
    return 4;
  }

  if (status.includes('controle') || status.includes('qualite')) {
    return 3;
  }

  if (status.includes('intervention') || status.includes('reparation')) {
    return 2;
  }

  if (status.includes('diagnostic')) {
    return 1;
  }

  return 0;
}

export function RepairsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.desktop;
  const isNarrow = width < breakpoints.tablet;
  const { data, isLoading, isError, refetch } = useRepairs();
  const repairs = data ?? [];
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);
  const [activeBookingStep, setActiveBookingStep] = useState(0);
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const logout = useLogout();

  const clientName = getDisplayName(
    customer?.firstName ?? user?.firstName,
    customer?.lastName ?? user?.lastName,
    customer?.email ?? user?.email
  );

  const selectedRepair = useMemo(() => {
    if (repairs.length === 0) {
      return null;
    }

    return (
      repairs.find((repair) => repair.id === selectedRepairId) ?? repairs[0]
    );
  }, [repairs, selectedRepairId]);

  const activeTrackingIndex = getTrackingIndex(selectedRepair?.statusName);

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Chargement de votre espace client..." />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Erreur de chargement"
          message="Impossible de charger votre tableau de bord client."
          onRetry={() => {
            refetch();
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer padded={false}>
      <View style={styles.page}>
        <View pointerEvents="none" style={[styles.backgroundShape, styles.shapeTop]} />
        <View
          pointerEvents="none"
          style={[styles.backgroundShape, styles.shapeBottom]}
        />

        <View style={[styles.shell, isCompact && styles.shellCompact]}>
          <Sidebar
            clientName={clientName}
            compact={isCompact}
            logoutDisabled={logout.isPending}
            onLogout={() => {
              logout.mutate();
            }}
          />

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
          >
            <View style={[styles.header, isNarrow && styles.headerNarrow]}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Bonjour</Text>
                <Text style={styles.title}>{clientName}</Text>
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
                label="Véhicule principal"
                value={selectedRepair?.vehicleLabel ?? 'Aucun véhicule actif'}
                detail={selectedRepair?.brandName ?? 'Dossier client'}
              />
              <SummaryCard
                label="Réparation en cours"
                value={selectedRepair?.statusName ?? 'Aucune réparation'}
                detail={selectedRepair?.documentNumber ?? 'Suivi à jour'}
              />
              <SummaryCard
                label="Prochaine action"
                value="Planifier un service"
                detail="Choisissez un atelier SMEIA"
              />
            </View>

            <View style={[styles.mainGrid, isCompact && styles.stack]}>
              <View style={styles.leftColumn}>
                <View style={styles.panel}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <Text style={styles.sectionKicker}>Parcours service</Text>
                      <Text style={styles.sectionTitle}>Prendre rendez-vous</Text>
                    </View>
                    <Text style={styles.sectionMeta}>6 étapes</Text>
                  </View>

                  <View style={[styles.bookingLayout, isNarrow && styles.stack]}>
                    <View style={styles.stepList}>
                      {bookingSteps.map((step, index) => (
                        <BookingStep
                          key={step.title}
                          active={index === activeBookingStep}
                          index={index}
                          title={step.title}
                          onPress={() => {
                            setActiveBookingStep(index);
                          }}
                        />
                      ))}
                    </View>

                    <View style={styles.stepContent}>
                      <Text style={styles.stepContentLabel}>
                        Étape {activeBookingStep + 1}
                      </Text>
                      <Text style={styles.stepContentTitle}>
                        {bookingSteps[activeBookingStep].title}
                      </Text>
                      <Text style={styles.stepContentText}>
                        {bookingSteps[activeBookingStep].description}
                      </Text>
                      <View style={styles.servicePreview}>
                        <Text style={styles.servicePreviewTitle}>
                          Préparation premium
                        </Text>
                        <Text style={styles.servicePreviewText}>
                          Votre conseiller confirme les informations, le créneau
                          et le point de service avant validation.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.panel}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <Text style={styles.sectionKicker}>Mes réparations</Text>
                      <Text style={styles.sectionTitle}>Dossiers récents</Text>
                    </View>
                    <Text style={styles.sectionMeta}>{repairs.length} dossier(s)</Text>
                  </View>

                  {repairs.length > 0 ? (
                    <View style={styles.repairList}>
                      {repairs.map((repair) => (
                        <RepairCard
                          key={repair.id}
                          repair={repair}
                          selected={selectedRepair?.id === repair.id}
                          onPress={() => {
                            setSelectedRepairId(repair.id);
                          }}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyPanel}>
                      <Text style={styles.emptyTitle}>Aucun dossier actif</Text>
                      <Text style={styles.emptyText}>
                        Vos réparations liées à votre compte client apparaîtront
                        ici dès leur création.
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.rightColumn}>
                <View style={styles.panel}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <Text style={styles.sectionKicker}>Suivi atelier</Text>
                      <Text style={styles.sectionTitle}>Progression</Text>
                    </View>
                  </View>

                  <View style={styles.selectedSummary}>
                    <Text style={styles.selectedVehicle}>
                      {selectedRepair?.vehicleLabel ?? 'Aucune réparation sélectionnée'}
                    </Text>
                    <Text style={styles.selectedDetail}>
                      {selectedRepair
                        ? `${selectedRepair.documentNumber} · ${selectedRepair.workshopName}`
                        : 'Sélectionnez un dossier pour suivre son avancement.'}
                    </Text>
                  </View>

                  <View style={styles.timeline}>
                    {repairStages.map((stage, index) => (
                      <TimelineItem
                        key={stage}
                        active={index <= activeTrackingIndex && Boolean(selectedRepair)}
                        current={index === activeTrackingIndex && Boolean(selectedRepair)}
                        isLast={index === repairStages.length - 1}
                        title={stage}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.panel}>
                  <Text style={styles.sectionKicker}>Profil client</Text>
                  <Text style={styles.sectionTitle}>Informations utiles</Text>
                  <View style={styles.infoGrid}>
                    <DetailLine label="Client" value={clientName} />
                    <DetailLine
                      label="Email"
                      value={customer?.email ?? user?.email ?? 'Non renseigné'}
                    />
                    <DetailLine
                      label="Téléphone"
                      value={customer?.phone ?? 'Non renseigné'}
                    />
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </PageContainer>
  );
}

type SidebarProps = {
  clientName: string;
  compact: boolean;
  logoutDisabled: boolean;
  onLogout: () => void;
};

function Sidebar({
  clientName,
  compact,
  logoutDisabled,
  onLogout,
}: SidebarProps) {
  return (
    <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>S</Text>
        </View>
        <View>
          <Text style={styles.brandName}>SMEIA</Text>
          <Text style={styles.brandSubname}>Portail client</Text>
        </View>
      </View>

      <View style={styles.profileBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(clientName)}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileLabel}>Compte client</Text>
          <Text style={styles.profileName}>{clientName}</Text>
        </View>
      </View>

      <View style={[styles.navList, compact && styles.navListCompact]}>
        {navigationItems.map((item, index) => (
          <Link key={item.label} href={item.href} asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.navItem,
                index === 0 && styles.navItemActive,
                hovered && styles.navItemHovered,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.navItemText,
                  index === 0 && styles.navItemTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={logoutDisabled}
        onPress={onLogout}
        style={({ hovered, pressed }) => [
          styles.logoutButton,
          hovered && !logoutDisabled && styles.logoutButtonHovered,
          pressed && !logoutDisabled && styles.pressed,
          logoutDisabled && styles.disabled,
        ]}
      >
        <Text style={styles.logoutButtonText}>
          {logoutDisabled ? 'Déconnexion...' : 'Déconnexion'}
        </Text>
      </Pressable>
    </View>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  detail: string;
};

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ hovered, pressed }) => [
        styles.summaryCard,
        hovered && styles.cardHovered,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryDetail}>{detail}</Text>
    </Pressable>
  );
}

type BookingStepProps = {
  active: boolean;
  index: number;
  title: string;
  onPress: () => void;
};

function BookingStep({ active, index, title, onPress }: BookingStepProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.stepItem,
        active && styles.stepItemActive,
        hovered && styles.stepItemHovered,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>
        {String(index + 1).padStart(2, '0')}
      </Text>
      <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>
        {title}
      </Text>
    </Pressable>
  );
}

type RepairCardProps = {
  repair: RepairListItem;
  selected: boolean;
  onPress: () => void;
};

function RepairCard({ repair, selected, onPress }: RepairCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.repairCard,
        selected && styles.repairCardSelected,
        hovered && styles.cardHovered,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.repairHeader}>
        <Text style={styles.repairDocument}>{repair.documentNumber}</Text>
        <Text style={styles.repairStatus}>{repair.statusName}</Text>
      </View>
      <Text style={styles.repairVehicle}>{repair.vehicleLabel}</Text>
      <Text style={styles.repairMeta}>
        {repair.serviceTypeName} · {repair.workshopName}
      </Text>
    </Pressable>
  );
}

type TimelineItemProps = {
  active: boolean;
  current: boolean;
  isLast: boolean;
  title: string;
};

function TimelineItem({ active, current, isLast, title }: TimelineItemProps) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineMarkerColumn}>
        <View
          style={[
            styles.timelineDot,
            active && styles.timelineDotActive,
            current && styles.timelineDotCurrent,
          ]}
        />
        {!isLast ? (
          <View style={[styles.timelineLine, active && styles.timelineLineActive]} />
        ) : null}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={[styles.timelineTitle, active && styles.timelineTitleActive]}>
          {title}
        </Text>
        <Text style={styles.timelineText}>
          {current ? 'Étape en cours' : active ? 'Validé' : 'À venir'}
        </Text>
      </View>
    </View>
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
  page: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F4F7FB',
    experimental_backgroundImage:
      'linear-gradient(135deg, #F8FAFC 0%, #EEF3F8 48%, #E7EEF7 100%)',
  },

  backgroundShape: {
    position: 'absolute',
    borderRadius: 999,
  },

  shapeTop: {
    width: 520,
    height: 520,
    top: -220,
    right: -140,
    backgroundColor: '#D6E2F2',
    opacity: 0.72,
  },

  shapeBottom: {
    width: 620,
    height: 620,
    left: -260,
    bottom: -300,
    backgroundColor: '#E3E8F0',
    opacity: 0.86,
  },

  shell: {
    flex: 1,
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.lg,
  },

  shellCompact: {
    flexDirection: 'column',
  },

  sidebar: {
    width: 280,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.26)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },

  sidebarCompact: {
    width: '100%',
  },

  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  brandMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#071832',
  },

  brandMarkText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  brandName: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  brandSubname: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
  },

  profileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: '#F3F6FA',
  },

  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#DDE8F6',
  },

  avatarText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  profileCopy: {
    flex: 1,
  },

  profileLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
  },

  profileName: {
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  navList: {
    gap: spacing.xs,
  },

  navListCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  navItem: {
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
  },

  navItemActive: {
    backgroundColor: '#E7F0FB',
  },

  navItemHovered: {
    backgroundColor: '#F1F5FA',
  },

  navItemText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  navItemTextActive: {
    color: '#0F4C9A',
    fontWeight: typography.fontWeight.bold,
  },

  logoutButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D7DFEA',
    borderRadius: 14,
    marginTop: 'auto',
    backgroundColor: '#FFFFFF',
  },

  logoutButtonHovered: {
    borderColor: '#C8D5E6',
    backgroundColor: '#F8FAFC',
  },

  logoutButtonText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  disabled: {
    opacity: 0.5,
  },

  contentScroll: {
    flex: 1,
  },

  content: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
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
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },

  headerNarrow: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },

  headerCopy: {
    flex: 1,
    gap: spacing.xs,
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
    maxWidth: 780,
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  primaryAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#0F4C9A',
    shadowColor: '#0F4C9A',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },

  primaryActionHovered: {
    backgroundColor: '#0B3E82',
  },

  primaryActionText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  pressed: {
    opacity: 0.86,
  },

  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  stack: {
    flexDirection: 'column',
  },

  summaryCard: {
    flex: 1,
    minHeight: 142,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },

  cardHovered: {
    borderColor: '#B8C9DF',
    transform: [{ translateY: -1 }],
  },

  summaryLabel: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
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

  mainGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },

  leftColumn: {
    flex: 1.35,
    gap: spacing.lg,
  },

  rightColumn: {
    flex: 1,
    gap: spacing.lg,
  },

  panel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
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

  sectionMeta: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  bookingLayout: {
    flexDirection: 'row',
    gap: spacing.lg,
  },

  stepList: {
    minWidth: 210,
    gap: spacing.sm,
  },

  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  stepItemActive: {
    borderColor: '#9CB8DA',
    backgroundColor: '#EAF2FC',
  },

  stepItemHovered: {
    borderColor: '#BDD0E8',
  },

  stepNumber: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  stepNumberActive: {
    color: '#0F4C9A',
  },

  stepTitle: {
    flex: 1,
    color: '#526174',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  stepTitleActive: {
    color: '#071832',
  },

  stepContent: {
    flex: 1,
    minHeight: 292,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: '#F6F9FD',
    gap: spacing.sm,
  },

  stepContentLabel: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  stepContentTitle: {
    color: '#071832',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  stepContentText: {
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  servicePreview: {
    marginTop: 'auto',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },

  servicePreviewTitle: {
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  servicePreviewText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  repairList: {
    gap: spacing.sm,
  },

  repairCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },

  repairCardSelected: {
    borderColor: '#8FB0D9',
    backgroundColor: '#F4F8FD',
  },

  repairHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  repairDocument: {
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  repairStatus: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  repairVehicle: {
    color: '#10243F',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },

  repairMeta: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  emptyPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    gap: spacing.xs,
  },

  emptyTitle: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  emptyText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  selectedSummary: {
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: '#F6F9FD',
    gap: spacing.xs,
  },

  selectedVehicle: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  selectedDetail: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  timeline: {
    gap: 0,
  },

  timelineItem: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  timelineMarkerColumn: {
    alignItems: 'center',
  },

  timelineDot: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  timelineDotActive: {
    borderColor: '#0F4C9A',
    backgroundColor: '#0F4C9A',
  },

  timelineDotCurrent: {
    shadowColor: '#0F4C9A',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.32,
    shadowRadius: 8,
  },

  timelineLine: {
    width: 2,
    height: 42,
    backgroundColor: '#CBD5E1',
  },

  timelineLineActive: {
    backgroundColor: '#0F4C9A',
  },

  timelineCopy: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },

  timelineTitle: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  timelineTitleActive: {
    color: '#071832',
  },

  timelineText: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
  },

  infoGrid: {
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
});
