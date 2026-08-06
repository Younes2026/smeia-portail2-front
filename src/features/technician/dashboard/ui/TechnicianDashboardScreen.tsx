import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
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
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import type {
  DirectusBrand,
  DirectusRelation,
  DirectusRepair,
  DirectusResource,
  DirectusServiceType,
  DirectusStatus,
  DirectusVehicle,
} from '@/features/repairs/model/repair.types';
import { useTechnicianProfile } from '@/features/technician/hooks/useTechnicianProfile';
import { useTechnicianRepairs } from '@/features/technician/hooks/useTechnicianRepairs';
import { TechnicianPortalLayout } from '@/features/technician/shared/ui/TechnicianPortalLayout';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function isRelationObject<T>(relation: DirectusRelation<T>): relation is T {
  return typeof relation === 'object' && relation !== null;
}

function getWorkshopId(resource: DirectusResource | null | undefined): number | null {
  const workshop = resource?.workshop_id;

  if (typeof workshop === 'number') {
    return workshop;
  }

  return workshop?.id ?? null;
}

function getWorkshopLabel(resource: DirectusResource | null | undefined): string {
  const workshop = resource?.workshop_id ?? null;

  if (typeof workshop === 'number') {
    return `Atelier #${workshop}`;
  }

  if (isRelationObject(workshop)) {
    return (
      workshop.name?.trim() ||
      workshop.label?.trim() ||
      `Atelier #${workshop.id}`
    );
  }

  return 'Atelier #-';
}

function getResourceId(repair: DirectusRepair): number | null {
  const resource = repair.resource_id ?? null;

  if (typeof resource === 'number') {
    return resource;
  }

  return resource?.id ?? null;
}

function getRepairWorkshopId(repair: DirectusRepair): number | null {
  const workshop = repair.workshop_id ?? null;

  if (typeof workshop === 'number') {
    return workshop;
  }

  return workshop?.id ?? null;
}

function getRelationLabel<
  T extends { id: number; label?: string | null; name?: string | null }
>(relation: DirectusRelation<T>, fallback: string): string {
  if (!isRelationObject(relation)) {
    return fallback;
  }

  return relation.name?.trim() || relation.label?.trim() || fallback;
}

function getVehicle(repair: DirectusRepair): DirectusVehicle | null {
  const vehicle = repair.vehicle_id ?? null;

  return isRelationObject(vehicle) ? vehicle : null;
}

function getBrand(repair: DirectusRepair): DirectusRelation<DirectusBrand> {
  const vehicle = getVehicle(repair);

  return vehicle?.brand_id ?? repair.brand_id ?? null;
}

function getVehicleLabel(repair: DirectusRepair): string {
  const vehicle = getVehicle(repair);

  if (!vehicle) {
    return typeof repair.vehicle_id === 'number'
      ? `Véhicule #${repair.vehicle_id}`
      : 'Véhicule non renseigné';
  }

  const vehicleRecord = vehicle as unknown as Record<string, unknown>;
  const brandName = getRelationLabel(getBrand(repair), '');
  const model =
    vehicle.model?.trim() ||
    (typeof vehicleRecord.label === 'string' ? vehicleRecord.label.trim() : '') ||
    (typeof vehicleRecord.name === 'string' ? vehicleRecord.name.trim() : '');
  const registration =
    vehicle.registration_number?.trim() ||
    (typeof vehicleRecord.license_plate === 'string'
      ? vehicleRecord.license_plate.trim()
      : '') ||
    (typeof vehicleRecord.immatriculation === 'string'
      ? vehicleRecord.immatriculation.trim()
      : '');

  return [brandName, model, registration]
    .filter((value): value is string => Boolean(value))
    .join(' · ') || `Véhicule #${vehicle.id}`;
}

function getServiceTypeName(repair: DirectusRepair): string {
  return getRelationLabel<DirectusServiceType>(
    repair.service_type_id ?? null,
    typeof repair.service_type_id === 'number'
      ? `Service #${repair.service_type_id}`
      : 'Service non renseigné'
  );
}

function getStatusName(repair: DirectusRepair): string {
  return getRelationLabel<DirectusStatus>(
    repair.status_id ?? null,
    typeof repair.status_id === 'number'
      ? `Statut #${repair.status_id}`
      : 'Statut non renseigné'
  );
}

function getRecordStringValue(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];

  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR');
}

function isMechanicalRepair(repair: DirectusRepair): boolean {
  const record = repair as unknown as Record<string, unknown>;
  const serviceType = repair.service_type_id ?? null;
  const serviceTypeLabel = isRelationObject(serviceType)
    ? serviceType.name ?? serviceType.label ?? ''
    : '';
  const searchText = normalizeSearchText(
    [
      serviceTypeLabel,
      repair.type,
      repair.description,
      getRecordStringValue(record, 'service'),
      getRecordStringValue(record, 'service_label'),
      getRecordStringValue(record, 'service_type'),
      getRecordStringValue(record, 'category'),
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
  );

  return (
    searchText.includes('mecanique') ||
    searchText.includes('diagnostic') ||
    /\bmec\b/.test(searchText)
  );
}

function isCompletedRepair(repair: DirectusRepair): boolean {
  const statusName = getStatusName(repair);

  return ['completed', 'complete', 'terminé', 'termine', 'clôturé', 'cloture'].some(
    (value) => statusName.toLocaleLowerCase('fr-FR').includes(value)
  );
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getRepairDateValue(repair: DirectusRepair): string | null {
  return (
    repair.entry_date ??
    repair.appointment_date ??
    repair.start_date ??
    repair.date_created ??
    null
  );
}

function getRepairDateKey(repair: DirectusRepair): string | null {
  const value = getRepairDateValue(repair);

  if (!value) {
    return null;
  }

  return value.includes('T') ? value.slice(0, 10) : value;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Date non renseignée';
  }

  const normalizedValue = value.includes('T') ? value : `${value}T12:00:00`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getTechnicianAssignmentLabel(
  repair: DirectusRepair,
  technician: DirectusResource
): string {
  const assignedResourceId = getResourceId(repair);

  if (assignedResourceId === null) {
    return 'Non affecté';
  }

  if (assignedResourceId === technician.id) {
    return technician.full_name?.trim() || 'Vous';
  }

  return 'Affecté';
}

function sortRepairsForTodaySection(
  left: DirectusRepair,
  right: DirectusRepair
): number {
  const leftAssigned = getResourceId(left) !== null;
  const rightAssigned = getResourceId(right) !== null;

  if (leftAssigned !== rightAssigned) {
    return leftAssigned ? 1 : -1;
  }

  const leftDate = getRepairDateKey(left) ?? '';
  const rightDate = getRepairDateKey(right) ?? '';

  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }

  return right.id - left.id;
}

function getDashboardRepairs(
  repairs: DirectusRepair[],
  workshopId: number | null
): DirectusRepair[] {
  if (workshopId === null) {
    return [];
  }

  const today = formatLocalDate(new Date());
  const todayMechanicalRepairs = repairs.filter(
    (repair) =>
      getRepairDateKey(repair) === today &&
      getRepairWorkshopId(repair) === workshopId &&
      isMechanicalRepair(repair)
  );

  return [...todayMechanicalRepairs].sort(sortRepairsForTodaySection).slice(0, 5);
}

export function TechnicianDashboardScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const profileQuery = useTechnicianProfile();
  const resource = profileQuery.data ?? null;
  const workshopId = getWorkshopId(resource);
  const workshopLabel = getWorkshopLabel(resource);
  const repairsQuery = useTechnicianRepairs(workshopId);
  const repairs = repairsQuery.data ?? [];
  const assignedToMe = repairs.filter((repair) => getResourceId(repair) === resource?.id);
  const unassigned = repairs.filter((repair) => getResourceId(repair) === null);
  const completed = repairs.filter(isCompletedRepair);
  const dashboardRepairs = getDashboardRepairs(repairs, workshopId);

  if (profileQuery.isLoading) {
    return (
      <TechnicianPortalLayout activeRoute="/technician/dashboard">
        <View style={styles.stateContainer}>
          <LoadingState message="Chargement du profil technicien..." />
        </View>
      </TechnicianPortalLayout>
    );
  }

  if (profileQuery.isError) {
    return (
      <TechnicianPortalLayout activeRoute="/technician/dashboard">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Erreur de chargement"
            message="Impossible de charger votre profil technicien."
            onRetry={() => {
              profileQuery.refetch();
            }}
          />
        </View>
      </TechnicianPortalLayout>
    );
  }

  if (!resource) {
    return (
      <TechnicianPortalLayout activeRoute="/technician/dashboard">
        <View style={styles.stateContainer}>
          <EmptyState
            title="Profil technicien introuvable"
            message="Aucun profil technicien actif n’est lié à ce compte."
          />
        </View>
      </TechnicianPortalLayout>
    );
  }

  return (
    <TechnicianPortalLayout activeRoute="/technician/dashboard">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={[styles.header, isNarrow && styles.stack]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{workshopLabel}</Text>
            <Text style={styles.title}>Bonjour {resource.full_name ?? 'Technicien'}</Text>
            <Text style={styles.subtitle}>
              Spécialité : {resource.specialty ?? 'Non renseignée'}
            </Text>
          </View>
          <Link href={'/technician/repairs' as never} asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.primaryButton,
                hovered && styles.primaryButtonHovered,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{ ios: 'wrench.and.screwdriver', android: 'build', web: 'build' }}
                size={18}
                tintColor="#FFFFFF"
              />
              <Text style={styles.primaryButtonText}>Dossiers réparation</Text>
            </Pressable>
          </Link>
        </View>

        <View style={[styles.statsGrid, isNarrow && styles.stack]}>
          <StatCard icon={{ ios: 'tray.full', android: 'folder', web: 'folder' }} label="Total dossiers atelier" value={repairs.length} />
          <StatCard icon={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }} label="Dossiers non affectés" value={unassigned.length} />
          <StatCard icon={{ ios: 'person.crop.circle.badge.checkmark', android: 'engineering', web: 'engineering' }} label="Mes dossiers" value={assignedToMe.length} />
          <StatCard icon={{ ios: 'checkmark.seal', android: 'check_circle', web: 'check_circle' }} label="Dossiers terminés" value={completed.length} />
        </View>

        <View style={styles.todayPanel}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionTitle}>Réparations du jour</Text>
              <Text style={styles.sectionSubtitle}>
                Dossiers ouverts ou récemment entrés dans votre atelier.
              </Text>
            </View>
          </View>

          {repairsQuery.isLoading ? (
            <LoadingState message="Chargement des réparations du jour..." />
          ) : null}

          {repairsQuery.isError ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Données dossiers indisponibles</Text>
              <Text style={styles.noticeText}>
                Impossible de charger les réparations de votre atelier.
              </Text>
            </View>
          ) : null}

          {!repairsQuery.isLoading && !repairsQuery.isError && dashboardRepairs.length === 0 ? (
            <View style={styles.emptyTodayPanel}>
              <Text style={styles.emptyTodayText}>
                Aucune réparation mécanique prévue aujourd’hui.
              </Text>
            </View>
          ) : null}

          {!repairsQuery.isLoading && !repairsQuery.isError && dashboardRepairs.length > 0 ? (
            <View style={styles.todayList}>
              {dashboardRepairs.map((repair) => (
                <TodayRepairCard
                  key={repair.id}
                  repair={repair}
                  technician={resource}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </TechnicianPortalLayout>
  );
}

type StatCardProps = {
  icon: SymbolName;
  label: string;
  value: number;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <SymbolView name={icon} size={18} tintColor="#2F5FA6" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type TodayRepairCardProps = {
  repair: DirectusRepair;
  technician: DirectusResource;
};

function TodayRepairCard({ repair, technician }: TodayRepairCardProps) {
  return (
    <View style={styles.todayCard}>
      <View style={styles.todayCardHeader}>
        <View style={styles.todayCardTitleBlock}>
          <Text style={styles.todayCardKicker}>Dossier #{repair.id}</Text>
          <Text style={styles.todayCardTitle}>{getVehicleLabel(repair)}</Text>
        </View>
        <Text style={styles.statusBadge}>{getStatusName(repair)}</Text>
      </View>

      <View style={styles.todayInfoGrid}>
        <InfoCell label="Service" value={getServiceTypeName(repair)} />
        <InfoCell label="Entrée" value={formatDate(getRepairDateValue(repair))} />
        <InfoCell
          label="Technicien"
          value={getTechnicianAssignmentLabel(repair, technician)}
        />
      </View>

      <Link href={'/technician/repairs' as never} asChild>
        <Pressable
          accessibilityRole="link"
          style={({ hovered, pressed }) => [
            styles.secondaryButton,
            hovered && styles.secondaryButtonHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Voir le dossier</Text>
        </Pressable>
      </Link>
    </View>
  );
}

type InfoCellProps = {
  label: string;
  value: string;
};

function InfoCell({ label, value }: InfoCellProps) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoCellValue}>
        {value}
      </Text>
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
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#15294D',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.06,
    shadowRadius: 28,
  },
  stack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  title: {
    color: '#15294D',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    color: '#5A6470',
    fontSize: typography.fontSize.md,
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    backgroundColor: '#2F5FA6',
  },
  primaryButtonHovered: {
    backgroundColor: '#244F8F',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 180,
    minHeight: 138,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  statIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#EDF4FF',
  },
  statValue: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  statLabel: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  notice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EBCB8C',
    borderRadius: 18,
    backgroundColor: '#FFF9EC',
    gap: spacing.xs,
  },
  noticeTitle: {
    color: '#9A5B13',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  noticeText: {
    color: '#6B4B16',
    fontSize: typography.fontSize.sm,
  },
  todayPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  sectionSubtitle: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  todayList: {
    gap: spacing.md,
  },
  todayCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  todayCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  todayCardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  todayCardKicker: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  todayCardTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 999,
    backgroundColor: '#EDF5FD',
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  todayInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoCell: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 132,
    gap: spacing.xs,
  },
  infoCellLabel: {
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  infoCellValue: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 14,
    backgroundColor: '#EDF5FD',
  },
  secondaryButtonHovered: {
    borderColor: '#2F5FA6',
    backgroundColor: '#F7FAFF',
  },
  secondaryButtonText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  emptyTodayPanel: {
    minHeight: 104,
    justifyContent: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  emptyTodayText: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  statePanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.86,
  },
});
