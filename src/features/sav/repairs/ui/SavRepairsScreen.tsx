import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
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
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useSavRepairsPresentation } from '@/features/sav/repairs/hooks/useSavRepairsPresentation';
import {
  SAV_REPAIR_PROGRESS_STEPS,
  normalizeSavRepairValue,
  type SavRepairStatusTone,
  type SavRepairViewModel,
} from '@/features/sav/repairs/model/sav-repair.presenter';
import { SavPortalLayout } from '@/features/sav/shared/ui/SavPortalLayout';
import { useAuthStore } from '@/store/auth.store';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type OperationalFilter =
  | 'all'
  | 'unassigned'
  | 'urgent'
  | 'in_progress'
  | 'completed'
  | 'ready';
type SortValue = 'recent' | 'oldest' | 'priority' | 'planned_exit';

const operationalFilters: ReadonlyArray<{
  value: OperationalFilter;
  label: string;
}> = [
  { value: 'all', label: 'Tous' },
  { value: 'unassigned', label: 'À affecter' },
  { value: 'urgent', label: 'Mes urgences' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminés' },
  { value: 'ready', label: 'Prêts à récupérer' },
];

const sortOptions: ReadonlyArray<{ value: SortValue; label: string }> = [
  { value: 'recent', label: 'Plus récent' },
  { value: 'oldest', label: 'Plus ancien' },
  { value: 'priority', label: 'Priorité' },
  { value: 'planned_exit', label: 'Sortie prévue' },
];

function isUsableWorkshop(value?: string | null): value is string {
  const normalized = normalizeSavRepairValue(value);
  return Boolean(
    normalized &&
      !normalized.includes('non renseigne') &&
      !/^atelier\s*#/.test(normalized)
  );
}

function isDateToday(value: string | null): boolean {
  if (!value) return false;
  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return value.slice(0, 10) === localToday;
}

function getPlannedTimestamp(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function matchesOperationalFilter(
  repair: SavRepairViewModel,
  filter: OperationalFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'unassigned') return repair.isActive && !repair.isAssigned;
  if (filter === 'urgent') return repair.isUrgent;
  if (filter === 'in_progress') {
    return ['diagnostic', 'in_progress'].includes(repair.statusKey);
  }
  if (filter === 'completed') return repair.isCompleted;
  return repair.isReadyForPickup;
}

function getNextOption<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  current: T
): T {
  const currentIndex = options.findIndex((option) => option.value === current);
  return options[(currentIndex + 1) % options.length]?.value ?? options[0].value;
}

export function SavRepairsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= breakpoints.desktop;
  const isMobile = width < breakpoints.tablet;
  const savAgent = useAuthStore((state) => state.savAgent);
  const { repairs, isLoading, isRefreshing, error, refresh } =
    useSavRepairsPresentation();
  const [query, setQuery] = useState('');
  const [operationalFilter, setOperationalFilter] =
    useState<OperationalFilter>('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [technicianFilter, setTechnicianFilter] = useState('all');
  const [sort, setSort] = useState<SortValue>('recent');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());

  useEffect(() => {
    if (error && __DEV__) {
      console.warn('[SAV repairs] Échec du chargement atelier', error);
    }
  }, [error]);

  const serviceOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les services' },
      ...Array.from(new Set(repairs.map((repair) => repair.serviceLabel)))
        .sort((first, second) => first.localeCompare(second, 'fr-FR'))
        .map((label) => ({ value: label, label })),
    ],
    [repairs]
  );

  const technicianOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les techniciens' },
      ...Array.from(new Set(repairs.map((repair) => repair.technicianLabel)))
        .sort((first, second) => first.localeCompare(second, 'fr-FR'))
        .map((label) => ({ value: label, label })),
    ],
    [repairs]
  );

  const filteredRepairs = useMemo(() => {
    const normalizedQuery = normalizeSavRepairValue(query);
    const filtered = repairs.filter(
      (repair) =>
        (!normalizedQuery || repair.searchText.includes(normalizedQuery)) &&
        matchesOperationalFilter(repair, operationalFilter) &&
        (serviceFilter === 'all' || repair.serviceLabel === serviceFilter) &&
        (technicianFilter === 'all' ||
          repair.technicianLabel === technicianFilter)
    );

    return [...filtered].sort((first, second) => {
      if (sort === 'oldest') return first.sortValue - second.sortValue;
      if (sort === 'priority') {
        return second.priorityValue - first.priorityValue || second.sortValue - first.sortValue;
      }
      if (sort === 'planned_exit') {
        return (
          getPlannedTimestamp(first.plannedExitDateValue) -
          getPlannedTimestamp(second.plannedExitDateValue)
        );
      }
      return second.sortValue - first.sortValue;
    });
  }, [
    operationalFilter,
    query,
    repairs,
    serviceFilter,
    sort,
    technicianFilter,
  ]);

  useEffect(() => {
    if (filteredRepairs.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!filteredRepairs.some((repair) => repair.id === selectedId)) {
      setSelectedId(filteredRepairs[0].id);
    }
  }, [filteredRepairs, selectedId]);

  useEffect(() => {
    setVisibleCount(15);
  }, [operationalFilter, query, serviceFilter, sort, technicianFilter]);

  const selectedRepair =
    filteredRepairs.find((repair) => repair.id === selectedId) ?? null;
  const visibleRepairs = filteredRepairs.slice(0, visibleCount);
  const workshopLabel =
    repairs.find((repair) => isUsableWorkshop(repair.workshopLabel))
      ?.workshopLabel ??
    (isUsableWorkshop(savAgent?.workshopName)
      ? savAgent.workshopName
      : 'Atelier non renseigné');
  const activeCount = repairs.filter((repair) => repair.isActive).length;
  const unassignedCount = repairs.filter(
    (repair) => repair.isActive && !repair.isAssigned
  ).length;
  const interventionCount = repairs.filter(
    (repair) => repair.statusKey === 'in_progress'
  ).length;
  const readyCount = repairs.filter((repair) => repair.isReadyForPickup).length;
  const todayExitCount = repairs.filter((repair) =>
    isDateToday(repair.plannedExitDateValue)
  ).length;
  const hasFilters =
    query.trim().length > 0 ||
    operationalFilter !== 'all' ||
    serviceFilter !== 'all' ||
    technicianFilter !== 'all' ||
    sort !== 'recent';

  const resetFilters = () => {
    setQuery('');
    setOperationalFilter('all');
    setServiceFilter('all');
    setTechnicianFilter('all');
    setSort('recent');
  };

  const handleRefresh = async () => {
    await refresh();
    setLastUpdatedAt(new Date());
  };

  const handleSelect = (repair: SavRepairViewModel) => {
    setSelectedId(repair.id);
    if (!isDesktop) setMobileDetailOpen(true);
  };

  if (isLoading) {
    return (
      <SavPortalLayout activeRoute="/sav/repairs">
        <RepairsSkeleton />
      </SavPortalLayout>
    );
  }

  if (error) {
    return (
      <SavPortalLayout activeRoute="/sav/repairs">
        <View style={styles.statePage}>
          <ErrorState
            title="Impossible de charger les réparations"
            message="Les dossiers de votre atelier sont momentanément indisponibles."
            onRetry={() => void handleRefresh()}
          />
        </View>
      </SavPortalLayout>
    );
  }

  return (
    <SavPortalLayout activeRoute="/sav/repairs">
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        style={styles.pageScroll}
      >
        <View style={[styles.hero, !isDesktop && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>PILOTAGE ATELIER</Text>
            <Text style={styles.heroTitle}>Réparations atelier</Text>
            <Text style={styles.heroSubtitle}>
              Suivez les dossiers, les affectations techniques et les prochaines échéances.
            </Text>
          </View>
          <View style={[styles.heroMeta, !isDesktop && styles.heroMetaCompact]}>
            <View style={styles.workshopMark}>
              <SymbolView
                name={{ ios: 'building.2', android: 'domain', web: 'domain' }}
                size={18}
                tintColor="#9FC4F0"
              />
            </View>
            <View style={styles.heroMetaCopy}>
              <Text numberOfLines={2} style={styles.workshopName}>{workshopLabel}</Text>
              <Text style={styles.todayLabel}>
                {new Intl.DateTimeFormat('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                }).format(new Date())}
              </Text>
            </View>
            <RefreshButton
              dark
              isRefreshing={isRefreshing}
              onPress={() => void handleRefresh()}
            />
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            accent="#2F5FA6"
            label="Total des dossiers actifs"
            value={activeCount}
            note={`${unassignedCount} sans technicien`}
          />
          <MetricCard
            accent="#667085"
            label="En attente d’affectation"
            value={unassignedCount}
            note={unassignedCount === 1 ? 'Dossier à organiser' : 'Dossiers à organiser'}
          />
          <MetricCard
            accent="#7C3AED"
            label="En cours d’intervention"
            value={interventionCount}
            note={`${todayExitCount} sortie${todayExitCount > 1 ? 's' : ''} prévue${todayExitCount > 1 ? 's' : ''} aujourd’hui`}
          />
          <MetricCard
            accent="#087F5B"
            label="Prêts à récupérer"
            value={readyCount}
            note={`Mis à jour à ${lastUpdatedAt.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}`}
          />
        </View>

        <PilotBar
          operationalFilter={operationalFilter}
          query={query}
          serviceFilter={serviceFilter}
          serviceOptions={serviceOptions}
          sort={sort}
          technicianFilter={technicianFilter}
          technicianOptions={technicianOptions}
          onOperationalFilterChange={setOperationalFilter}
          onQueryChange={setQuery}
          onServiceChange={setServiceFilter}
          onSortChange={setSort}
          onTechnicianChange={setTechnicianFilter}
        />

        {repairs.length === 0 ? (
          <EmptyPanel
            message="Aucune réparation n’est actuellement enregistrée pour cet atelier."
            title="Atelier à jour"
          />
        ) : filteredRepairs.length === 0 ? (
          <EmptyPanel
            actionLabel={hasFilters ? 'Réinitialiser les filtres' : undefined}
            message="Aucun dossier ne correspond à vos filtres."
            onAction={hasFilters ? resetFilters : undefined}
            title="Aucun résultat"
          />
        ) : (
          <View style={[styles.workspace, !isDesktop && styles.workspaceStack]}>
            <View style={styles.queuePanel}>
              <View style={styles.panelHeading}>
                <View>
                  <Text style={styles.panelEyebrow}>FLUX OPÉRATIONNEL</Text>
                  <Text style={styles.panelTitle}>File des dossiers</Text>
                </View>
                <Text style={styles.resultCount}>{filteredRepairs.length}</Text>
              </View>
              <View style={styles.repairList}>
                {visibleRepairs.map((repair) => (
                  <RepairRow
                    active={repair.id === selectedId}
                    key={repair.id}
                    onPress={() => handleSelect(repair)}
                    repair={repair}
                  />
                ))}
              </View>
              {visibleCount < filteredRepairs.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVisibleCount((count) => count + 15)}
                  style={({ hovered, pressed }) => [
                    styles.loadMoreButton,
                    hovered && styles.controlHovered,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.loadMoreText}>Afficher 15 dossiers supplémentaires</Text>
                </Pressable>
              ) : null}
            </View>

            {isDesktop ? (
              <View style={styles.detailPanel}>
                {selectedRepair ? (
                  <RepairDetail
                    isCompact={false}
                    isRefreshing={isRefreshing}
                    onRefresh={() => void handleRefresh()}
                    repair={selectedRepair}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setMobileDetailOpen(false)}
        presentationStyle="pageSheet"
        visible={!isDesktop && mobileDetailOpen && selectedRepair !== null}
      >
        <View style={styles.mobileDetailPage}>
          <View style={styles.mobileDetailBar}>
            <Text style={styles.mobileDetailTitle}>Fiche dossier</Text>
            <Pressable
              accessibilityLabel="Fermer la fiche"
              accessibilityRole="button"
              onPress={() => setMobileDetailOpen(false)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={18}
                tintColor="#15294D"
              />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.mobileDetailContent}>
            {selectedRepair ? (
              <RepairDetail
                isCompact={isMobile}
                isRefreshing={isRefreshing}
                onRefresh={() => void handleRefresh()}
                repair={selectedRepair}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </SavPortalLayout>
  );
}

function RefreshButton({
  dark = false,
  isRefreshing,
  onPress,
}: {
  dark?: boolean;
  isRefreshing: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isRefreshing}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.refreshButton,
        dark && styles.refreshButtonDark,
        hovered && styles.refreshButtonHovered,
        pressed && styles.pressed,
      ]}
    >
      <SymbolView
        name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
        size={15}
        tintColor={dark ? '#FFFFFF' : '#2F5FA6'}
      />
      <Text style={[styles.refreshText, dark && styles.refreshTextDark]}>
        {isRefreshing ? 'Mise à jour…' : 'Actualiser'}
      </Text>
    </Pressable>
  );
}

function MetricCard({
  accent,
  label,
  note,
  value,
}: {
  accent: string;
  label: string;
  note: string;
  value: number;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricNote}>{note}</Text>
      </View>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function PilotBar({
  onOperationalFilterChange,
  onQueryChange,
  onServiceChange,
  onSortChange,
  onTechnicianChange,
  operationalFilter,
  query,
  serviceFilter,
  serviceOptions,
  sort,
  technicianFilter,
  technicianOptions,
}: {
  onOperationalFilterChange: (value: OperationalFilter) => void;
  onQueryChange: (value: string) => void;
  onServiceChange: (value: string) => void;
  onSortChange: (value: SortValue) => void;
  onTechnicianChange: (value: string) => void;
  operationalFilter: OperationalFilter;
  query: string;
  serviceFilter: string;
  serviceOptions: ReadonlyArray<{ value: string; label: string }>;
  sort: SortValue;
  technicianFilter: string;
  technicianOptions: ReadonlyArray<{ value: string; label: string }>;
}) {
  const serviceLabel =
    serviceOptions.find((option) => option.value === serviceFilter)?.label ??
    'Tous les services';
  const technicianLabel =
    technicianOptions.find((option) => option.value === technicianFilter)?.label ??
    'Tous les techniciens';
  const sortLabel = sortOptions.find((option) => option.value === sort)?.label ?? 'Plus récent';

  return (
    <View style={styles.pilotBar}>
      <View style={styles.searchBox}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={17}
          tintColor="#7A8798"
        />
        <TextInput
          onChangeText={onQueryChange}
          placeholder="Référence, client, véhicule, service…"
          placeholderTextColor="#8A97A8"
          style={styles.searchInput}
          value={query}
        />
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={styles.filterTabs}
        showsHorizontalScrollIndicator={false}
      >
        {operationalFilters.map((filter) => (
          <FilterPill
            active={operationalFilter === filter.value}
            key={filter.value}
            label={filter.label}
            onPress={() => onOperationalFilterChange(filter.value)}
          />
        ))}
      </ScrollView>
      <View style={styles.secondaryFilters}>
        <CycleControl
          icon={{ ios: 'wrench.and.screwdriver', android: 'build', web: 'build' }}
          label={serviceLabel}
          onPress={() =>
            onServiceChange(getNextOption(serviceOptions, serviceFilter))
          }
        />
        <CycleControl
          icon={{ ios: 'person.crop.circle', android: 'person', web: 'person' }}
          label={technicianLabel}
          onPress={() =>
            onTechnicianChange(getNextOption(technicianOptions, technicianFilter))
          }
        />
        <CycleControl
          icon={{ ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' }}
          label={sortLabel}
          onPress={() => onSortChange(getNextOption(sortOptions, sort))}
        />
      </View>
    </View>
  );
}

function FilterPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.filterPill,
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

function CycleControl({
  icon,
  label,
  onPress,
}: {
  icon: SymbolName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Appuyez pour afficher l’option suivante"
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.cycleControl,
        hovered && styles.controlHovered,
        pressed && styles.pressed,
      ]}
    >
      <SymbolView name={icon} size={15} tintColor="#2F5FA6" />
      <Text numberOfLines={1} style={styles.cycleControlText}>{label}</Text>
      <SymbolView
        name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
        size={14}
        tintColor="#7A8798"
      />
    </Pressable>
  );
}

function RepairRow({
  active,
  onPress,
  repair,
}: {
  active: boolean;
  onPress: () => void;
  repair: SavRepairViewModel;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.repairRow,
        active && styles.repairRowActive,
        hovered && !active && styles.repairRowHovered,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.selectionRail, active && styles.selectionRailActive]} />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.rowReference}>{repair.reference}</Text>
          <StatusBadge label={repair.statusLabel} tone={repair.statusTone} />
        </View>
        <View style={styles.vehicleLine}>
          <Text numberOfLines={1} style={styles.rowVehicle}>{repair.vehicleLabel}</Text>
          {repair.isUrgent ? <Text style={styles.urgentLabel}>URGENT</Text> : null}
        </View>
        <Text numberOfLines={1} style={styles.registrationLabel}>
          {repair.registrationLabel}
        </Text>
        <View style={styles.rowFacts}>
          <CompactFact label="Client" value={repair.customerLabel} />
          <CompactFact label="Service" value={repair.serviceLabel} />
        </View>
        <View style={styles.rowFooter}>
          <Text numberOfLines={1} style={styles.technicianLine}>
            {repair.isAssigned ? repair.technicianLabel : 'À affecter'}
          </Text>
          <Text style={styles.rowDate}>{repair.entryDateLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CompactFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.compactFact}>
      <Text style={styles.compactFactLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.compactFactValue}>{value}</Text>
    </View>
  );
}

function RepairDetail({
  isCompact,
  isRefreshing,
  onRefresh,
  repair,
}: {
  isCompact: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  repair: SavRepairViewModel;
}) {
  return (
    <View style={styles.detailContent}>
      <View style={[styles.detailHeader, isCompact && styles.detailHeaderCompact]}>
        <View style={styles.detailHeaderCopy}>
          <Text style={styles.detailEyebrow}>FICHE DOSSIER</Text>
          <Text style={styles.detailReference}>{repair.reference}</Text>
          <Text style={styles.detailVehicle}>{repair.vehicleLabel}</Text>
          <Text style={styles.detailRegistration}>{repair.registrationLabel}</Text>
        </View>
        <StatusBadge label={repair.statusLabel} tone={repair.statusTone} />
      </View>

      <View style={styles.summaryStrip}>
        <SummaryItem label="Service" value={repair.serviceLabel} />
        <SummaryItem label="Atelier" value={repair.workshopLabel} />
        <SummaryItem label="Entrée" value={repair.entryDateLabel} />
      </View>

      <DetailSection title="Avancement atelier">
        <ProgressTimeline isCompact={isCompact} repair={repair} />
      </DetailSection>

      <DetailSection title="Client et véhicule">
        {repair.hasIdentityGap ? (
          <View style={styles.softAlert}>
            <SymbolView
              name={{ ios: 'info.circle', android: 'info', web: 'info' }}
              size={16}
              tintColor="#8A5A00"
            />
            <Text style={styles.softAlertText}>
              Certaines informations client ou véhicule doivent être complétées.
            </Text>
          </View>
        ) : null}
        <View style={styles.detailGrid}>
          <InfoLine label="Client" value={repair.customerLabel} />
          {repair.customerPhone ? <InfoLine label="Téléphone" value={repair.customerPhone} /> : null}
          {repair.customerEmail ? <InfoLine label="E-mail" value={repair.customerEmail} /> : null}
          <InfoLine label="Véhicule" value={repair.vehicleLabel} />
          <InfoLine label="Immatriculation" value={repair.registrationLabel} />
          {repair.entryMileageLabel ? <InfoLine label="Kilométrage" value={repair.entryMileageLabel} /> : null}
          {repair.vinLabel ? <InfoLine label="VIN" value={repair.vinLabel} /> : null}
          {repair.yearLabel ? <InfoLine label="Année" value={repair.yearLabel} /> : null}
        </View>
      </DetailSection>

      <DetailSection title="Affectation atelier">
        <View style={styles.assignmentHeader}>
          <View style={styles.assignmentIdentity}>
            <View style={[styles.avatar, !repair.isAssigned && styles.avatarPending]}>
              <SymbolView
                name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                size={17}
                tintColor={repair.isAssigned ? '#FFFFFF' : '#667085'}
              />
            </View>
            <View style={styles.assignmentCopy}>
              <Text style={styles.assignmentName}>{repair.technicianLabel}</Text>
              {repair.technicianSpecialty ? (
                <Text style={styles.assignmentMeta}>{repair.technicianSpecialty}</Text>
              ) : null}
            </View>
          </View>
          {!repair.isAssigned ? <AssignmentBadge /> : null}
        </View>
        {!repair.isAssigned ? (
          <Text style={styles.assignmentMessage}>
            Ce dossier n’a pas encore été affecté à un technicien.
          </Text>
        ) : null}
        <View style={styles.detailGrid}>
          <InfoLine label="Atelier" value={repair.workshopLabel} />
          <InfoLine label="Sortie prévue" value={repair.plannedExitDateLabel} />
          {repair.assignmentDateLabel ? (
            <InfoLine label="Affectation" value={repair.assignmentDateLabel} />
          ) : null}
        </View>
      </DetailSection>

      <DetailSection title="Synthèse technique">
        {repair.technicalItems.length > 0 ? (
          <View style={styles.technicalList}>
            {repair.technicalItems.map((item) => (
              <View key={item.key} style={styles.technicalItem}>
                <Text style={styles.technicalLabel}>{item.label}</Text>
                <Text style={styles.technicalText}>{item.value}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.technicalEmpty}>
            <Text style={styles.technicalEmptyText}>
              Aucune information technique saisie pour le moment.
            </Text>
          </View>
        )}
      </DetailSection>

      <View style={styles.actionBar}>
        {repair.appointmentId !== null ? (
          <Link href="/sav/appointments" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.primaryAction,
                hovered && styles.primaryActionHovered,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
                size={16}
                tintColor="#FFFFFF"
              />
              <Text style={styles.primaryActionText}>Voir le rendez-vous lié</Text>
            </Pressable>
          </Link>
        ) : null}
        <RefreshButton isRefreshing={isRefreshing} onPress={onRefresh} />
      </View>
    </View>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: SavRepairStatusTone;
}) {
  return (
    <View style={[styles.statusBadge, statusBadgeStyles[tone]]}>
      <View style={[styles.statusDot, statusDotStyles[tone]]} />
      <Text style={[styles.statusText, statusTextStyles[tone]]}>{label}</Text>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function AssignmentBadge() {
  return (
    <View style={styles.assignmentBadge}>
      <Text style={styles.assignmentBadgeText}>À affecter</Text>
    </View>
  );
}

function ProgressTimeline({
  isCompact,
  repair,
}: {
  isCompact: boolean;
  repair: SavRepairViewModel;
}) {
  return (
    <View style={[styles.timeline, isCompact && styles.timelineCompact]}>
      {SAV_REPAIR_PROGRESS_STEPS.map((step, index) => {
        const isCompleted = index <= repair.progress.completedThrough;
        const isActive = index === repair.progress.activeIndex;

        return (
          <View
            key={step}
            style={[styles.timelineStep, isCompact && styles.timelineStepCompact]}
          >
            {index > 0 ? (
              <View
                style={[
                  styles.timelineConnector,
                  isCompact && styles.timelineConnectorCompact,
                  (isCompleted || isActive) && styles.timelineConnectorDone,
                ]}
              />
            ) : null}
            <View
              style={[
                styles.timelineDot,
                isCompleted && styles.timelineDotDone,
                isActive && styles.timelineDotActive,
              ]}
            >
              {isCompleted ? <Text style={styles.timelineCheck}>✓</Text> : null}
            </View>
            <Text
              style={[
                styles.timelineLabel,
                isCompact && styles.timelineLabelCompact,
                (isCompleted || isActive) && styles.timelineLabelCurrent,
              ]}
            >
              {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function EmptyPanel({
  actionLabel,
  message,
  onAction,
  title,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.emptyPanel}>
      <View style={styles.emptyIcon}>
        <SymbolView
          name={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
          size={24}
          tintColor="#2F5FA6"
        />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {onAction && actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ hovered, pressed }) => [
            styles.primaryAction,
            hovered && styles.primaryActionHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RepairsSkeleton() {
  return (
    <View style={styles.skeletonPage}>
      <View style={[styles.skeletonBlock, styles.skeletonHero]} />
      <View style={styles.metricsGrid}>
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={[styles.skeletonBlock, styles.skeletonMetric]} />
        ))}
      </View>
      <View style={[styles.skeletonBlock, styles.skeletonFilters]} />
      <View style={styles.workspace}>
        <View style={[styles.skeletonBlock, styles.skeletonList]} />
        <View style={[styles.skeletonBlock, styles.skeletonDetail]} />
      </View>
    </View>
  );
}

const statusBadgeStyles: Record<SavRepairStatusTone, object> = {
  neutral: { backgroundColor: '#F2F4F7', borderColor: '#D0D5DD' },
  diagnostic: { backgroundColor: '#F4F0FF', borderColor: '#D8C8FF' },
  active: { backgroundColor: '#EEF5FF', borderColor: '#B9D2F3' },
  success: { backgroundColor: '#ECFDF3', borderColor: '#ABEFC6' },
  ready: { backgroundColor: '#E7F8F3', borderColor: '#9CDAC8' },
  danger: { backgroundColor: '#FEF3F2', borderColor: '#FECDCA' },
};

const statusDotStyles: Record<SavRepairStatusTone, object> = {
  neutral: { backgroundColor: '#667085' },
  diagnostic: { backgroundColor: '#7C3AED' },
  active: { backgroundColor: '#2F5FA6' },
  success: { backgroundColor: '#16803C' },
  ready: { backgroundColor: '#087F5B' },
  danger: { backgroundColor: '#D92D20' },
};

const statusTextStyles: Record<SavRepairStatusTone, object> = {
  neutral: { color: '#475467' },
  diagnostic: { color: '#6941C6' },
  active: { color: '#214F8F' },
  success: { color: '#067647' },
  ready: { color: '#08634C' },
  danger: { color: '#B42318' },
};

const styles = StyleSheet.create({
  pageScroll: { flex: 1 },
  pageContent: {
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  statePage: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  hero: {
    minHeight: 184,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: 20,
    backgroundColor: '#0B1220',
  },
  heroCompact: { alignItems: 'stretch', flexDirection: 'column' },
  heroCopy: { flex: 1, gap: spacing.xs },
  eyebrow: {
    color: '#8CB4E5',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  heroSubtitle: {
    maxWidth: 680,
    color: '#B9C5D6',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  heroMeta: {
    minWidth: 350,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#29364A',
    borderRadius: 18,
    backgroundColor: '#121D2E',
  },
  heroMetaCompact: { minWidth: 0, flexWrap: 'wrap' },
  workshopMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#1C2D45',
  },
  heroMetaCopy: { flex: 1, minWidth: 130, gap: 2 },
  workshopName: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  todayLabel: { color: '#9AAAC0', fontSize: typography.fontSize.xs },
  refreshButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#C8D6E8',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  refreshButtonDark: { borderColor: '#3A4B64', backgroundColor: '#22324A' },
  refreshButtonHovered: { opacity: 0.82 },
  refreshText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  refreshTextDark: { color: '#FFFFFF' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: {
    minWidth: 220,
    minHeight: 88,
    flexGrow: 1,
    flexBasis: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  metricAccent: { width: 4, height: 46, borderRadius: 2 },
  metricCopy: { flex: 1, minWidth: 0, gap: 3 },
  metricLabel: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  metricNote: { color: '#697586', fontSize: typography.fontSize.xs },
  metricValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  pilotBar: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  searchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D9E1EC',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    color: '#15294D',
    fontSize: typography.fontSize.sm,
  },
  filterTabs: { gap: spacing.sm },
  filterPill: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D9E1EC',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: { borderColor: '#2F5FA6', backgroundColor: '#2F5FA6' },
  filterPillText: {
    color: '#475467',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  filterPillTextActive: { color: '#FFFFFF' },
  secondaryFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cycleControl: {
    minWidth: 170,
    maxWidth: 280,
    minHeight: 40,
    flexGrow: 1,
    flexBasis: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D9E1EC',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  cycleControlText: {
    flex: 1,
    color: '#344054',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  controlHovered: { borderColor: '#9CB7D8', backgroundColor: '#F7FAFE' },
  workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  workspaceStack: { flexDirection: 'column' },
  queuePanel: {
    flex: 2,
    width: '100%',
    minWidth: 0,
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  detailPanel: {
    flex: 3,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  panelEyebrow: {
    color: '#2F5FA6',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  panelTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  resultCount: {
    minWidth: 34,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 17,
    backgroundColor: '#EEF4FC',
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  repairList: { gap: spacing.sm },
  repairRow: {
    minHeight: 158,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  repairRowActive: { borderColor: '#7FA7D7', backgroundColor: '#F3F7FD' },
  repairRowHovered: { borderColor: '#B7C9DF', backgroundColor: '#FAFCFF' },
  selectionRail: { width: 4, backgroundColor: 'transparent' },
  selectionRailActive: { backgroundColor: '#2F5FA6' },
  rowContent: { flex: 1, minWidth: 0, gap: spacing.xs, padding: spacing.md },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowReference: {
    flex: 1,
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowVehicle: {
    flex: 1,
    color: '#15294D',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  urgentLabel: {
    color: '#B42318',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  registrationLabel: {
    color: '#667085',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  rowFacts: { flexDirection: 'row', gap: spacing.md },
  compactFact: { flex: 1, minWidth: 0, gap: 1 },
  compactFactLabel: { color: '#8A94A3', fontSize: 10 },
  compactFactValue: {
    color: '#344054',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },
  technicianLine: {
    flex: 1,
    color: '#526174',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  rowDate: { color: '#697586', fontSize: typography.fontSize.xs },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: 14,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
  },
  loadMoreButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9E1EC',
    borderRadius: 10,
  },
  loadMoreText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  detailContent: { gap: spacing.lg },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailHeaderCompact: { flexDirection: 'column' },
  detailHeaderCopy: { flex: 1, minWidth: 0, gap: 3 },
  detailEyebrow: {
    color: '#2F5FA6',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  detailReference: {
    color: '#15294D',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  detailVehicle: {
    color: '#344054',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  detailRegistration: { color: '#697586', fontSize: typography.fontSize.sm },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E6EAF2',
  },
  summaryItem: {
    minWidth: 140,
    flex: 1,
    gap: 3,
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: '#E6EAF2',
  },
  summaryLabel: { color: '#7A8798', fontSize: typography.fontSize.xs },
  summaryValue: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  detailSection: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E6EAF2',
  },
  sectionTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  timeline: { flexDirection: 'row', paddingTop: spacing.sm },
  timelineCompact: { flexDirection: 'column', gap: 0, paddingLeft: spacing.xs },
  timelineStep: { flex: 1, alignItems: 'center', gap: spacing.sm },
  timelineStepCompact: {
    minHeight: 52,
    flex: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  timelineConnector: {
    position: 'absolute',
    top: 8,
    right: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#DEE4EC',
  },
  timelineConnectorCompact: {
    top: -36,
    left: 7,
    right: undefined,
    width: 2,
    height: 45,
  },
  timelineConnectorDone: { backgroundColor: '#6F9DD2' },
  timelineDot: {
    width: 18,
    height: 18,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#CBD3DF',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  timelineDotDone: { borderColor: '#2F5FA6', backgroundColor: '#2F5FA6' },
  timelineDotActive: {
    borderColor: '#2F5FA6',
    backgroundColor: '#2F5FA6',
    shadowColor: '#2F5FA6',
    shadowOpacity: 0.24,
    shadowRadius: 6,
  },
  timelineCheck: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  timelineLabel: {
    maxWidth: 105,
    color: '#98A2B3',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  timelineLabelCompact: {
    maxWidth: '100%',
    flex: 1,
    fontSize: typography.fontSize.xs,
    textAlign: 'left',
  },
  timelineLabelCurrent: { color: '#214F8F', fontWeight: typography.fontWeight.bold },
  softAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#F0D9A2',
    borderRadius: 10,
    backgroundColor: '#FFFAEB',
  },
  softAlertText: { flex: 1, color: '#79540A', fontSize: typography.fontSize.xs },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  infoLine: {
    minWidth: 180,
    flexGrow: 1,
    flexBasis: '44%',
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
  },
  infoLabel: { color: '#7A8798', fontSize: typography.fontSize.xs },
  infoValue: {
    color: '#243B5A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  assignmentIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#2F5FA6',
  },
  avatarPending: { backgroundColor: '#EEF1F5' },
  assignmentCopy: { flex: 1, gap: 2 },
  assignmentName: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  assignmentMeta: { color: '#697586', fontSize: typography.fontSize.xs },
  assignmentBadge: {
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    backgroundColor: '#F2F4F7',
  },
  assignmentBadgeText: {
    color: '#475467',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  assignmentMessage: { color: '#697586', fontSize: typography.fontSize.xs },
  technicalList: { gap: spacing.md },
  technicalItem: { gap: spacing.xs },
  technicalLabel: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  technicalText: {
    color: '#475467',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  technicalEmpty: {
    padding: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D7DEE8',
    borderRadius: 10,
    backgroundColor: '#FAFBFC',
  },
  technicalEmptyText: {
    color: '#697586',
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E6EAF2',
  },
  primaryAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: '#2F5FA6',
  },
  primaryActionHovered: { backgroundColor: '#244C86' },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  emptyPanel: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C9D3E0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#EEF4FC',
  },
  emptyTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  emptyMessage: {
    maxWidth: 520,
    color: '#697586',
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  mobileDetailPage: { flex: 1, backgroundColor: '#F4F6FA' },
  mobileDetailBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EAF2',
    backgroundColor: '#FFFFFF',
  },
  mobileDetailTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9E1EC',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  mobileDetailContent: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  skeletonPage: { flex: 1, gap: spacing.md, padding: spacing.sm },
  skeletonBlock: { borderRadius: 18, backgroundColor: '#E8EDF4' },
  skeletonHero: { minHeight: 184 },
  skeletonMetric: { minWidth: 220, minHeight: 88, flexGrow: 1, flexBasis: 220 },
  skeletonFilters: { minHeight: 130 },
  skeletonList: { minHeight: 480, flex: 2 },
  skeletonDetail: { minHeight: 480, flex: 3 },
  pressed: { opacity: 0.78 },
});
