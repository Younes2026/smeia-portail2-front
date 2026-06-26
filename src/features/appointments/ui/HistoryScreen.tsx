import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { LoadingState } from '@/components/feedback/LoadingState';
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import {
  useAppointmentsHistory,
  useCancelAppointment,
} from '@/features/appointments/hooks/useAppointmentsHistory';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';

const historyTabs = [
  { label: 'Tous', value: 'all' },
  { label: 'Rendez-vous', value: 'appointments' },
  { label: 'Réparations', value: 'repairs' },
] as const;

const statusFilterOptions = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'En attente', value: 'pending' },
  { label: 'Confirmé', value: 'confirmed' },
  { label: 'Annulé', value: 'cancelled' },
  { label: 'Terminé', value: 'completed' },
] as const;

const sortOptions = [
  { label: 'Plus récent d’abord', value: 'desc' },
  { label: 'Plus ancien d’abord', value: 'asc' },
] as const;

type HistoryTab = (typeof historyTabs)[number]['value'];
type StatusFilter = (typeof statusFilterOptions)[number]['value'];
type AppointmentStatusKey = Exclude<StatusFilter, 'all'>;
type SortDirection = (typeof sortOptions)[number]['value'];

type VehicleFilterOption = {
  label: string;
  value: string;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeStatus(status: string): string {
  return normalizeText(status);
}

function getStatusKey(status: string): AppointmentStatusKey | 'other' {
  const normalizedStatus = normalizeStatus(status);

  if (['pending', 'en attente'].includes(normalizedStatus)) {
    return 'pending';
  }

  if (['confirmed', 'confirme'].includes(normalizedStatus)) {
    return 'confirmed';
  }

  if (['cancelled', 'canceled', 'annule', 'annulee'].includes(normalizedStatus)) {
    return 'cancelled';
  }

  if (
    ['completed', 'complete', 'finished', 'done', 'termine', 'cloture'].includes(
      normalizedStatus
    )
  ) {
    return 'completed';
  }

  return 'other';
}

function getStatusLabel(status: string): string {
  const statusKey = getStatusKey(status);

  if (statusKey === 'pending') {
    return 'En attente';
  }

  if (statusKey === 'cancelled') {
    return 'Annulé';
  }

  if (statusKey === 'confirmed') {
    return 'Confirmé';
  }

  if (statusKey === 'completed') {
    return 'Terminé';
  }

  return status.trim() || 'Statut non renseigné';
}

function getVehicleFilterValue(appointment: AppointmentListItem): string {
  return `${appointment.vehicle}::${appointment.registrationNumber}`;
}

function getVehicleFilterLabel(appointment: AppointmentListItem): string {
  const vehicle = appointment.vehicle.trim() || 'Véhicule non renseigné';
  const registrationNumber =
    appointment.registrationNumber.trim() || 'Immatriculation non renseignée';

  return `${vehicle} · ${registrationNumber}`;
}

function getAppointmentTimestamp(appointment: AppointmentListItem): number {
  const dateValue = appointment.requestedDateValue.trim();

  if (!dateValue) {
    return 0;
  }

  const [year, month, day] = dateValue.split('-').map(Number);

  if (!year || !month || !day) {
    const fallbackTimestamp = new Date(dateValue).getTime();

    return Number.isNaN(fallbackTimestamp) ? 0 : fallbackTimestamp;
  }

  const [hours = '0', minutes = '0'] =
    appointment.requestedTimeValue.trim().split(':');
  const timestamp = new Date(
    year,
    month - 1,
    day,
    Number(hours) || 0,
    Number(minutes) || 0
  ).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isAppointmentDateClearlyPast(
  appointment: AppointmentListItem
): boolean {
  const dateValue = appointment.requestedDateValue.trim();

  if (!dateValue) {
    return false;
  }

  const [year, month, day] = dateValue.split('-').map(Number);

  if (!year || !month || !day) {
    return false;
  }

  const appointmentDate = new Date(year, month - 1, day);
  const today = new Date();

  appointmentDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return appointmentDate.getTime() < today.getTime();
}

function canCancelAppointment(appointment: AppointmentListItem): boolean {
  return (
    getStatusKey(appointment.status) === 'pending' &&
    !isAppointmentDateClearlyPast(appointment)
  );
}

function matchesSearch(
  appointment: AppointmentListItem,
  normalizedSearch: string
): boolean {
  if (!normalizedSearch) {
    return true;
  }

  const searchableText = normalizeText(
    [
      appointment.vehicle,
      appointment.registrationNumber,
      appointment.serviceType,
      appointment.workshop,
      appointment.requestedDate,
      appointment.requestedTime,
      getStatusLabel(appointment.status),
      appointment.comment,
    ].join(' ')
  );

  return searchableText.includes(normalizedSearch);
}

function matchesStatusFilter(
  appointment: AppointmentListItem,
  statusFilter: StatusFilter
): boolean {
  return statusFilter === 'all' || getStatusKey(appointment.status) === statusFilter;
}

function matchesVehicleFilter(
  appointment: AppointmentListItem,
  vehicleFilter: string
): boolean {
  return (
    vehicleFilter === 'all' || getVehicleFilterValue(appointment) === vehicleFilter
  );
}

export function HistoryScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const appointmentsQuery = useAppointmentsHistory();
  const cancelAppointment = useCancelAppointment();
  const [appointmentToCancel, setAppointmentToCancel] = useState<
    number | string | null
  >(null);
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const appointments = appointmentsQuery.data ?? [];
  const pendingCount = appointments.filter(
    (appointment) => getStatusKey(appointment.status) === 'pending'
  ).length;

  const vehicleOptions = useMemo(() => {
    const options = new Map<string, VehicleFilterOption>();

    appointments.forEach((appointment) => {
      const value = getVehicleFilterValue(appointment);

      if (!options.has(value)) {
        options.set(value, {
          label: getVehicleFilterLabel(appointment),
          value,
        });
      }
    });

    return Array.from(options.values()).sort((first, second) =>
      first.label.localeCompare(second.label, 'fr-FR')
    );
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const normalizedSearch = normalizeText(searchQuery);

    return appointments
      .filter((appointment) => matchesSearch(appointment, normalizedSearch))
      .filter((appointment) => matchesStatusFilter(appointment, statusFilter))
      .filter((appointment) => matchesVehicleFilter(appointment, vehicleFilter))
      .sort((first, second) => {
        const firstTimestamp = getAppointmentTimestamp(first);
        const secondTimestamp = getAppointmentTimestamp(second);

        if (firstTimestamp === secondTimestamp) {
          return String(first.id).localeCompare(String(second.id), 'fr-FR');
        }

        return sortDirection === 'desc'
          ? secondTimestamp - firstTimestamp
          : firstTimestamp - secondTimestamp;
      });
  }, [appointments, searchQuery, sortDirection, statusFilter, vehicleFilter]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'all' ||
    vehicleFilter !== 'all';
  const isRepairsTab = activeTab === 'repairs';

  useEffect(() => {
    if (cancelAppointment.isSuccess) {
      setAppointmentToCancel(null);
    }
  }, [cancelAppointment.isSuccess]);

  useEffect(() => {
    if (
      vehicleFilter !== 'all' &&
      !vehicleOptions.some((option) => option.value === vehicleFilter)
    ) {
      setVehicleFilter('all');
    }
  }, [vehicleFilter, vehicleOptions]);

  if (appointmentsQuery.isLoading) {
    return (
      <ClientPortalLayout activeRoute="/history">
        <View style={styles.stateContainer}>
          <LoadingState message="Chargement de l’historique..." />
        </View>
      </ClientPortalLayout>
    );
  }

  if (appointmentsQuery.isError) {
    return (
      <ClientPortalLayout activeRoute="/history">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Erreur de chargement"
            message="Impossible de charger votre historique."
            onRetry={() => {
              appointmentsQuery.refetch();
            }}
          />
        </View>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout activeRoute="/history">
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={[styles.header, isNarrow && styles.headerNarrow]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Espace client</Text>
            <Text style={styles.title}>Historique</Text>
            <Text style={styles.subtitle}>
              Consultez vos anciennes demandes de rendez-vous, suivez leur
              statut et retrouvez les interventions liées à vos véhicules.
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
              <Text style={styles.primaryActionText}>Nouveau rendez-vous</Text>
            </Pressable>
          </Link>
        </View>

        <View style={[styles.summaryGrid, isNarrow && styles.stack]}>
          <SummaryCard
            detail="Demandes de rendez-vous enregistrées"
            label="Demandes"
            value={String(appointments.length)}
          />
          <SummaryCard
            detail="Demandes en attente de confirmation"
            label="En attente"
            value={String(pendingCount)}
          />
          <SummaryCard
            detail="Données liées à votre compte client"
            label="Suivi sécurisé"
            value="Espace client"
          />
        </View>

        <HistoryFilters
          activeTab={activeTab}
          isNarrow={isNarrow}
          searchQuery={searchQuery}
          sortDirection={sortDirection}
          statusFilter={statusFilter}
          vehicleFilter={vehicleFilter}
          vehicleOptions={vehicleOptions}
          onSearchQueryChange={setSearchQuery}
          onSortDirectionChange={setSortDirection}
          onStatusFilterChange={setStatusFilter}
          onTabChange={setActiveTab}
          onVehicleFilterChange={setVehicleFilter}
        />

        {cancelAppointment.isSuccess ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Rendez-vous annulé</Text>
            <Text style={styles.successText}>
              Le statut a été mis à jour et l’historique a été actualisé.
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

        {isRepairsTab ? (
          <EmptyPanel
            title="Réparations"
            text="Aucune réparation terminée à afficher pour le moment."
          />
        ) : filteredAppointments.length > 0 ? (
          <View style={styles.appointmentGrid}>
            {filteredAppointments.map((appointment) => (
              <AppointmentCard
                key={String(appointment.id)}
                appointment={appointment}
                isCancelling={
                  cancelAppointment.isPending &&
                  String(cancelAppointment.variables) === String(appointment.id)
                }
                onCancel={() => {
                  cancelAppointment.reset();
                  setAppointmentToCancel(appointment.id);
                }}
              />
            ))}
          </View>
        ) : (
          <EmptyPanel
            title={hasActiveFilters ? 'Aucun résultat' : 'Historique vide'}
            text={
              hasActiveFilters
                ? 'Aucun élément ne correspond à vos filtres.'
                : 'Aucun élément d’historique trouvé.'
            }
          />
        )}
      </ScrollView>

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
          <View accessibilityRole="alert" style={styles.confirmationModal}>
            <Text style={styles.modalEyebrow}>Rendez-vous SMEIA</Text>
            <Text style={styles.modalTitle}>Confirmer l’annulation</Text>
            <Text style={styles.modalMessage}>
              Voulez-vous vraiment annuler ce rendez-vous ? Cette action
              conservera l’historique dans votre espace client.
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
                <Text style={styles.keepButtonText}>Garder le rendez-vous</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={
                  appointmentToCancel === null || cancelAppointment.isPending
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
    </ClientPortalLayout>
  );
}

type HistoryFiltersProps = {
  activeTab: HistoryTab;
  isNarrow: boolean;
  searchQuery: string;
  sortDirection: SortDirection;
  statusFilter: StatusFilter;
  vehicleFilter: string;
  vehicleOptions: VehicleFilterOption[];
  onSearchQueryChange: (value: string) => void;
  onSortDirectionChange: (value: SortDirection) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onTabChange: (value: HistoryTab) => void;
  onVehicleFilterChange: (value: string) => void;
};

function HistoryFilters({
  activeTab,
  isNarrow,
  searchQuery,
  sortDirection,
  statusFilter,
  vehicleFilter,
  vehicleOptions,
  onSearchQueryChange,
  onSortDirectionChange,
  onStatusFilterChange,
  onTabChange,
  onVehicleFilterChange,
}: HistoryFiltersProps) {
  return (
    <View style={styles.filtersPanel}>
      <View style={styles.tabList}>
        {historyTabs.map((tab) => (
          <FilterChip
            key={tab.value}
            active={activeTab === tab.value}
            label={tab.label}
            onPress={() => {
              onTabChange(tab.value);
            }}
          />
        ))}
      </View>

      <View style={[styles.filterRow, isNarrow && styles.stack]}>
        <View style={styles.searchField}>
          <Text style={styles.filterLabel}>Recherche</Text>
          <TextInput
            accessibilityLabel="Rechercher dans l’historique"
            onChangeText={onSearchQueryChange}
            placeholder="Rechercher par véhicule, service, atelier..."
            placeholderTextColor="#8A97A8"
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Statut</Text>
          <View style={styles.chipList}>
            {statusFilterOptions.map((option) => (
              <FilterChip
                key={option.value}
                active={statusFilter === option.value}
                label={option.label}
                onPress={() => {
                  onStatusFilterChange(option.value);
                }}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.filterRow, isNarrow && styles.stack]}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Véhicule</Text>
          <View style={styles.chipList}>
            <FilterChip
              active={vehicleFilter === 'all'}
              label="Tous les véhicules"
              onPress={() => {
                onVehicleFilterChange('all');
              }}
            />
            {vehicleOptions.map((option) => (
              <FilterChip
                key={option.value}
                active={vehicleFilter === option.value}
                label={option.label}
                onPress={() => {
                  onVehicleFilterChange(option.value);
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Tri</Text>
          <View style={styles.chipList}>
            {sortOptions.map((option) => (
              <FilterChip
                key={option.value}
                active={sortDirection === option.value}
                label={option.label}
                onPress={() => {
                  onSortDirectionChange(option.value);
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

type FilterChipProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function FilterChip({ active, label, onPress }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.chip,
        active && styles.chipActive,
        hovered && !active && styles.chipHovered,
        pressed && styles.pressed,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipText, active && styles.chipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
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
  const statusKey = getStatusKey(appointment.status);
  const isPending = statusKey === 'pending';
  const isCancelled = statusKey === 'cancelled';
  const isConfirmed = statusKey === 'confirmed';
  const isCompleted = statusKey === 'completed';
  const canCancel = canCancelAppointment(appointment);

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.vehicleName}>
            {appointment.vehicle || 'Véhicule non renseigné'}
          </Text>
          <Text style={styles.registrationNumber}>
            {appointment.registrationNumber || 'Immatriculation non renseignée'}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            isPending && styles.statusPending,
            isCancelled && styles.statusCancelled,
            isConfirmed && styles.statusConfirmed,
            isCompleted && styles.statusCompleted,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isPending && styles.statusTextPending,
              isCancelled && styles.statusTextCancelled,
              isConfirmed && styles.statusTextConfirmed,
              isCompleted && styles.statusTextCompleted,
            ]}
          >
            {getStatusLabel(appointment.status)}
          </Text>
        </View>
      </View>

      <View style={styles.detailGrid}>
        <DetailLine
          label="Service"
          value={appointment.serviceType || 'Service non renseigné'}
        />
        <DetailLine
          label="Atelier"
          value={appointment.workshop || 'Atelier non renseigné'}
        />
        <DetailLine
          label="Date"
          value={appointment.requestedDate || 'Date non renseignée'}
        />
        <DetailLine
          label="Heure"
          value={appointment.requestedTime || 'Heure non renseignée'}
        />
        <DetailLine
          label="Commentaire"
          value={appointment.comment || 'Aucun commentaire'}
        />
      </View>

      {canCancel ? (
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

type EmptyPanelProps = {
  title: string;
  text: string;
};

function EmptyPanel({ title, text }: EmptyPanelProps) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  contentScroll: {
    flex: 1,
  },

  content: {
    gap: spacing.lg,
    padding: spacing.sm,
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

  filtersPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    gap: spacing.md,
  },

  tabList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  filterRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  searchField: {
    flex: 1.15,
    minWidth: 260,
    gap: spacing.sm,
  },

  filterGroup: {
    flex: 1,
    minWidth: 240,
    gap: spacing.sm,
  },

  filterLabel: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  searchInput: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D5DFEC',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#071832',
    fontSize: typography.fontSize.md,
  },

  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  chip: {
    maxWidth: '100%',
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D7DFEA',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  chipActive: {
    borderColor: '#0F4C9A',
    backgroundColor: '#EAF2FC',
  },

  chipHovered: {
    borderColor: '#B8C9DF',
    backgroundColor: '#F8FAFC',
  },

  chipText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  chipTextActive: {
    color: '#0F4C9A',
    fontWeight: typography.fontWeight.bold,
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

  statusConfirmed: {
    borderColor: '#AFCBEA',
    backgroundColor: '#EEF6FF',
  },

  statusCancelled: {
    borderColor: '#E4B8B8',
    backgroundColor: '#FFF3F3',
  },

  statusCompleted: {
    borderColor: '#B7D5C0',
    backgroundColor: '#F0F9F3',
  },

  statusText: {
    color: '#526174',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  statusTextPending: {
    color: '#9A6700',
  },

  statusTextConfirmed: {
    color: '#0F4C9A',
  },

  statusTextCancelled: {
    color: '#B42318',
  },

  statusTextCompleted: {
    color: '#166534',
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
