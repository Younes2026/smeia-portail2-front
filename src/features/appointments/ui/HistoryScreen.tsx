import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
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
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useCancelAppointment } from '@/features/appointments/hooks/useAppointmentsHistory';
import { useHistoryEvents } from '@/features/appointments/hooks/useHistoryEvents';
import {
  getAppointmentStatusKey,
  getHistoryEventSection,
  getServiceJourneyProgress,
  type HistoryEvent,
  type HistoryEventType,
  type HistorySectionKey,
  type HistoryStatusTone,
} from '@/features/appointments/model/history-event.presenter';
import { getBrandLogo } from '@/features/vehicles/model/brand-logo';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type HistoryTypeFilter = 'all' | 'appointments' | 'repairs';
type SortDirection = 'desc' | 'asc';

const HISTORY_SECTIONS: Array<{
  key: HistorySectionKey;
  title: string;
  description: string;
}> = [
  {
    key: 'upcoming',
    title: 'À venir',
    description: 'Vos prochaines visites planifiées chez SMEIA.',
  },
  {
    key: 'inProgress',
    title: 'En cours',
    description: 'Les prises en charge actuellement suivies par nos ateliers.',
  },
  {
    key: 'history',
    title: 'Historique',
    description: 'Vos rendez-vous passés et interventions réalisées.',
  },
];

const JOURNEY_STEPS = [
  'Rendez-vous',
  'Réception',
  'Diagnostic',
  'Intervention',
  'Restitution',
] as const;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr-FR');
}

function formatDetailDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: value.includes('T') ? 'short' : undefined,
      }).format(date);
}

function getEventTypeLabel(type: HistoryEventType): string {
  if (type === 'serviceJourney') return 'Parcours atelier';
  if (type === 'repair') return 'Réparation';
  return 'Rendez-vous';
}

function getEventIcon(event: HistoryEvent): SymbolName {
  if (event.repair?.statusKey === 'completed') {
    return { ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' };
  }
  if (event.type === 'appointment') {
    return { ios: 'calendar', android: 'event', web: 'event' };
  }
  return { ios: 'wrench', android: 'build', web: 'build' };
}

function getVehicleFilterValue(event: HistoryEvent): string {
  return event.vehicleId !== null
    ? `vehicle-${String(event.vehicleId)}`
    : `label-${normalize(event.vehicleLabel)}`;
}

function canCancelEvent(event: HistoryEvent): boolean {
  const eventDay = new Date(event.timestamp);
  const today = new Date();
  eventDay.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return (
    event.type === 'appointment' &&
    event.appointment !== null &&
    getAppointmentStatusKey(event.appointment.status) === 'pending' &&
    eventDay.getTime() >= today.getTime()
  );
}

export function HistoryScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const historyQuery = useHistoryEvents();
  const cancelAppointment = useCancelAppointment();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<HistoryTypeFilter>('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [secondaryFiltersVisible, setSecondaryFiltersVisible] = useState(false);
  const events = historyQuery.events;
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? null;

  const vehicleOptions = useMemo(() => {
    const options = new Map<
      string,
      { brandName: string | null; label: string; value: string }
    >();
    events.forEach((event) => {
      const value = getVehicleFilterValue(event);
      if (!options.has(value)) {
        options.set(value, {
          brandName: event.brandName,
          label: event.vehicleLabel,
          value,
        });
      }
    });
    return Array.from(options.values()).sort((first, second) =>
      first.label.localeCompare(second.label, 'fr-FR')
    );
  }, [events]);

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .map((event) => event.dateValue?.match(/^(\d{4})/)?.[1] ?? null)
            .filter((year): year is string => Boolean(year))
        )
      ).sort((first, second) => Number(second) - Number(first)),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const search = normalize(searchQuery);
    return events.filter((event) => {
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'appointments' &&
          ['appointment', 'serviceJourney'].includes(event.type)) ||
        (typeFilter === 'repairs' &&
          ['repair', 'serviceJourney'].includes(event.type));
      const matchesVehicle =
        vehicleFilter === 'all' ||
        getVehicleFilterValue(event) === vehicleFilter;
      const matchesYear =
        yearFilter === 'all' || event.dateValue?.startsWith(yearFilter);
      const matchesSearch = !search || event.searchText.includes(search);
      return matchesType && matchesVehicle && matchesYear && matchesSearch;
    });
  }, [events, searchQuery, typeFilter, vehicleFilter, yearFilter]);

  const sectionEvents = useMemo(() => {
    const grouped: Record<HistorySectionKey, HistoryEvent[]> = {
      upcoming: [],
      inProgress: [],
      history: [],
    };
    filteredEvents.forEach((event) => {
      grouped[getHistoryEventSection(event)].push(event);
    });
    grouped.upcoming.sort((first, second) => first.timestamp - second.timestamp);
    const chronologicalSort = (first: HistoryEvent, second: HistoryEvent) =>
      sortDirection === 'desc'
        ? second.timestamp - first.timestamp
        : first.timestamp - second.timestamp;
    grouped.inProgress.sort(chronologicalSort);
    grouped.history.sort(chronologicalSort);
    return grouped;
  }, [filteredEvents, sortDirection]);

  const selectedVehicleOption =
    vehicleOptions.find((option) => option.value === vehicleFilter) ?? null;
  const selectedBrandLogo = getBrandLogo(selectedVehicleOption?.brandName);
  const upcomingEvents = events
    .filter((event) => getHistoryEventSection(event) === 'upcoming')
    .sort((first, second) => first.timestamp - second.timestamp);
  const completedInterventions = events.filter(
    (event) => event.repair?.statusKey === 'completed'
  ).length;
  const latestWorkshopEvent = events
    .filter((event) => event.repair !== null)
    .sort((first, second) => second.timestamp - first.timestamp)[0];

  useEffect(() => {
    if (cancelAppointment.isSuccess) {
      setConfirmCancellation(false);
      setSelectedEventId(null);
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

  if (historyQuery.isLoading) {
    return (
      <ClientPortalLayout activeRoute="/history">
        <HistorySkeleton />
      </ClientPortalLayout>
    );
  }

  if (historyQuery.isError) {
    return (
      <ClientPortalLayout activeRoute="/history">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Carnet de vie temporairement indisponible"
            message="Impossible de charger vos rendez-vous et interventions."
            onRetry={historyQuery.refetch}
          />
        </View>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout activeRoute="/history">
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <HistoryHeader
          completedInterventions={completedInterventions}
          lastVisit={latestWorkshopEvent?.date ?? 'Aucune visite enregistrée'}
          nextAppointment={upcomingEvents[0]?.date ?? 'Aucun rendez-vous à venir'}
          selectedBrandLogo={selectedBrandLogo}
          selectedVehicleLabel={
            selectedVehicleOption?.label ?? 'Tous vos véhicules'
          }
        />

        <HistoryFilters
          isNarrow={isNarrow}
          searchQuery={searchQuery}
          secondaryVisible={secondaryFiltersVisible}
          sortDirection={sortDirection}
          typeFilter={typeFilter}
          vehicleFilter={vehicleFilter}
          vehicleOptions={vehicleOptions}
          yearFilter={yearFilter}
          yearOptions={yearOptions}
          onSearchChange={setSearchQuery}
          onSortChange={setSortDirection}
          onToggleSecondary={() =>
            setSecondaryFiltersVisible((current) => !current)
          }
          onTypeChange={setTypeFilter}
          onVehicleChange={setVehicleFilter}
          onYearChange={setYearFilter}
        />

        {cancelAppointment.isSuccess ? (
          <FeedbackBanner
            tone="success"
            title="Rendez-vous annulé"
            text="Votre carnet de vie a été actualisé."
          />
        ) : null}
        {cancelAppointment.isError ? (
          <FeedbackBanner
            tone="danger"
            title="Annulation impossible"
            text="Veuillez réessayer dans quelques instants."
          />
        ) : null}

        {events.length === 0 ? (
          <EmptyHistory />
        ) : filteredEvents.length === 0 ? (
          <EmptyHistory filtered />
        ) : (
          <View style={styles.sections}>
            {HISTORY_SECTIONS.map((section) =>
              sectionEvents[section.key].length > 0 ? (
                <HistorySection
                  key={section.key}
                  description={section.description}
                  events={sectionEvents[section.key]}
                  isNarrow={isNarrow}
                  title={section.title}
                  onOpen={(eventId) => {
                    cancelAppointment.reset();
                    setConfirmCancellation(false);
                    setSelectedEventId(eventId);
                  }}
                />
              ) : null
            )}
          </View>
        )}
      </ScrollView>

      <EventDetailModal
        cancelError={cancelAppointment.isError}
        confirmCancellation={confirmCancellation}
        event={selectedEvent}
        isCancelling={cancelAppointment.isPending}
        isNarrow={isNarrow}
        onCancelAppointment={() => {
          if (selectedEvent?.appointment) {
            cancelAppointment.mutate(selectedEvent.appointment.id);
          }
        }}
        onClose={() => {
          if (!cancelAppointment.isPending) {
            setConfirmCancellation(false);
            setSelectedEventId(null);
          }
        }}
        onConfirmCancellation={setConfirmCancellation}
      />
    </ClientPortalLayout>
  );
}

function HistoryHeader({
  completedInterventions,
  lastVisit,
  nextAppointment,
  selectedBrandLogo,
  selectedVehicleLabel,
}: {
  completedInterventions: number;
  lastVisit: string;
  nextAppointment: string;
  selectedBrandLogo: ReturnType<typeof getBrandLogo>;
  selectedVehicleLabel: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopline}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CARNET DE VIE SMEIA</Text>
          <Text style={styles.title}>Historique de votre véhicule</Text>
          <Text style={styles.subtitle}>
            Retrouvez chaque visite, prise en charge et intervention dans une
            chronologie claire et sécurisée.
          </Text>
        </View>
        <View style={styles.filteredVehicle}>
          <View
            style={[
              styles.filteredVehicleLogo,
              selectedBrandLogo &&
                'needsLightSurface' in selectedBrandLogo &&
                selectedBrandLogo.needsLightSurface &&
                styles.filteredVehicleLogoLight,
            ]}
          >
            {selectedBrandLogo ? (
              <Image
                accessibilityLabel={`Logo ${selectedBrandLogo.name}`}
                contentFit="contain"
                source={selectedBrandLogo.source}
                style={styles.brandLogo}
              />
            ) : (
              <SymbolView
                name={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
                size={27}
                tintColor="#8FB7E8"
              />
            )}
          </View>
          <View style={styles.filteredVehicleCopy}>
            <Text style={styles.filteredVehicleLabel}>Véhicule affiché</Text>
            <Text numberOfLines={2} style={styles.filteredVehicleValue}>
              {selectedVehicleLabel}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.metrics}>
        <Metric
          icon={{ ios: 'calendar', android: 'event', web: 'event' }}
          label="Prochain rendez-vous"
          value={nextAppointment}
        />
        <Metric
          icon={{ ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' }}
          label="Interventions réalisées"
          value={String(completedInterventions)}
        />
        <Metric
          icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
          label="Dernière visite atelier"
          value={lastVisit}
        />
      </View>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: SymbolName; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>
        <SymbolView name={icon} size={17} tintColor="#8FB7E8" />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function HistoryFilters({
  isNarrow,
  searchQuery,
  secondaryVisible,
  sortDirection,
  typeFilter,
  vehicleFilter,
  vehicleOptions,
  yearFilter,
  yearOptions,
  onSearchChange,
  onSortChange,
  onToggleSecondary,
  onTypeChange,
  onVehicleChange,
  onYearChange,
}: {
  isNarrow: boolean;
  searchQuery: string;
  secondaryVisible: boolean;
  sortDirection: SortDirection;
  typeFilter: HistoryTypeFilter;
  vehicleFilter: string;
  vehicleOptions: Array<{ label: string; value: string }>;
  yearFilter: string;
  yearOptions: string[];
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortDirection) => void;
  onToggleSecondary: () => void;
  onTypeChange: (value: HistoryTypeFilter) => void;
  onVehicleChange: (value: string) => void;
  onYearChange: (value: string) => void;
}) {
  const showSecondary = !isNarrow || secondaryVisible;
  return (
    <View style={styles.filters}>
      <View style={styles.primaryFilters}>
        <View style={styles.searchField}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor="#6B7788"
          />
          <TextInput
            accessibilityLabel="Rechercher dans le carnet de vie"
            onChangeText={onSearchChange}
            placeholder="Marque, immatriculation, service, atelier..."
            placeholderTextColor="#8A97A8"
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>
        <View style={styles.typeTabs}>
          <FilterChip active={typeFilter === 'all'} label="Tous" onPress={() => onTypeChange('all')} />
          <FilterChip active={typeFilter === 'appointments'} label="Rendez-vous" onPress={() => onTypeChange('appointments')} />
          <FilterChip active={typeFilter === 'repairs'} label="Réparations" onPress={() => onTypeChange('repairs')} />
        </View>
        {isNarrow ? (
          <Pressable
            accessibilityRole="button"
            onPress={onToggleSecondary}
            style={({ pressed }) => [styles.filterToggle, pressed && styles.pressed]}
          >
            <SymbolView
              name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }}
              size={17}
              tintColor="#2F5FA6"
            />
            <Text style={styles.filterToggleText}>Filtres</Text>
          </Pressable>
        ) : null}
      </View>
      {showSecondary ? (
        <View style={styles.secondaryFilters}>
          <FilterGroup label="Véhicule">
            <FilterChip active={vehicleFilter === 'all'} label="Tous" onPress={() => onVehicleChange('all')} />
            {vehicleOptions.map((option) => (
              <FilterChip key={option.value} active={vehicleFilter === option.value} label={option.label} onPress={() => onVehicleChange(option.value)} />
            ))}
          </FilterGroup>
          <FilterGroup label="Année">
            <FilterChip active={yearFilter === 'all'} label="Toutes" onPress={() => onYearChange('all')} />
            {yearOptions.map((year) => (
              <FilterChip key={year} active={yearFilter === year} label={year} onPress={() => onYearChange(year)} />
            ))}
          </FilterGroup>
          <FilterGroup label="Tri">
            <FilterChip active={sortDirection === 'desc'} label="Plus récent" onPress={() => onSortChange('desc')} />
            <FilterChip active={sortDirection === 'asc'} label="Plus ancien" onPress={() => onSortChange('asc')} />
          </FilterGroup>
        </View>
      ) : null}
    </View>
  );
}

function FilterGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
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
      <Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function HistorySection({
  description,
  events,
  isNarrow,
  title,
  onOpen,
}: {
  description: string;
  events: HistoryEvent[];
  isNarrow: boolean;
  title: string;
  onOpen: (eventId: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{events.length}</Text>
        </View>
      </View>
      <View style={styles.timeline}>
        {events.map((event, index) => (
          <HistoryEventRow
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
            isNarrow={isNarrow}
            onOpen={() => onOpen(event.id)}
          />
        ))}
      </View>
    </View>
  );
}

function HistoryEventRow({
  event,
  isLast,
  isNarrow,
  onOpen,
}: {
  event: HistoryEvent;
  isLast: boolean;
  isNarrow: boolean;
  onOpen: () => void;
}) {
  return (
    <View style={[styles.eventRow, isNarrow && styles.eventRowNarrow]}>
      {!isNarrow ? (
        <View style={styles.eventDateColumn}>
          <Text style={styles.eventDate}>{event.date}</Text>
          {event.time ? <Text style={styles.eventTime}>{event.time}</Text> : null}
        </View>
      ) : null}
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, toneStyles[event.statusTone].dot]}>
          <SymbolView name={getEventIcon(event)} size={15} tintColor="#FFFFFF" />
        </View>
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={[styles.eventCard, isNarrow && styles.eventCardNarrow]}>
        <View style={styles.eventMain}>
          <View style={styles.eventTopline}>
            <Text style={styles.eventType}>{getEventTypeLabel(event.type)}</Text>
            <StatusBadge label={event.statusLabel} tone={event.statusTone} />
          </View>
          {isNarrow ? (
            <Text style={styles.eventMobileDate}>
              {event.date}{event.time ? ` • ${event.time}` : ''}
            </Text>
          ) : null}
          <Text style={styles.eventVehicle}>{event.vehicleLabel}</Text>
          <View style={styles.eventDetails}>
            <EventDetail icon={{ ios: 'wrench', android: 'build', web: 'build' }} value={event.serviceLabel} />
            <EventDetail icon={{ ios: 'mappin', android: 'location_on', web: 'location_on' }} value={event.workshopLabel} />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={({ hovered, pressed }) => [
            styles.detailAction,
            hovered && styles.detailActionHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.detailActionText}>Voir le détail</Text>
          <SymbolView
            name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
            size={15}
            tintColor="#2F5FA6"
          />
        </Pressable>
      </View>
    </View>
  );
}

function EventDetail({ icon, value }: { icon: SymbolName; value: string }) {
  return (
    <View style={styles.eventDetail}>
      <SymbolView name={icon} size={15} tintColor="#6B7788" />
      <Text numberOfLines={2} style={styles.eventDetailText}>{value}</Text>
    </View>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: HistoryStatusTone }) {
  return (
    <View style={[styles.statusBadge, toneStyles[tone].badge]}>
      <Text style={[styles.statusBadgeText, toneStyles[tone].text]}>{label}</Text>
    </View>
  );
}

function EventDetailModal({
  cancelError,
  confirmCancellation,
  event,
  isCancelling,
  isNarrow,
  onCancelAppointment,
  onClose,
  onConfirmCancellation,
}: {
  cancelError: boolean;
  confirmCancellation: boolean;
  event: HistoryEvent | null;
  isCancelling: boolean;
  isNarrow: boolean;
  onCancelAppointment: () => void;
  onClose: () => void;
  onConfirmCancellation: (value: boolean) => void;
}) {
  const details = event
    ? [
        ['Référence SAV', event.referenceLabel],
        ['Véhicule', event.vehicleLabel],
        ['Atelier', event.workshopLabel],
        ['Prestation', event.serviceLabel],
        ['Date et heure', `${event.date}${event.time ? ` • ${event.time}` : ''}`],
        ['Commentaire client', event.comment],
        ['Motif d’annulation', event.appointment?.cancellationReason],
        ['Arrivée confirmée', formatDetailDate(event.appointment?.arrivalConfirmedAt)],
        ['Diagnostic', event.repair?.diagnosticLabel],
        ['Travaux effectués', event.repair?.workDoneLabel],
        ['Solution', event.repair?.solutionLabel],
        ['Recommandations', event.repair?.recommendationsLabel],
        ['Coût final', event.repair?.finalCostLabel],
      ].filter((item): item is [string, string] => Boolean(item[1]))
    : [];

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent={!isNarrow}
      visible={event !== null}
    >
      <View style={[styles.drawerOverlay, isNarrow && styles.drawerOverlayNarrow]}>
        <View style={[styles.drawer, isNarrow && styles.drawerNarrow]}>
          {event ? (
            <>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerHeaderCopy}>
                  <Text style={styles.drawerEyebrow}>{getEventTypeLabel(event.type)}</Text>
                  <Text style={styles.drawerTitle}>{event.vehicleLabel}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Fermer le détail"
                  accessibilityRole="button"
                  onPress={onClose}
                  style={({ hovered, pressed }) => [
                    styles.closeButton,
                    hovered && styles.closeButtonHovered,
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    size={19}
                    tintColor="#15294D"
                  />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.drawerContent}>
                <View style={styles.drawerStatusRow}>
                  <StatusBadge label={event.statusLabel} tone={event.statusTone} />
                  <Text style={styles.drawerDate}>{event.date}</Text>
                </View>
                <View style={styles.detailList}>
                  {details.map(([label, value]) => (
                    <View key={label} style={styles.detailListItem}>
                      <Text style={styles.detailListLabel}>{label}</Text>
                      <Text style={styles.detailListValue}>{value}</Text>
                    </View>
                  ))}
                </View>
                {event.type === 'serviceJourney' ? (
                  <JourneyTimeline event={event} />
                ) : null}
                {canCancelEvent(event) ? (
                  <View style={styles.cancelArea}>
                    {!confirmCancellation ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => onConfirmCancellation(true)}
                        style={({ hovered, pressed }) => [
                          styles.cancelButton,
                          hovered && styles.cancelButtonHovered,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.cancelButtonText}>Annuler ce rendez-vous</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.cancelConfirmation}>
                        <Text style={styles.cancelConfirmationTitle}>Confirmer l’annulation ?</Text>
                        <Text style={styles.cancelConfirmationText}>
                          Le rendez-vous restera visible dans votre carnet de vie.
                        </Text>
                        <View style={styles.cancelActions}>
                          <Pressable
                            accessibilityRole="button"
                            disabled={isCancelling}
                            onPress={() => onConfirmCancellation(false)}
                            style={styles.keepButton}
                          >
                            <Text style={styles.keepButtonText}>Conserver</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            disabled={isCancelling}
                            onPress={onCancelAppointment}
                            style={[styles.confirmCancelButton, isCancelling && styles.disabled]}
                          >
                            <Text style={styles.confirmCancelButtonText}>
                              {isCancelling ? 'Annulation...' : 'Confirmer'}
                            </Text>
                          </Pressable>
                        </View>
                        {cancelError ? (
                          <Text style={styles.cancelError}>L’annulation a échoué. Réessayez.</Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function JourneyTimeline({ event }: { event: HistoryEvent }) {
  const progress = getServiceJourneyProgress(event);
  return (
    <View style={styles.journeyPanel}>
      <Text style={styles.journeyTitle}>Parcours de votre visite</Text>
      <View style={styles.journeySteps}>
        {JOURNEY_STEPS.map((step, index) => {
          const complete = index <= progress.completedThrough;
          const active = index === progress.activeIndex && !complete;
          return (
            <View key={step} style={styles.journeyStep}>
              <View style={[styles.journeyDot, complete && styles.journeyDotComplete, active && styles.journeyDotActive]}>
                {complete ? (
                  <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={12} tintColor="#FFFFFF" />
                ) : null}
              </View>
              <Text style={[styles.journeyLabel, complete && styles.journeyLabelComplete, active && styles.journeyLabelActive]}>{step}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function EmptyHistory({ filtered = false }: { filtered?: boolean }) {
  return (
    <View style={styles.emptyPanel}>
      <View style={styles.emptyIcon}>
        <SymbolView
          name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
          size={27}
          tintColor="#2F5FA6"
        />
      </View>
      <Text style={styles.emptyTitle}>{filtered ? 'Aucun résultat' : 'Votre carnet commence ici'}</Text>
      <Text style={styles.emptyText}>
        {filtered
          ? 'Aucun événement ne correspond aux filtres sélectionnés.'
          : 'Votre carnet de vie SMEIA se construira après votre première visite.'}
      </Text>
      {!filtered ? (
        <Link href="/appointments" asChild>
          <Pressable accessibilityRole="link" style={styles.emptyAction}>
            <Text style={styles.emptyActionText}>Prendre rendez-vous</Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

function FeedbackBanner({ tone, title, text }: { tone: 'success' | 'danger'; title: string; text: string }) {
  return (
    <View style={[styles.feedback, tone === 'success' ? styles.feedbackSuccess : styles.feedbackDanger]}>
      <Text style={styles.feedbackTitle}>{title}</Text>
      <Text style={styles.feedbackText}>{text}</Text>
    </View>
  );
}

function HistorySkeleton() {
  return (
    <View style={styles.skeletonPage} accessibilityLabel="Chargement du carnet de vie">
      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonFilters} />
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonEvent} />
      ))}
    </View>
  );
}

const toneStyles: Record<
  HistoryStatusTone,
  { badge: object; dot: object; text: object }
> = {
  info: { badge: { backgroundColor: '#EAF2FC' }, dot: { backgroundColor: '#4D7FB8' }, text: { color: '#2F5FA6' } },
  warning: { badge: { backgroundColor: '#FFF4E5' }, dot: { backgroundColor: '#C98224' }, text: { color: '#9A5E12' } },
  active: { badge: { backgroundColor: '#E4EEFB' }, dot: { backgroundColor: '#2F5FA6' }, text: { color: '#244B86' } },
  success: { badge: { backgroundColor: '#EAF6F1' }, dot: { backgroundColor: '#2F7D67' }, text: { color: '#236651' } },
  danger: { badge: { backgroundColor: '#FCECEC' }, dot: { backgroundColor: '#B85C5C' }, text: { color: '#964545' } },
  ready: { badge: { backgroundColor: '#DFF3EA' }, dot: { backgroundColor: '#187A55' }, text: { color: '#146545' } },
  neutral: { badge: { backgroundColor: '#EEF2F7' }, dot: { backgroundColor: '#7A8798' }, text: { color: '#5A6470' } },
};

const styles = StyleSheet.create({
  stateContainer: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  pageScroll: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { width: '100%', maxWidth: 1280, alignSelf: 'center', gap: spacing.lg, padding: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#26344C', borderRadius: 20, backgroundColor: '#0B1220' },
  headerTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.lg },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  eyebrow: { color: '#8FB7E8', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  title: { color: '#FFFFFF', fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.bold },
  subtitle: { maxWidth: 720, color: '#D9E5F5', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  filteredVehicle: { width: 290, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#30415D', borderRadius: 16, backgroundColor: '#141F33' },
  filteredVehicleLogo: { width: 50, height: 44, alignItems: 'center', justifyContent: 'center', padding: spacing.xs },
  filteredVehicleLogoLight: { borderRadius: 10, backgroundColor: '#FFFFFF' },
  brandLogo: { width: '100%', height: '100%' },
  filteredVehicleCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  filteredVehicleLabel: { color: '#8FA0B8', fontSize: typography.fontSize.xs },
  filteredVehicleValue: { color: '#FFFFFF', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, flexShrink: 1, flexBasis: 250, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#26344C', borderRadius: 14, backgroundColor: '#101A2C' },
  metricIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#172A45' },
  metricCopy: { flex: 1, minWidth: 0, gap: 2 },
  metricLabel: { color: '#8FA0B8', fontSize: typography.fontSize.xs },
  metricValue: { color: '#FFFFFF', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  filters: { gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 18, backgroundColor: '#FFFFFF' },
  primaryFilters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  searchField: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: '#D8E2F0', borderRadius: 12, backgroundColor: '#F8FAFC' },
  searchInput: { flex: 1, minWidth: 0, color: '#15294D', fontSize: typography.fontSize.sm },
  typeTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterToggle: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 10, backgroundColor: '#EDF4FF' },
  filterToggleText: { color: '#2F5FA6', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  secondaryFilters: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  filterGroup: { gap: spacing.xs },
  filterLabel: { color: '#5A6470', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { maxWidth: 230, minHeight: 34, justifyContent: 'center', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#D8E2F0', borderRadius: 10, backgroundColor: '#FFFFFF' },
  chipActive: { borderColor: '#2F5FA6', backgroundColor: '#2F5FA6' },
  chipHovered: { backgroundColor: '#F4F8FD' },
  chipText: { color: '#5A6470', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semiBold },
  chipTextActive: { color: '#FFFFFF' },
  sections: { gap: spacing.xl },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  sectionTitle: { color: '#15294D', fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  sectionDescription: { color: '#5A6470', fontSize: typography.fontSize.sm },
  sectionCount: { minWidth: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#EAF2FC' },
  sectionCountText: { color: '#2F5FA6', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  timeline: { gap: 0 },
  eventRow: { flexDirection: 'row', alignItems: 'stretch' },
  eventRowNarrow: { paddingLeft: 0 },
  eventDateColumn: { width: 118, alignItems: 'flex-end', gap: spacing.xs, paddingTop: spacing.md, paddingRight: spacing.md },
  eventDate: { color: '#15294D', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, textAlign: 'right' },
  eventTime: { color: '#5A6470', fontSize: typography.fontSize.xs },
  timelineRail: { width: 34, alignItems: 'center' },
  timelineDot: { zIndex: 1, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, borderRadius: 15, backgroundColor: '#7A8798' },
  timelineLine: { flex: 1, width: 2, minHeight: 92, backgroundColor: '#DDE3EC' },
  eventCard: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, marginLeft: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 16, backgroundColor: '#FFFFFF' },
  eventCardNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  eventMain: { flex: 1, minWidth: 0, gap: spacing.xs },
  eventTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  eventType: { color: '#2F5FA6', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textTransform: 'uppercase' },
  eventMobileDate: { color: '#6B7788', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semiBold },
  eventVehicle: { color: '#15294D', fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  eventDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  eventDetail: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eventDetailText: { flex: 1, color: '#5A6470', fontSize: typography.fontSize.sm },
  detailAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 10, backgroundColor: '#EDF4FF' },
  detailActionHovered: { backgroundColor: '#DDEAF9' },
  detailActionText: { color: '#2F5FA6', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  statusBadge: { maxWidth: 210, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 10, backgroundColor: '#EEF2F7' },
  statusBadgeText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  drawerOverlay: { flex: 1, alignItems: 'flex-end', backgroundColor: 'rgba(11, 18, 32, 0.42)' },
  drawerOverlayNarrow: { backgroundColor: '#F4F6FA' },
  drawer: { width: 520, maxWidth: '100%', height: '100%', borderLeftWidth: 1, borderLeftColor: '#E6EAF2', backgroundColor: '#FFFFFF' },
  drawerNarrow: { width: '100%', borderLeftWidth: 0 },
  drawerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: '#E6EAF2' },
  drawerHeaderCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  drawerEyebrow: { color: '#2F5FA6', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textTransform: 'uppercase' },
  drawerTitle: { color: '#15294D', fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#F4F6FA' },
  closeButtonHovered: { backgroundColor: '#E6EAF2' },
  drawerContent: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  drawerStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  drawerDate: { color: '#5A6470', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semiBold },
  detailList: { gap: spacing.xs },
  detailListItem: { gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  detailListLabel: { color: '#7A8798', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semiBold },
  detailListValue: { color: '#15294D', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.fontWeight.semiBold },
  journeyPanel: { gap: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: '#F8FAFC' },
  journeyTitle: { color: '#15294D', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  journeySteps: { gap: spacing.sm },
  journeyStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  journeyDot: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D5DCE8', borderRadius: 11, backgroundColor: '#FFFFFF' },
  journeyDotComplete: { borderColor: '#2F7D67', backgroundColor: '#2F7D67' },
  journeyDotActive: { borderColor: '#2F5FA6', backgroundColor: '#2F5FA6' },
  journeyLabel: { color: '#8A97A8', fontSize: typography.fontSize.sm },
  journeyLabelComplete: { color: '#2F7D67', fontWeight: typography.fontWeight.semiBold },
  journeyLabelActive: { color: '#2F5FA6', fontWeight: typography.fontWeight.bold },
  cancelArea: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: '#E6EAF2' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: '#E1A7A7', borderRadius: 12, backgroundColor: '#FFF8F8' },
  cancelButtonHovered: { backgroundColor: '#FCECEC' },
  cancelButtonText: { color: '#A14B4B', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  cancelConfirmation: { gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: '#FFF5F5' },
  cancelConfirmationTitle: { color: '#8F2D24', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  cancelConfirmationText: { color: '#7A4340', fontSize: typography.fontSize.sm },
  cancelActions: { flexDirection: 'row', gap: spacing.sm },
  keepButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8E2F0', borderRadius: 10, backgroundColor: '#FFFFFF' },
  keepButtonText: { color: '#2F5FA6', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  confirmCancelButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#B85C5C' },
  confirmCancelButtonText: { color: '#FFFFFF', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  cancelError: { color: '#A14B4B', fontSize: typography.fontSize.xs },
  emptyPanel: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 20, backgroundColor: '#FFFFFF' },
  emptyIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#EAF2FC' },
  emptyTitle: { color: '#15294D', fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, textAlign: 'center' },
  emptyText: { maxWidth: 560, color: '#5A6470', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm, textAlign: 'center' },
  emptyAction: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 12, backgroundColor: '#2F5FA6' },
  emptyActionText: { color: '#FFFFFF', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  feedback: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderRadius: 14 },
  feedbackSuccess: { borderColor: '#B9DCCF', backgroundColor: '#F0F8F5' },
  feedbackDanger: { borderColor: '#E8BEBE', backgroundColor: '#FFF5F5' },
  feedbackTitle: { color: '#15294D', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  feedbackText: { color: '#5A6470', fontSize: typography.fontSize.sm },
  skeletonPage: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: '#F4F6FA' },
  skeletonHeader: { minHeight: 220, borderRadius: 20, backgroundColor: '#DDE4ED' },
  skeletonFilters: { minHeight: 92, borderRadius: 18, backgroundColor: '#FFFFFF' },
  skeletonEvent: { minHeight: 132, borderRadius: 16, backgroundColor: '#FFFFFF' },
  pressed: { opacity: 0.84 },
  disabled: { opacity: 0.46 },
});
