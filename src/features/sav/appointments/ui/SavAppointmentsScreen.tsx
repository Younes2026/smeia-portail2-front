import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { notificationsApi } from '@/core/api/notifications.api';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import {
  useCancelSavAppointment,
  useConfirmAppointmentArrival,
  useCreateRepairFromAppointment,
  useSavAppointments,
} from '@/features/sav/appointments/hooks/useSavAppointments';
import { useSavAppointmentsPresentation } from '@/features/sav/appointments/hooks/useSavAppointmentsPresentation';
import {
  isSavAppointmentInPeriod,
  normalizeSavAppointmentSearch,
  type SavAppointmentPeriod,
  type SavAppointmentSort,
  type SavAppointmentStatusKey,
  type SavAppointmentViewModel,
} from '@/features/sav/appointments/model/sav-appointment.presenter';
import { SavPortalLayout } from '@/features/sav/shared/ui/SavPortalLayout';
import { getBrandLogo } from '@/features/vehicles/model/brand-logo';
import { useAuthStore } from '@/store/auth.store';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type StatusFilter = 'all' | SavAppointmentStatusKey;

const periodFilters: ReadonlyArray<{
  label: string;
  value: SavAppointmentPeriod;
}> = [
  { label: 'Aujourd’hui', value: 'today' },
  { label: 'Demain', value: 'tomorrow' },
  { label: 'Cette semaine', value: 'week' },
  { label: 'Tous les rendez-vous', value: 'all' },
];

const statusFilters: ReadonlyArray<{ label: string; value: StatusFilter }> = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'En attente', value: 'pending' },
  { label: 'Confirmés', value: 'confirmed' },
  { label: 'Véhicules réceptionnés', value: 'received' },
  { label: 'Annulés', value: 'cancelled' },
];

function getRelationId(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  if (typeof value === 'object' && value !== null && 'id' in value) {
    if (typeof value.id === 'number') return value.id;
    if (typeof value.id === 'string' && /^\d+$/.test(value.id)) {
      return Number(value.id);
    }
  }

  return null;
}

function hasRepairLinkedToAppointment(
  appointment: SavAppointmentViewModel
): boolean {
  return appointment.hasLinkedRepair;
}

function formatToday(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function SavAppointmentsScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < breakpoints.tablet;
  const workshopName =
    useAuthStore((state) => state.savAgent?.workshopName)?.trim() || 'Atelier SAV';
  const appointmentsQuery = useSavAppointments();
  const appointmentsPresentation = useSavAppointmentsPresentation(
    appointmentsQuery.data ?? []
  );
  const appointments = appointmentsPresentation.data;
  const confirmArrival = useConfirmAppointmentArrival();
  const cancelAppointment = useCancelSavAppointment();
  const createRepair = useCreateRepairFromAppointment();
  const notifiedArrivalAppointmentIds = useRef<Set<string>>(new Set());
  const createdRepairAppointmentIds = useRef<Set<string>>(new Set());
  const [periodFilter, setPeriodFilter] = useState<SavAppointmentPeriod>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SavAppointmentSort>('ascending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const normalizedSearch = normalizeSavAppointmentSearch(searchQuery);
  const filteredAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            isSavAppointmentInPeriod(appointment, periodFilter) &&
            (statusFilter === 'all' || appointment.statusKey === statusFilter) &&
            (!normalizedSearch || appointment.searchText.includes(normalizedSearch))
        )
        .sort((first, second) =>
          sort === 'ascending'
            ? first.timestamp - second.timestamp
            : second.timestamp - first.timestamp
        ),
    [appointments, normalizedSearch, periodFilter, sort, statusFilter]
  );
  const selectedAppointment =
    appointments.find((appointment) => appointment.id === selectedAppointmentId) ??
    filteredAppointments[0] ??
    null;
  const repairAlreadyCreated =
    selectedAppointment !== null &&
    (hasRepairLinkedToAppointment(selectedAppointment) ||
      createdRepairAppointmentIds.current.has(selectedAppointment.id));
  const canConfirmArrival =
    selectedAppointment !== null &&
    selectedAppointment.statusKey !== 'cancelled' &&
    selectedAppointment.arrivalConfirmedAt === null &&
    !repairAlreadyCreated &&
    !confirmArrival.isPending;
  const canCancelAppointment =
    selectedAppointment !== null &&
    selectedAppointment.statusKey !== 'cancelled' &&
    selectedAppointment.arrivalConfirmedAt === null &&
    !repairAlreadyCreated &&
    !cancelAppointment.isPending;
  const canCreateRepair =
    selectedAppointment !== null &&
    selectedAppointment.arrivalConfirmedAt !== null &&
    selectedAppointment.statusKey !== 'cancelled' &&
    !repairAlreadyCreated &&
    !createRepair.isPending;
  const todayMetrics = useMemo(() => {
    const todayAppointments = appointments.filter((appointment) =>
      isSavAppointmentInPeriod(appointment, 'today')
    );

    return {
      today: todayAppointments.length,
      arrivals: todayAppointments.filter(
        (appointment) =>
          appointment.arrivalConfirmedAt === null &&
          appointment.statusKey !== 'cancelled'
      ).length,
      received: todayAppointments.filter(
        (appointment) => appointment.statusKey === 'received'
      ).length,
      cancelled: todayAppointments.filter(
        (appointment) => appointment.statusKey === 'cancelled'
      ).length,
    };
  }, [appointments]);

  const resetActions = () => {
    setCancelModalVisible(false);
    setCancellationReason('');
    setCancellationError(null);
    confirmArrival.reset();
    cancelAppointment.reset();
    createRepair.reset();
    setActionMessage(null);
  };

  const handleSelectAppointment = (appointment: SavAppointmentViewModel) => {
    setSelectedAppointmentId(appointment.id);
    resetActions();
    if (isMobile) setDetailVisible(true);
  };

  const handleConfirmArrival = () => {
    if (!canConfirmArrival || selectedAppointment === null) return;

    const appointmentToConfirm = selectedAppointment.raw;
    const appointmentNotificationKey = selectedAppointment.id;
    const customerId = getRelationId(appointmentToConfirm.customer_id);

    setActionMessage(null);
    confirmArrival.mutate(appointmentToConfirm.id, {
      onSuccess: async () => {
        if (notifiedArrivalAppointmentIds.current.has(appointmentNotificationKey)) {
          setActionMessage('Arrivée client confirmée. Notification déjà envoyée.');
          return;
        }

        if (customerId === null) {
          console.error(
            'Notification arrivée non créée : client du rendez-vous introuvable',
            appointmentToConfirm
          );
          setActionMessage(
            'Arrivée confirmée, mais notification client non envoyée.'
          );
          return;
        }

        try {
          await notificationsApi.createNotification({
            appointmentId: appointmentToConfirm.id,
            customerId,
            title: 'Véhicule réceptionné',
            message:
              'Votre véhicule a été réceptionné à l’atelier SMEIA. Nos équipes SAV vont procéder aux premières vérifications et vous tiendront informé de l’avancement.',
            type: 'arrival_confirmed',
          });
          notifiedArrivalAppointmentIds.current.add(appointmentNotificationKey);
          setActionMessage(
            'Arrivée client confirmée. Notification client envoyée.'
          );
        } catch (error) {
          console.error('Erreur création notification arrivée confirmée', error);
          setActionMessage(
            'Arrivée confirmée, mais notification client non envoyée.'
          );
        }
      },
    });
  };

  const handleOpenCancelModal = () => {
    if (!canCancelAppointment || selectedAppointment === null) return;

    setCancellationReason('');
    setCancellationError(null);
    cancelAppointment.reset();
    setActionMessage(null);
    setCancelModalVisible(true);
  };

  const handleCloseCancelModal = () => {
    if (cancelAppointment.isPending) return;

    setCancelModalVisible(false);
    setCancellationReason('');
    setCancellationError(null);
    cancelAppointment.reset();
  };

  const handleCreateRepair = () => {
    if (selectedAppointment === null) return;

    if (repairAlreadyCreated) {
      setActionMessage('Un dossier réparation est déjà associé.');
      return;
    }

    if (!canCreateRepair) return;

    const raw = selectedAppointment.raw;
    const customerId = getRelationId(raw.customer_id);
    const vehicleId = getRelationId(raw.vehicle_id);
    const serviceTypeId = getRelationId(raw.service_type_id);
    const workshopId = getRelationId(raw.workshop_id);

    if (
      customerId === null ||
      vehicleId === null ||
      serviceTypeId === null ||
      workshopId === null
    ) {
      setActionMessage(
        'Dossier réparation non créé : informations rendez-vous incomplètes.'
      );
      return;
    }

    setActionMessage(null);
    createRepair.mutate(
      {
        appointmentId: raw.id,
        customerId,
        serviceTypeId,
        vehicleId,
        workshopId,
      },
      {
        onSuccess: ({ alreadyExists }) => {
          createdRepairAppointmentIds.current.add(selectedAppointment.id);
          setActionMessage(
            alreadyExists
              ? 'Un dossier réparation est déjà associé.'
              : 'Dossier réparation créé avec succès.'
          );
        },
      }
    );
  };

  const handleCancelAppointment = () => {
    if (!canCancelAppointment || selectedAppointment === null) return;

    const normalizedReason = cancellationReason.trim();

    if (!normalizedReason) {
      setCancellationError('La raison d’annulation est obligatoire.');
      return;
    }

    setCancellationError(null);
    setActionMessage(null);
    cancelAppointment.mutate(
      {
        appointmentId: selectedAppointment.raw.id,
        cancellationReason: normalizedReason,
      },
      {
        onSuccess: () => {
          setCancelModalVisible(false);
          setCancellationReason('');
          setCancellationError(null);
          setActionMessage('Rendez-vous annulé avec le motif indiqué.');
        },
      }
    );
  };

  if (appointmentsQuery.isLoading || appointmentsPresentation.isLoading) {
    return (
      <SavPortalLayout activeRoute="/sav/appointments">
        <AppointmentsSkeleton isMobile={isMobile} />
      </SavPortalLayout>
    );
  }

  if (appointmentsQuery.isError) {
    return (
      <SavPortalLayout activeRoute="/sav/appointments">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Agenda temporairement indisponible"
            message="Les rendez-vous de votre atelier ne peuvent pas être chargés pour le moment."
            onRetry={() => {
              void appointmentsQuery.refetch();
            }}
          />
        </View>
      </SavPortalLayout>
    );
  }

  const actionError =
    confirmArrival.error?.message ??
    cancelAppointment.error?.message ??
    createRepair.error?.message ??
    null;

  return (
    <SavPortalLayout activeRoute="/sav/appointments">
      <View style={styles.page}>
        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator
        >
          <AppointmentsHeader
            count={filteredAppointments.length}
            isMobile={isMobile}
            workshopName={workshopName}
          />
          <MetricsRow metrics={todayMetrics} />
          <FilterToolbar
            period={periodFilter}
            searchQuery={searchQuery}
            sort={sort}
            status={statusFilter}
            onPeriodChange={setPeriodFilter}
            onSearchChange={setSearchQuery}
            onSortChange={setSort}
            onStatusChange={setStatusFilter}
          />

          {appointments.length === 0 ? (
            <EmptyAgenda
              text="Aucun rendez-vous n’est actuellement affecté à votre atelier."
            />
          ) : filteredAppointments.length === 0 ? (
            <EmptyAgenda
              text={
                periodFilter === 'today' && !normalizedSearch && statusFilter === 'all'
                  ? 'Aucun rendez-vous prévu aujourd’hui dans votre atelier.'
                  : 'Aucun rendez-vous ne correspond aux filtres sélectionnés.'
              }
            />
          ) : (
            <View style={[styles.workspace, isMobile && styles.workspaceMobile]}>
              <View style={styles.queuePanel}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelEyebrow}>FILE DE RÉCEPTION</Text>
                    <Text style={styles.panelTitle}>Rendez-vous à traiter</Text>
                  </View>
                  <Text style={styles.panelMeta}>{filteredAppointments.length}</Text>
                </View>
                <View style={styles.appointmentList}>
                  {filteredAppointments.map((appointment) => (
                    <AppointmentRow
                      active={appointment.id === selectedAppointment?.id}
                      appointment={appointment}
                      key={appointment.id}
                      onPress={() => {
                        handleSelectAppointment(appointment);
                      }}
                    />
                  ))}
                </View>
              </View>

              {!isMobile ? (
                <View style={styles.detailPanel}>
                  <ScrollView
                    contentContainerStyle={styles.detailScrollContent}
                    showsVerticalScrollIndicator
                  >
                    {selectedAppointment ? (
                      <AppointmentDetail
                        actionError={actionError}
                        actionMessage={actionMessage}
                        appointment={selectedAppointment}
                        canCancel={canCancelAppointment}
                        canConfirm={canConfirmArrival}
                        canCreateRepair={canCreateRepair}
                        isCancelling={cancelAppointment.isPending}
                        isConfirming={confirmArrival.isPending}
                        isCreatingRepair={createRepair.isPending}
                        onCancel={handleOpenCancelModal}
                        onConfirm={handleConfirmArrival}
                        onCreateRepair={handleCreateRepair}
                        repairAlreadyCreated={repairAlreadyCreated}
                      />
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>

      <AppointmentDetailModal
        visible={isMobile && detailVisible && selectedAppointment !== null}
        onClose={() => {
          setDetailVisible(false);
        }}
      >
        {selectedAppointment ? (
          <AppointmentDetail
            actionError={actionError}
            actionMessage={actionMessage}
            appointment={selectedAppointment}
            canCancel={canCancelAppointment}
            canConfirm={canConfirmArrival}
            canCreateRepair={canCreateRepair}
            isCancelling={cancelAppointment.isPending}
            isConfirming={confirmArrival.isPending}
            isCreatingRepair={createRepair.isPending}
            onCancel={handleOpenCancelModal}
            onConfirm={handleConfirmArrival}
            onCreateRepair={handleCreateRepair}
            repairAlreadyCreated={repairAlreadyCreated}
          />
        ) : null}
      </AppointmentDetailModal>

      <CancelAppointmentModal
        appointment={selectedAppointment}
        errorMessage={cancellationError ?? cancelAppointment.error?.message ?? null}
        isCancelling={cancelAppointment.isPending}
        onClose={handleCloseCancelModal}
        onReasonChange={(reason) => {
          setCancellationReason(reason);
          if (cancellationError !== null && reason.trim()) setCancellationError(null);
          if (cancelAppointment.error !== null) cancelAppointment.reset();
        }}
        onSubmit={handleCancelAppointment}
        reason={cancellationReason}
        visible={cancelModalVisible && selectedAppointment !== null}
      />
    </SavPortalLayout>
  );
}

function AppointmentsHeader({
  count,
  isMobile,
  workshopName,
}: {
  count: number;
  isMobile: boolean;
  workshopName: string;
}) {
  return (
    <View style={[styles.header, isMobile && styles.headerMobile]}>
      <View style={styles.headerCopy}>
        <Text style={styles.headerEyebrow}>RÉCEPTION ATELIER</Text>
        <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>
          Agenda des rendez-vous
        </Text>
        <View style={styles.headerMetaRow}>
          <Text style={styles.workshopName}>{workshopName}</Text>
          <Text style={styles.metaSeparator}>•</Text>
          <Text style={styles.todayLabel}>{formatToday(new Date())}</Text>
        </View>
      </View>
      <View style={styles.resultBadge}>
        <Text style={styles.resultValue}>{count}</Text>
        <Text style={styles.resultLabel}>{count === 1 ? 'résultat' : 'résultats'}</Text>
      </View>
    </View>
  );
}

function MetricsRow({
  metrics,
}: {
  metrics: { today: number; arrivals: number; received: number; cancelled: number };
}) {
  const items = [
    { label: 'Aujourd’hui', value: metrics.today, tone: 'info' },
    { label: 'Arrivées à confirmer', value: metrics.arrivals, tone: 'warning' },
    { label: 'Véhicules réceptionnés', value: metrics.received, tone: 'success' },
    { label: 'Annulés', value: metrics.cancelled, tone: 'danger' },
  ] as const;

  return (
    <View style={styles.metricsRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.metricItem}>
          <View
            style={[
              styles.metricDot,
              item.tone === 'warning' && styles.metricDotWarning,
              item.tone === 'success' && styles.metricDotSuccess,
              item.tone === 'danger' && styles.metricDotDanger,
            ]}
          />
          <View>
            <Text style={styles.metricValue}>{item.value}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function FilterToolbar({
  onPeriodChange,
  onSearchChange,
  onSortChange,
  onStatusChange,
  period,
  searchQuery,
  sort,
  status,
}: {
  onPeriodChange: (value: SavAppointmentPeriod) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SavAppointmentSort) => void;
  onStatusChange: (value: StatusFilter) => void;
  period: SavAppointmentPeriod;
  searchQuery: string;
  sort: SavAppointmentSort;
  status: StatusFilter;
}) {
  return (
    <View style={styles.filterPanel}>
      <ScrollView
        horizontal
        contentContainerStyle={styles.periodTabs}
        showsHorizontalScrollIndicator={false}
      >
        {periodFilters.map((item) => (
          <FilterPill
            active={period === item.value}
            key={item.value}
            label={item.label}
            onPress={() => onPeriodChange(item.value)}
          />
        ))}
      </ScrollView>
      <View style={styles.filterTools}>
        <View style={styles.searchBox}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={17}
            tintColor="#7A8798"
          />
          <TextInput
            onChangeText={onSearchChange}
            placeholder="Rechercher un client, véhicule, service..."
            placeholderTextColor="#8A97A8"
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>
        <ScrollView
          horizontal
          contentContainerStyle={styles.statusTabs}
          showsHorizontalScrollIndicator={false}
        >
          {statusFilters.map((item) => (
            <FilterPill
              active={status === item.value}
              key={item.value}
              label={item.label}
              onPress={() => onStatusChange(item.value)}
              small
            />
          ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            onSortChange(sort === 'ascending' ? 'descending' : 'ascending')
          }
          style={({ hovered, pressed }) => [
            styles.sortButton,
            hovered && styles.controlHovered,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{ ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' }}
            size={16}
            tintColor="#2F5FA6"
          />
          <Text style={styles.sortButtonText}>
            {sort === 'ascending' ? 'Plus proche' : 'Plus récent'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FilterPill({
  active,
  label,
  onPress,
  small = false,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.filterPill,
        small && styles.filterPillSmall,
        active && styles.filterPillActive,
        hovered && !active && styles.controlHovered,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AppointmentRow({
  active,
  appointment,
  onPress,
}: {
  active: boolean;
  appointment: SavAppointmentViewModel;
  onPress: () => void;
}) {
  const logo = getBrandLogo(appointment.brandName);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.appointmentRow,
        active && styles.appointmentRowActive,
        hovered && !active && styles.appointmentRowHovered,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.timeBlock}>
        <Text style={styles.rowTime}>{appointment.timeLabel}</Text>
        <Text style={styles.rowDate}>{appointment.dateLabel}</Text>
      </View>
      <BrandMark brandName={appointment.brandName} logo={logo} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTopLine}>
          <Text numberOfLines={1} style={styles.rowCustomer}>
            {appointment.customerLabel}
          </Text>
          <StatusBadge statusKey={appointment.statusKey} text={appointment.statusLabel} />
        </View>
        <Text numberOfLines={1} style={styles.rowVehicle}>
          {appointment.vehicleLabel}
        </Text>
        <Text numberOfLines={1} style={styles.rowService}>
          {appointment.serviceLabel}
          {appointment.comment ? ` • ${appointment.comment}` : ''}
        </Text>
        <View style={styles.arrivalRow}>
          <SymbolView
            name={
              appointment.arrivalConfirmedAt
                ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                : { ios: 'clock', android: 'schedule', web: 'schedule' }
            }
            size={13}
            tintColor={appointment.arrivalConfirmedAt ? '#287F68' : '#B7791F'}
          />
          <Text style={styles.arrivalRowText}>
            {appointment.arrivalConfirmedAt ? 'Arrivée confirmée' : 'Arrivée à confirmer'}
          </Text>
        </View>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={17}
        tintColor="#7A8798"
      />
    </Pressable>
  );
}

function BrandMark({
  brandName,
  logo,
}: {
  brandName: string | null;
  logo: ReturnType<typeof getBrandLogo>;
}) {
  const lightLogo = logo && 'needsLightSurface' in logo && logo.needsLightSurface;

  return (
    <View style={[styles.brandMark, lightLogo && styles.brandMarkLight]}>
      {logo ? (
        <Image
          accessibilityLabel={`Logo ${logo.name}`}
          contentFit="contain"
          source={logo.source}
          style={styles.brandLogo}
        />
      ) : (
        <SymbolView
          name={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
          size={23}
          tintColor="#2F5FA6"
        />
      )}
    </View>
  );
}

function StatusBadge({
  statusKey,
  text,
}: {
  statusKey: SavAppointmentStatusKey;
  text: string;
}) {
  return (
    <View
      style={[
        styles.statusBadge,
        statusKey === 'pending' && styles.statusPending,
        statusKey === 'received' && styles.statusReceived,
        statusKey === 'cancelled' && styles.statusCancelled,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          statusKey === 'pending' && styles.statusTextPending,
          statusKey === 'received' && styles.statusTextReceived,
          statusKey === 'cancelled' && styles.statusTextCancelled,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function AppointmentDetail({
  actionError,
  actionMessage,
  appointment,
  canCancel,
  canConfirm,
  canCreateRepair,
  isCancelling,
  isConfirming,
  isCreatingRepair,
  onCancel,
  onConfirm,
  onCreateRepair,
  repairAlreadyCreated,
}: {
  actionError: string | null;
  actionMessage: string | null;
  appointment: SavAppointmentViewModel;
  canCancel: boolean;
  canConfirm: boolean;
  canCreateRepair: boolean;
  isCancelling: boolean;
  isConfirming: boolean;
  isCreatingRepair: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onCreateRepair: () => void;
  repairAlreadyCreated: boolean;
}) {
  const logo = getBrandLogo(appointment.brandName);
  const cancelled = appointment.statusKey === 'cancelled';
  const received = appointment.arrivalConfirmedAt !== null;

  return (
    <View style={styles.detailContent}>
      <View style={styles.detailHeader}>
        <BrandMark brandName={appointment.brandName} logo={logo} />
        <View style={styles.detailHeaderCopy}>
          <Text style={styles.detailReference}>{appointment.referenceLabel}</Text>
          <Text style={styles.detailCustomer}>{appointment.customerLabel}</Text>
          <Text style={styles.detailVehicle}>{appointment.vehicleLabel}</Text>
        </View>
        <StatusBadge statusKey={appointment.statusKey} text={appointment.statusLabel} />
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionEyebrow}>INFORMATIONS PRINCIPALES</Text>
        <DetailLine
          icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
          label="Date et heure"
          value={`${appointment.dateLabel} à ${appointment.timeLabel}`}
        />
        <DetailLine
          icon={{ ios: 'wrench', android: 'build', web: 'build' }}
          label="Prestation"
          value={appointment.serviceLabel}
        />
        <DetailLine
          icon={{ ios: 'building.2', android: 'store', web: 'store' }}
          label="Atelier"
          value={appointment.workshopLabel}
        />
        {appointment.phoneLabel ? (
          <DetailLine
            icon={{ ios: 'phone', android: 'call', web: 'call' }}
            label="Téléphone"
            value={appointment.phoneLabel}
          />
        ) : null}
        {appointment.emailLabel ? (
          <DetailLine
            icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
            label="Adresse e-mail"
            value={appointment.emailLabel}
          />
        ) : null}
        {appointment.comment ? (
          <DetailLine
            icon={{ ios: 'text.bubble', android: 'chat_bubble', web: 'chat_bubble' }}
            label="Commentaire client"
            value={appointment.comment}
          />
        ) : null}
        {appointment.cancellationReason ? (
          <DetailLine
            icon={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
            label="Motif d’annulation"
            value={appointment.cancellationReason}
          />
        ) : null}
      </View>

      <View style={styles.actionsPanel}>
        <Text style={styles.actionsTitle}>Prochaine action</Text>

        {actionMessage ? (
          <View style={styles.successMessage}>
            <Text style={styles.successMessageText}>{actionMessage}</Text>
          </View>
        ) : null}
        {actionError ? (
          <View style={styles.errorMessage}>
            <Text style={styles.errorMessageText}>{actionError}</Text>
          </View>
        ) : null}

        {cancelled ? (
          <View style={styles.cancelledMessage}>
            <Text style={styles.cancelledMessageTitle}>Rendez-vous annulé</Text>
            {appointment.cancellationReason ? (
              <Text style={styles.cancelledMessageText}>
                {appointment.cancellationReason}
              </Text>
            ) : null}
          </View>
        ) : received ? (
          <>
            <View style={styles.receivedMessage}>
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                size={20}
                tintColor="#287F68"
              />
              <Text style={styles.receivedMessageText}>
                Véhicule réceptionné{appointment.arrivalLabel ? ` le ${appointment.arrivalLabel}` : ''}.
              </Text>
            </View>
            {!repairAlreadyCreated ? (
              <ActionButton
                disabled={!canCreateRepair}
                icon={{ ios: 'doc.badge.plus', android: 'note_add', web: 'note_add' }}
                label={
                  isCreatingRepair
                    ? 'Création du dossier...'
                    : 'Créer le dossier réparation'
                }
                onPress={onCreateRepair}
              />
            ) : (
              <Link href="/sav/repairs" asChild>
                <Pressable
                  accessibilityRole="link"
                  style={({ hovered, pressed }) => [
                    styles.primaryAction,
                    hovered && styles.primaryActionHovered,
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={{ ios: 'wrench', android: 'build', web: 'build' }}
                    size={17}
                    tintColor="#FFFFFF"
                  />
                  <Text style={styles.primaryActionText}>Voir les réparations</Text>
                </Pressable>
              </Link>
            )}
          </>
        ) : repairAlreadyCreated ? (
          <View style={styles.actionButtons}>
            <View style={styles.receivedMessage}>
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                size={20}
                tintColor="#287F68"
              />
              <Text style={styles.receivedMessageText}>
                Un dossier réparation est déjà associé à ce rendez-vous.
              </Text>
            </View>
            <Link href="/sav/repairs" asChild>
              <Pressable
                accessibilityRole="link"
                style={({ hovered, pressed }) => [
                  styles.primaryAction,
                  hovered && styles.primaryActionHovered,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolView
                  name={{ ios: 'wrench', android: 'build', web: 'build' }}
                  size={17}
                  tintColor="#FFFFFF"
                />
                <Text style={styles.primaryActionText}>Voir les réparations</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <View style={styles.actionButtons}>
            <ActionButton
              disabled={!canConfirm}
              icon={{ ios: 'car.side.front.open', android: 'directions_car', web: 'directions_car' }}
              label={isConfirming ? 'Confirmation...' : 'Confirmer l’arrivée'}
              onPress={onConfirm}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!canCancel}
              onPress={onCancel}
              style={({ hovered, pressed }) => [
                styles.dangerAction,
                hovered && canCancel && styles.dangerActionHovered,
                pressed && canCancel && styles.pressed,
                !canCancel && styles.disabled,
              ]}
            >
              <SymbolView
                name={{ ios: 'xmark.circle', android: 'cancel', web: 'cancel' }}
                size={17}
                tintColor="#B42318"
              />
              <Text style={styles.dangerActionText}>
                {isCancelling ? 'Annulation...' : 'Annuler le rendez-vous'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon: SymbolName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailLine}>
      <View style={styles.detailIcon}>
        <SymbolView name={icon} size={17} tintColor="#2F5FA6" />
      </View>
      <View style={styles.detailLineCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled: boolean;
  icon: SymbolName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.primaryAction,
        hovered && !disabled && styles.primaryActionHovered,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <SymbolView name={icon} size={17} tintColor="#FFFFFF" />
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function AppointmentDetailModal({
  children,
  onClose,
  visible,
}: {
  children: React.ReactNode;
  onClose: () => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={styles.mobileModal}>
        <View style={styles.mobileModalHeader}>
          <Text style={styles.mobileModalTitle}>Fiche rendez-vous</Text>
          <Pressable
            accessibilityLabel="Fermer"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={18}
              tintColor="#15294D"
            />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.mobileModalContent}
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CancelAppointmentModal({
  appointment,
  errorMessage,
  isCancelling,
  onClose,
  onReasonChange,
  onSubmit,
  reason,
  visible,
}: {
  appointment: SavAppointmentViewModel | null;
  errorMessage: string | null;
  isCancelling: boolean;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  reason: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.cancelModalRoot}>
        <Pressable
          accessibilityLabel="Fermer l’annulation"
          accessibilityRole="button"
          disabled={isCancelling}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cancelModalCard}>
          <View style={styles.cancelModalHeader}>
            <Text style={styles.cancelModalEyebrow}>CONFIRMATION REQUISE</Text>
            <Text style={styles.cancelModalTitle}>Annuler ce rendez-vous</Text>
            {appointment ? (
              <Text style={styles.cancelModalSummary}>
                {appointment.referenceLabel} • {appointment.customerLabel} •{' '}
                {appointment.vehicleLabel}
              </Text>
            ) : null}
          </View>
          <View style={styles.reasonField}>
            <Text style={styles.fieldLabel}>Motif d’annulation</Text>
            <TextInput
              multiline
              numberOfLines={4}
              onChangeText={onReasonChange}
              placeholder="Indiquez le motif avant de confirmer..."
              placeholderTextColor="#8A97A8"
              style={styles.reasonInput}
              textAlignVertical="top"
              value={reason}
            />
          </View>
          {errorMessage ? (
            <View style={styles.errorMessage}>
              <Text style={styles.errorMessageText}>{errorMessage}</Text>
            </View>
          ) : null}
          <View style={styles.cancelModalActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isCancelling}
              onPress={onClose}
              style={({ hovered, pressed }) => [
                styles.secondaryAction,
                hovered && !isCancelling && styles.controlHovered,
                pressed && !isCancelling && styles.pressed,
                isCancelling && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryActionText}>Annuler l’action</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isCancelling}
              onPress={onSubmit}
              style={({ hovered, pressed }) => [
                styles.confirmCancelAction,
                hovered && !isCancelling && styles.confirmCancelActionHovered,
                pressed && !isCancelling && styles.pressed,
                isCancelling && styles.disabled,
              ]}
            >
              <Text style={styles.confirmCancelText}>
                {isCancelling ? 'Annulation...' : 'Confirmer l’annulation'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EmptyAgenda({ text }: { text: string }) {
  return (
    <View style={styles.emptyPanel}>
      <View style={styles.emptyIcon}>
        <SymbolView
          name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
          size={28}
          tintColor="#2F5FA6"
        />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function AppointmentsSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <View style={styles.skeletonPage}>
      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonMetrics} />
      <View style={[styles.skeletonWorkspace, isMobile && styles.workspaceMobile]}>
        <View style={styles.skeletonQueue} />
        {!isMobile ? <View style={styles.skeletonDetail} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F6FA' },
  pageScroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 1400,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  stateContainer: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  header: {
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  headerMobile: { minHeight: 0, alignItems: 'stretch', flexDirection: 'column' },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  headerEyebrow: { color: '#2F5FA6', fontSize: 11, fontWeight: '700' },
  headerTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    fontWeight: '700',
  },
  headerTitleMobile: {
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
  },
  headerMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  workshopName: { color: '#15294D', fontSize: 13, fontWeight: '700' },
  metaSeparator: { color: '#9AA5B4' },
  todayLabel: { color: '#5A6470', fontSize: 13 },
  resultBadge: {
    minWidth: 92,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#EDF3FA',
  },
  resultValue: { color: '#2F5FA6', fontSize: 22, fontWeight: '700' },
  resultLabel: { color: '#5A6470', fontSize: 10 },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  metricItem: {
    flex: 1,
    minWidth: 170,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metricDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2F5FA6' },
  metricDotWarning: { backgroundColor: '#B7791F' },
  metricDotSuccess: { backgroundColor: '#287F68' },
  metricDotDanger: { backgroundColor: '#B42318' },
  metricValue: { color: '#15294D', fontSize: 18, fontWeight: '700' },
  metricLabel: { color: '#5A6470', fontSize: 10 },
  filterPanel: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  periodTabs: { gap: 7 },
  filterTools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  searchBox: {
    minWidth: 250,
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: '#D8E0EA',
    borderRadius: 10,
    backgroundColor: '#F9FAFC',
  },
  searchInput: { flex: 1, minWidth: 0, color: '#15294D', fontSize: 12 },
  statusTabs: { gap: 6 },
  filterPill: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#D8E0EA',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  filterPillSmall: { minHeight: 34, paddingHorizontal: 10, paddingVertical: 6 },
  filterPillActive: { borderColor: '#2F5FA6', backgroundColor: '#2F5FA6' },
  filterPillText: { color: '#5A6470', fontSize: 11, fontWeight: '600' },
  filterPillTextActive: { color: '#FFFFFF' },
  sortButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: '#D8E0EA',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  sortButtonText: { color: '#2F5FA6', fontSize: 11, fontWeight: '700' },
  controlHovered: { borderColor: '#2F5FA6', backgroundColor: '#F3F7FC' },
  workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  workspaceMobile: { flexDirection: 'column' },
  queuePanel: {
    flex: 0.85,
    minWidth: 0,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  detailPanel: {
    flex: 1.25,
    minWidth: 0,
    maxHeight: 720,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  detailScrollContent: { padding: spacing.lg },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  panelEyebrow: { color: '#2F5FA6', fontSize: 10, fontWeight: '700' },
  panelTitle: { color: '#15294D', fontSize: 18, lineHeight: 24, fontWeight: '700' },
  panelMeta: { color: '#2F5FA6', fontSize: 16, fontWeight: '700' },
  appointmentList: { gap: 7 },
  appointmentRow: {
    minHeight: 106,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  appointmentRowActive: { borderColor: '#2F5FA6', backgroundColor: '#F3F7FC' },
  appointmentRowHovered: { borderColor: '#B8C9DF', backgroundColor: '#FAFBFD' },
  timeBlock: { width: 68, flexShrink: 0, gap: 3 },
  rowTime: { color: '#15294D', fontSize: 17, fontWeight: '700' },
  rowDate: { color: '#7A8798', fontSize: 9, lineHeight: 13 },
  brandMark: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 11,
    backgroundColor: '#EDF3FA',
  },
  brandMarkLight: { backgroundColor: '#FFFFFF' },
  brandLogo: { width: '100%', height: '100%' },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  rowCustomer: { flex: 1, color: '#15294D', fontSize: 12, fontWeight: '700' },
  rowVehicle: { color: '#40506A', fontSize: 11, fontWeight: '600' },
  rowService: { color: '#6B7788', fontSize: 10 },
  arrivalRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrivalRowText: { color: '#5A6470', fontSize: 9 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: '#EDF3FA',
  },
  statusPending: { backgroundColor: '#FFF4DF' },
  statusReceived: { backgroundColor: '#EAF5EF' },
  statusCancelled: { backgroundColor: '#FCECEC' },
  statusText: { color: '#2F5FA6', fontSize: 9, fontWeight: '700' },
  statusTextPending: { color: '#B7791F' },
  statusTextReceived: { color: '#287F68' },
  statusTextCancelled: { color: '#B42318' },
  detailContent: { gap: spacing.lg },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  detailHeaderCopy: { flex: 1, minWidth: 0, gap: 4 },
  detailReference: { color: '#2F5FA6', fontSize: 11, fontWeight: '700' },
  detailCustomer: { color: '#15294D', fontSize: 20, lineHeight: 26, fontWeight: '700' },
  detailVehicle: { color: '#5A6470', fontSize: 13, lineHeight: 19 },
  infoSection: { gap: 0 },
  sectionEyebrow: { marginBottom: 7, color: '#2F5FA6', fontSize: 10, fontWeight: '700' },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  detailIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#EDF3FA',
  },
  detailLineCopy: { flex: 1, minWidth: 0, gap: 2 },
  detailLabel: { color: '#7A8798', fontSize: 10 },
  detailValue: { color: '#15294D', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  actionsPanel: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E0EA',
    borderRadius: 14,
    backgroundColor: '#F9FAFC',
    gap: 10,
  },
  actionsTitle: { color: '#15294D', fontSize: 15, fontWeight: '700' },
  actionButtons: { gap: 8 },
  primaryAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: '#2F5FA6',
  },
  primaryActionHovered: { backgroundColor: '#244F8C' },
  primaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dangerAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#E9B8B8',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  dangerActionHovered: { borderColor: '#B42318', backgroundColor: '#FFF5F5' },
  dangerActionText: { color: '#B42318', fontSize: 12, fontWeight: '700' },
  receivedMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#EAF5EF',
  },
  receivedMessageText: { flex: 1, color: '#205E49', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  cancelledMessage: { padding: 11, borderRadius: 10, backgroundColor: '#FCECEC', gap: 3 },
  cancelledMessageTitle: { color: '#B42318', fontSize: 12, fontWeight: '700' },
  cancelledMessageText: { color: '#7A4343', fontSize: 11, lineHeight: 17 },
  successMessage: { padding: 9, borderRadius: 9, backgroundColor: '#EAF5EF' },
  successMessageText: { color: '#205E49', fontSize: 11, lineHeight: 17 },
  errorMessage: { padding: 9, borderRadius: 9, backgroundColor: '#FCECEC' },
  errorMessageText: { color: '#B42318', fontSize: 11, lineHeight: 17 },
  mobileModal: { flex: 1, backgroundColor: '#F4F6FA' },
  mobileModalHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E7F0',
    backgroundColor: '#FFFFFF',
  },
  mobileModalTitle: { color: '#15294D', fontSize: 15, fontWeight: '700' },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#EDF3FA',
  },
  mobileModalContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  cancelModalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(11, 18, 32, 0.56)' },
  cancelModalCard: {
    width: '100%',
    maxWidth: 560,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  cancelModalHeader: { gap: 5 },
  cancelModalEyebrow: { color: '#B42318', fontSize: 10, fontWeight: '700' },
  cancelModalTitle: { color: '#15294D', fontSize: 20, lineHeight: 26, fontWeight: '700' },
  cancelModalSummary: { color: '#5A6470', fontSize: 11, lineHeight: 17 },
  reasonField: { gap: 6 },
  fieldLabel: { color: '#15294D', fontSize: 11, fontWeight: '700' },
  reasonInput: {
    minHeight: 110,
    padding: 11,
    borderWidth: 1,
    borderColor: '#D8E0EA',
    borderRadius: 10,
    color: '#15294D',
    fontSize: 12,
  },
  cancelModalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  secondaryAction: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D8E0EA',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  secondaryActionText: { color: '#5A6470', fontSize: 11, fontWeight: '700' },
  confirmCancelAction: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#B42318',
  },
  confirmCancelActionHovered: { backgroundColor: '#8F1C13' },
  confirmCancelText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  emptyPanel: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C9D8EA',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  emptyIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#EDF3FA' },
  emptyText: { maxWidth: 520, color: '#5A6470', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  skeletonPage: { flex: 1, gap: spacing.md, padding: spacing.md },
  skeletonHeader: { height: 120, borderRadius: 18, backgroundColor: '#E1E6EE' },
  skeletonMetrics: { height: 70, borderRadius: 14, backgroundColor: '#E7EBF1' },
  skeletonWorkspace: { flexDirection: 'row', gap: spacing.md },
  skeletonQueue: { flex: 0.85, height: 560, borderRadius: 16, backgroundColor: '#E1E6EE' },
  skeletonDetail: { flex: 1.25, height: 560, borderRadius: 16, backgroundColor: '#E7EBF1' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
