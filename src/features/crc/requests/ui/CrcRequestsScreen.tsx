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
import type { CrcAppointmentQueue } from '@/core/api/crc-appointments.api';
import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import {
  useCrcAppointment,
  useCrcAppointments,
} from '@/features/crc/requests/hooks/useCrcAppointments';
import {
  CRC_QUEUE_TABS,
  getCrcQueueTab,
  presentCrcAppointment,
  type CrcAppointmentViewModel,
  type CrcStatusTone,
} from '@/features/crc/requests/model/crc-appointment.presenter';
import { CrcPortalLayout } from '@/features/crc/shared/ui/CrcPortalLayout';

type QueueTabsProps = {
  activeQueue: CrcAppointmentQueue;
  onQueueChange: (queue: CrcAppointmentQueue) => void;
};

function QueueTabs({ activeQueue, onQueueChange }: QueueTabsProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.tabsContent}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsScroll}
    >
      {CRC_QUEUE_TABS.map((tab) => {
        const isActive = tab.queue === activeQueue;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={tab.queue}
            onPress={() => onQueueChange(tab.queue)}
            style={({ hovered, pressed }) => [
              styles.tab,
              isActive && styles.tabActive,
              hovered && !isActive && styles.tabHovered,
              pressed && styles.controlPressed,
            ]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function getStatusToneStyle(tone: CrcStatusTone) {
  switch (tone) {
    case 'danger':
      return styles.statusDanger;
    case 'info':
      return styles.statusInfo;
    case 'success':
      return styles.statusSuccess;
    case 'warning':
      return styles.statusWarning;
    default:
      return styles.statusMuted;
  }
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: CrcStatusTone;
}) {
  return (
    <View style={[styles.statusBadge, getStatusToneStyle(tone)]}>
      <Text style={styles.statusBadgeText}>{label}</Text>
    </View>
  );
}

type RequestRowProps = {
  appointment: CrcAppointmentViewModel;
  isSelected: boolean;
  onSelect: (appointmentId: number) => void;
};

function RequestRow({
  appointment,
  isSelected,
  onSelect,
}: RequestRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(appointment.id)}
      style={({ hovered, pressed }) => [
        styles.requestRow,
        isSelected && styles.requestRowSelected,
        hovered && !isSelected && styles.requestRowHovered,
        pressed && styles.controlPressed,
      ]}
    >
      <View style={styles.requestRowHeader}>
        <View style={styles.customerIdentity}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerAvatarText}>
              {appointment.customerInitials}
            </Text>
          </View>
          <View style={styles.customerCopy}>
            <Text numberOfLines={1} style={styles.customerName}>
              {appointment.customerName}
            </Text>
            <Text style={styles.requestReference}>{appointment.reference}</Text>
          </View>
        </View>
        <StatusBadge
          label={appointment.statusLabel}
          tone={appointment.statusTone}
        />
      </View>

      <View style={styles.requestMetadata}>
        <Text numberOfLines={1} style={styles.requestPrimaryMetadata}>
          {appointment.vehicleLabel}
        </Text>
        <Text numberOfLines={1} style={styles.requestMetadataText}>
          {appointment.serviceTypeName}
        </Text>
        <Text numberOfLines={1} style={styles.requestMetadataText}>
          {appointment.requestedSlot}
        </Text>
      </View>
    </Pressable>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function AppointmentDetail({
  appointment,
  isCompact,
}: {
  appointment: CrcAppointmentViewModel;
  isCompact: boolean;
}) {
  return (
    <View style={styles.detailContent}>
      <View style={styles.detailHeading}>
        <View style={styles.detailHeadingCopy}>
          <Text style={styles.detailEyebrow}>{appointment.reference}</Text>
          <Text style={styles.detailTitle}>{appointment.customerName}</Text>
          <Text style={styles.detailSubtitle}>{appointment.requestedSlot}</Text>
        </View>
        <StatusBadge
          label={appointment.statusLabel}
          tone={appointment.statusTone}
        />
      </View>

      <View style={styles.summaryBlock}>
        <Text style={styles.sectionTitle}>Motif de la demande</Text>
        <Text selectable style={styles.summaryText}>
          {appointment.problemSummary}
        </Text>
      </View>

      <View style={[styles.detailGrid, isCompact && styles.detailGridCompact]}>
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Client</Text>
          <DetailLine label="Téléphone" value={appointment.customerPhone} />
          <DetailLine label="Email" value={appointment.customerEmail} />
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Véhicule</Text>
          <DetailLine label="Modèle" value={appointment.vehicleLabel} />
          <DetailLine
            label="Immatriculation"
            value={appointment.registrationNumber}
          />
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Intervention demandée</Text>
          <DetailLine label="Service" value={appointment.serviceTypeName} />
          <DetailLine label="Créneau" value={appointment.requestedSlot} />
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Site</Text>
          <DetailLine label="Atelier" value={appointment.workshopName} />
          <DetailLine label="Showroom" value={appointment.showroomName} />
          <DetailLine label="Localisation" value={appointment.locationLabel} />
        </View>
      </View>
    </View>
  );
}

function RetryEmptyState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.emptyStateContainer}>
      <EmptyState message={message} title={title} />
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ hovered, pressed }) => [
          styles.retryButton,
          hovered && styles.retryButtonHovered,
          pressed && styles.controlPressed,
        ]}
      >
        <Text style={styles.retryButtonText}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

export function CrcRequestsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.desktop;
  const [queue, setQueue] = useState<CrcAppointmentQueue>('new');
  const [requestedAppointmentId, setRequestedAppointmentId] = useState<
    number | null
  >(null);
  const appointmentsQuery = useCrcAppointments(queue);
  const appointments = useMemo(
    () => (appointmentsQuery.data ?? []).map(presentCrcAppointment),
    [appointmentsQuery.data]
  );
  const selectedAppointmentId = appointments.some(
    (appointment) => appointment.id === requestedAppointmentId
  )
    ? requestedAppointmentId
    : (appointments[0]?.id ?? null);
  const appointmentDetailQuery = useCrcAppointment(selectedAppointmentId);
  const selectedAppointment = appointmentDetailQuery.data
    ? presentCrcAppointment(appointmentDetailQuery.data)
    : null;
  const activeQueue = getCrcQueueTab(queue);

  const handleQueueChange = (nextQueue: CrcAppointmentQueue) => {
    setRequestedAppointmentId(null);
    setQueue(nextQueue);
  };

  return (
    <CrcPortalLayout>
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        style={styles.pageScroll}
      >
        <View style={styles.pageHeading}>
          <View style={styles.pageHeadingCopy}>
            <Text style={styles.pageEyebrow}>GESTION DES DEMANDES</Text>
            <Text style={styles.pageTitle}>File des rendez-vous</Text>
            <Text style={styles.pageSubtitle}>
              Consultation centralisée des demandes clients transmises au CRC.
            </Text>
          </View>
          <View style={styles.countCard}>
            <Text style={styles.countValue}>{appointments.length}</Text>
            <Text style={styles.countLabel}>
              {appointments.length > 1 ? 'demandes' : 'demande'}
            </Text>
          </View>
        </View>

        <QueueTabs activeQueue={queue} onQueueChange={handleQueueChange} />

        <View style={[styles.workspace, isCompact && styles.workspaceCompact]}>
          <View style={[styles.listPanel, isCompact && styles.panelCompact]}>
            <View style={styles.panelHeading}>
              <View>
                <Text style={styles.panelTitle}>{activeQueue.label}</Text>
                <Text style={styles.panelSubtitle}>
                  Sélectionnez une demande pour consulter son détail.
                </Text>
              </View>
            </View>

            {appointmentsQuery.isLoading ? (
              <View style={styles.stateContainer}>
                <LoadingState message="Chargement de la file CRC..." />
              </View>
            ) : appointmentsQuery.isError ? (
              <View style={styles.stateContainer}>
                <ErrorState
                  message="Les demandes CRC ne peuvent pas être chargées pour le moment."
                  onRetry={() => {
                    void appointmentsQuery.refetch();
                  }}
                  title="File temporairement indisponible"
                />
              </View>
            ) : appointments.length === 0 ? (
              <RetryEmptyState
                message={activeQueue.emptyMessage}
                onRetry={() => {
                  void appointmentsQuery.refetch();
                }}
                title={activeQueue.emptyTitle}
              />
            ) : (
              <View style={styles.requestList}>
                {appointments.map((appointment) => (
                  <RequestRow
                    appointment={appointment}
                    isSelected={appointment.id === selectedAppointmentId}
                    key={appointment.id}
                    onSelect={setRequestedAppointmentId}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={[styles.detailPanel, isCompact && styles.panelCompact]}>
            {selectedAppointmentId === null ? (
              <View style={styles.stateContainer}>
                <EmptyState
                  message="Choisissez une demande dans la liste pour afficher toutes les informations disponibles."
                  title="Aucune demande sélectionnée"
                />
              </View>
            ) : appointmentDetailQuery.isLoading ? (
              <View style={styles.stateContainer}>
                <LoadingState message="Chargement du détail..." />
              </View>
            ) : appointmentDetailQuery.isError ? (
              <View style={styles.stateContainer}>
                <ErrorState
                  message="Le détail de cette demande ne peut pas être chargé."
                  onRetry={() => {
                    void appointmentDetailQuery.refetch();
                  }}
                  title="Détail indisponible"
                />
              </View>
            ) : selectedAppointment ? (
              <AppointmentDetail
                appointment={selectedAppointment}
                isCompact={isCompact}
              />
            ) : (
              <RetryEmptyState
                message="La demande sélectionnée ne contient aucune donnée exploitable."
                onRetry={() => {
                  void appointmentDetailQuery.refetch();
                }}
                title="Détail vide"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </CrcPortalLayout>
  );
}

const styles = StyleSheet.create({
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  pageHeadingCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  pageEyebrow: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    letterSpacing: 1.2,
  },
  pageTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  pageSubtitle: {
    maxWidth: 720,
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  countCard: {
    minWidth: 128,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.md,
    backgroundColor: colors.light.background.primary,
    alignItems: 'center',
  },
  countValue: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  countLabel: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  tabsScroll: {
    flexGrow: 0,
  },
  tabsContent: {
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    gap: spacing.xs,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.light.brand.primary,
  },
  tabHovered: {
    backgroundColor: colors.light.background.muted,
  },
  tabText: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  tabTextActive: {
    color: colors.light.text.inverse,
    fontWeight: typography.fontWeight.semiBold,
  },
  controlPressed: {
    opacity: 0.8,
  },
  workspace: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  workspaceCompact: {
    flexDirection: 'column',
  },
  listPanel: {
    width: 430,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.md,
    backgroundColor: colors.light.background.primary,
    overflow: 'hidden',
  },
  detailPanel: {
    flex: 1,
    minHeight: 520,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.md,
    backgroundColor: colors.light.background.primary,
    overflow: 'hidden',
  },
  panelCompact: {
    width: '100%',
  },
  panelHeading: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border.default,
  },
  panelTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
  },
  panelSubtitle: {
    marginTop: spacing.xs,
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  requestList: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  requestRow: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    gap: spacing.md,
  },
  requestRowSelected: {
    borderColor: colors.light.brand.primary,
    backgroundColor: colors.light.background.muted,
  },
  requestRowHovered: {
    borderColor: colors.light.border.strong,
    backgroundColor: colors.light.background.secondary,
  },
  requestRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  customerIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    color: colors.light.text.inverse,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  customerCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
  },
  customerName: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  requestReference: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.xs,
  },
  requestMetadata: {
    paddingLeft: spacing.xl + spacing.md,
    gap: spacing.xs,
  },
  requestPrimaryMetadata: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  requestMetadataText: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
  },
  statusBadge: {
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    borderWidth: 1,
  },
  statusBadgeText: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  statusDanger: {
    borderColor: colors.light.status.danger,
    backgroundColor: colors.light.background.secondary,
  },
  statusInfo: {
    borderColor: colors.light.status.info,
    backgroundColor: colors.light.background.secondary,
  },
  statusSuccess: {
    borderColor: colors.light.status.success,
    backgroundColor: colors.light.background.secondary,
  },
  statusWarning: {
    borderColor: colors.light.status.warning,
    backgroundColor: colors.light.background.secondary,
  },
  statusMuted: {
    borderColor: colors.light.border.strong,
    backgroundColor: colors.light.background.muted,
  },
  detailContent: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  detailHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailHeadingCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
  },
  detailEyebrow: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  detailTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.fontWeight.bold,
  },
  detailSubtitle: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  summaryBlock: {
    padding: spacing.lg,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.sm,
  },
  summaryText: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  sectionTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailGridCompact: {
    flexDirection: 'column',
  },
  detailSection: {
    minWidth: 260,
    flex: 1,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    gap: spacing.md,
  },
  detailLine: {
    gap: spacing.xs,
  },
  detailLabel: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.xs,
  },
  detailValue: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  stateContainer: {
    minHeight: 280,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  emptyStateContainer: {
    minHeight: 280,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.brand.primary,
  },
  retryButtonHovered: {
    backgroundColor: colors.light.brand.secondary,
  },
  retryButtonText: {
    color: colors.light.text.inverse,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
});
