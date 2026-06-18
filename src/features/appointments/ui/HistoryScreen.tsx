import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Modal,
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
import {
  useAppointmentsHistory,
  useCancelAppointment,
} from '@/features/appointments/hooks/useAppointmentsHistory';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';
import { useLogout } from '@/features/auth/hooks/useLogout';
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
    href: '/history',
    label: 'Historique',
  },
  {
    href: '/repairs',
    label: 'Profil',
  },
] as const;

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

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function getStatusLabel(status: string): string {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === 'pending') {
    return 'En attente';
  }

  if (normalizedStatus === 'cancelled') {
    return 'Annulé';
  }

  if (normalizedStatus === 'confirmed') {
    return 'Confirmé';
  }

  return status;
}

export function HistoryScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.desktop;
  const isNarrow = width < breakpoints.tablet;
  const appointmentsQuery = useAppointmentsHistory();
  const cancelAppointment = useCancelAppointment();
  const [appointmentToCancel, setAppointmentToCancel] = useState<
    number | string | null
  >(null);
  const appointments = appointmentsQuery.data ?? [];
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const logout = useLogout();
  const clientName = getDisplayName(
    customer?.firstName ?? user?.firstName,
    customer?.lastName ?? user?.lastName,
    customer?.email ?? user?.email
  );
  const pendingCount = appointments.filter(
    (appointment) => normalizeStatus(appointment.status) === 'pending'
  ).length;

  useEffect(() => {
    if (cancelAppointment.isSuccess) {
      setAppointmentToCancel(null);
    }
  }, [cancelAppointment.isSuccess]);

  if (appointmentsQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Chargement de vos rendez-vous..." />
      </PageContainer>
    );
  }

  if (appointmentsQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Erreur de chargement"
          message="Impossible de charger l'historique de vos rendez-vous."
          onRetry={() => {
            appointmentsQuery.refetch();
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
          <View style={[styles.sidebar, isCompact && styles.sidebarCompact]}>
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

            <View style={[styles.navList, isCompact && styles.navListCompact]}>
              {navigationItems.map((item) => {
                const isActive = item.href === '/history';

                return (
                  <Link key={item.label} href={item.href} asChild>
                    <Pressable
                      accessibilityRole="link"
                      style={({ hovered, pressed }) => [
                        styles.navItem,
                        isActive && styles.navItemActive,
                        hovered && styles.navItemHovered,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.navItemText,
                          isActive && styles.navItemTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={logout.isPending}
              onPress={() => {
                logout.mutate();
              }}
              style={({ hovered, pressed }) => [
                styles.logoutButton,
                hovered && !logout.isPending && styles.logoutButtonHovered,
                pressed && !logout.isPending && styles.pressed,
                logout.isPending && styles.disabled,
              ]}
            >
              <Text style={styles.logoutButtonText}>
                {logout.isPending ? 'Déconnexion...' : 'Déconnexion'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
          >
            <View style={[styles.header, isNarrow && styles.headerNarrow]}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Historique</Text>
                <Text style={styles.title}>Mes rendez-vous</Text>
                <Text style={styles.subtitle}>
                  Consultez vos demandes de rendez-vous et annulez celles qui
                  sont encore en attente.
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
                  <Text style={styles.primaryActionText}>
                    Nouveau rendez-vous
                  </Text>
                </Pressable>
              </Link>
            </View>

            <View style={[styles.summaryGrid, isNarrow && styles.stack]}>
              <SummaryCard
                detail="Demandes liées à votre compte"
                label="Rendez-vous"
                value={String(appointments.length)}
              />
              <SummaryCard
                detail="Annulation encore possible"
                label="En attente"
                value={String(pendingCount)}
              />
              <SummaryCard
                detail="Historique conservé dans Directus"
                label="Suivi"
                value="Sécurisé"
              />
            </View>

            {cancelAppointment.isSuccess ? (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>Rendez-vous annulé</Text>
                <Text style={styles.successText}>
                  Le statut a été mis à jour et l'historique a été actualisé.
                </Text>
              </View>
            ) : null}

            {cancelAppointment.isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Annulation impossible</Text>
                <Text style={styles.errorText}>
                  La mise à jour du rendez-vous a échoué. Veuillez réessayer.
                </Text>
              </View>
            ) : null}

            {appointments.length > 0 ? (
              <View style={styles.appointmentGrid}>
                {appointments.map((appointment) => (
                  <AppointmentCard
                    key={String(appointment.id)}
                    appointment={appointment}
                    isCancelling={
                      cancelAppointment.isPending &&
                      String(cancelAppointment.variables) ===
                        String(appointment.id)
                    }
                    onCancel={() => {
                      cancelAppointment.reset();
                      setAppointmentToCancel(appointment.id);
                    }}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>Aucun rendez-vous</Text>
                <Text style={styles.emptyText}>
                  Vous n'avez pas encore créé de demande de rendez-vous.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        <Modal
          animationType="fade"
          onRequestClose={() => {
            if (!cancelAppointment.isPending) {
              setAppointmentToCancel(null);
            }
          }}
          transparent
          visible={appointmentToCancel !== null}
        >
          <View style={styles.modalOverlay}>
            <View
              accessibilityRole="alert"
              style={styles.confirmationModal}
            >
              <Text style={styles.modalEyebrow}>Rendez-vous SMEIA</Text>
              <Text style={styles.modalTitle}>Confirmer l’annulation</Text>
              <Text style={styles.modalMessage}>
                Voulez-vous vraiment annuler ce rendez-vous ? Cette action
                conservera l’historique dans Directus.
              </Text>

              <View style={[styles.modalActions, isNarrow && styles.stack]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={cancelAppointment.isPending}
                  onPress={() => {
                    setAppointmentToCancel(null);
                  }}
                  style={({ hovered, pressed }) => [
                    styles.keepButton,
                    hovered &&
                      !cancelAppointment.isPending &&
                      styles.keepButtonHovered,
                    pressed && !cancelAppointment.isPending && styles.pressed,
                    cancelAppointment.isPending && styles.disabled,
                  ]}
                >
                  <Text style={styles.keepButtonText}>
                    Garder le rendez-vous
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={
                    appointmentToCancel === null ||
                    cancelAppointment.isPending
                  }
                  onPress={() => {
                    if (appointmentToCancel !== null) {
                      cancelAppointment.mutate(appointmentToCancel);
                    }
                  }}
                  style={({ hovered, pressed }) => [
                    styles.confirmCancelButton,
                    hovered &&
                      !cancelAppointment.isPending &&
                      styles.confirmCancelButtonHovered,
                    pressed && !cancelAppointment.isPending && styles.pressed,
                    cancelAppointment.isPending && styles.disabled,
                  ]}
                >
                  <Text style={styles.confirmCancelButtonText}>
                    {cancelAppointment.isPending
                      ? 'Annulation...'
                      : 'Oui, annuler'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </PageContainer>
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
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryDetail}>{detail}</Text>
    </View>
  );
}

type AppointmentCardProps = {
  appointment: AppointmentListItem;
  isCancelling: boolean;
  onCancel: () => void;
};

function AppointmentCard({
  appointment,
  isCancelling,
  onCancel,
}: AppointmentCardProps) {
  const isPending = normalizeStatus(appointment.status) === 'pending';
  const isCancelled = normalizeStatus(appointment.status) === 'cancelled';

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.vehicleName}>{appointment.vehicle}</Text>
          <Text style={styles.registrationNumber}>
            {appointment.registrationNumber}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            isPending && styles.statusPending,
            isCancelled && styles.statusCancelled,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isPending && styles.statusTextPending,
              isCancelled && styles.statusTextCancelled,
            ]}
          >
            {getStatusLabel(appointment.status)}
          </Text>
        </View>
      </View>

      <View style={styles.detailGrid}>
        <DetailLine label="Service" value={appointment.serviceType} />
        <DetailLine label="Atelier" value={appointment.workshop} />
        <DetailLine label="Date" value={appointment.requestedDate} />
        <DetailLine label="Heure" value={appointment.requestedTime} />
        <DetailLine label="Commentaire" value={appointment.comment} />
      </View>

      {isPending ? (
        <Pressable
          accessibilityRole="button"
          disabled={isCancelling}
          onPress={onCancel}
          style={({ hovered, pressed }) => [
            styles.cancelButton,
            hovered && !isCancelling && styles.cancelButtonHovered,
            pressed && !isCancelling && styles.pressed,
            isCancelling && styles.disabled,
          ]}
        >
          <Text style={styles.cancelButtonText}>
            {isCancelling ? 'Annulation...' : 'Annuler le rendez-vous'}
          </Text>
        </Pressable>
      ) : null}
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

  disabled: {
    opacity: 0.5,
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
    minHeight: 126,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
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

  appointmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  appointmentCard: {
    flexGrow: 1,
    flexBasis: 360,
    minWidth: 300,
    maxWidth: 560,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  cardHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },

  vehicleName: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  registrationNumber: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
  },

  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#D7DFEA',
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
  },

  statusPending: {
    borderColor: '#E8CE98',
    backgroundColor: '#FFF8E8',
  },

  statusCancelled: {
    borderColor: '#E4B8B8',
    backgroundColor: '#FFF3F3',
  },

  statusText: {
    color: '#526174',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  statusTextPending: {
    color: '#9A6700',
  },

  statusTextCancelled: {
    color: '#B42318',
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

  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#E3B6B2',
    borderRadius: 14,
    backgroundColor: '#FFF8F7',
  },

  cancelButtonHovered: {
    borderColor: '#D98F88',
    backgroundColor: '#FFF1EF',
  },

  cancelButtonText: {
    color: '#B42318',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(7, 24, 50, 0.48)',
  },

  confirmationModal: {
    width: '100%',
    maxWidth: 500,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 22,
    },
    shadowOpacity: 0.24,
    shadowRadius: 42,
    elevation: 12,
  },

  modalEyebrow: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  modalTitle: {
    color: '#071832',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  modalMessage: {
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  keepButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#C8D5E6',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  keepButtonHovered: {
    backgroundColor: '#F4F8FD',
  },

  keepButtonText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  confirmCancelButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: '#B42318',
    shadowColor: '#B42318',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },

  confirmCancelButtonHovered: {
    backgroundColor: '#922018',
  },

  confirmCancelButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  successBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#B7D5C0',
    borderRadius: 16,
    backgroundColor: '#F0F9F3',
    gap: spacing.xs,
  },

  successTitle: {
    color: '#166534',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  successText: {
    color: '#2F6F45',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  errorBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E9B8B8',
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    gap: spacing.xs,
  },

  errorTitle: {
    color: '#B42318',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  errorText: {
    color: '#8F2D24',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  emptyPanel: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: spacing.sm,
  },

  emptyTitle: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  emptyText: {
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
});
