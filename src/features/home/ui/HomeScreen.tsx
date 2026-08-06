import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import type { DirectusNotification } from '@/core/api/notifications.api';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useAppointmentsHistory } from '@/features/appointments/hooks/useAppointmentsHistory';
import type { AppointmentListItem } from '@/features/appointments/model/appointment.types';
import {
  CLIENT_REPAIR_PROGRESS_STEPS,
  getClientStatusLabel,
  type ClientRepairViewModel,
} from '@/features/repairs/model/client-repair.presenter';
import {
  useMarkNotificationAsRead,
  useNotifications,
} from '@/features/notifications/hooks/useNotifications';
import { useClientRepairPresentation } from '@/features/repairs/hooks/useClientRepairPresentation';
import { useRepairs } from '@/features/repairs/hooks/useRepairs';
import { getBrandLogo } from '@/features/vehicles/model/brand-logo';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';
import type { AuthCustomer, AuthUser } from '@/store/auth.store';
import { useAuthStore } from '@/store/auth.store';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

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

function cleanDisplayValue(
  value: string | null | undefined,
  fallback = "En attente d'information"
): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return fallback;
  }

  const normalizedValue = trimmedValue.toLocaleLowerCase('fr-FR');

  if (
    normalizedValue.includes('unknown') ||
    normalizedValue.includes('non renseign') ||
    /^(statut|status|service|atelier|véhicule|vehicule|dossier|document|marque)\s*#/.test(
      normalizedValue
    )
  ) {
    return fallback;
  }

  return trimmedValue;
}

function normalizeStatus(value?: string | null): string {
  return (
    value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr-FR')
      .replace(/[-_]/g, ' ') ?? ''
  );
}

type RepairProgressState = 'complete' | 'active' | 'future';

function isAppointmentActive(appointment: AppointmentListItem): boolean {
  const status = normalizeStatus(appointment.status);

  return !['annul', 'cancel', 'termin', 'complete'].some((value) =>
    status.includes(value)
  );
}

function getVehicleTitle(vehicle: VehicleListItem): string {
  return cleanDisplayValue(
    `${vehicle.brandName} ${vehicle.model}`,
    "Véhicule en attente d'information"
  );
}

function getVehicleReference(vehicle: VehicleListItem): string {
  return cleanDisplayValue(
    vehicle.registrationNumber,
    cleanDisplayValue(vehicle.vin, 'Référence en attente')
  );
}

function formatNotificationDate(value?: string | null): string {
  if (!value) {
    return 'Date non renseignée';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

type ServiceHistoryItem = {
  date: string;
  service: string;
  sortValue: number;
  status: string;
  type: 'Rendez-vous' | 'Réparation';
  workshop: string;
};

function getServiceHistory(
  appointments: AppointmentListItem[],
  repairs: ClientRepairViewModel[]
): ServiceHistoryItem[] {
  const appointmentItems = appointments.map((appointment) => ({
    date: cleanDisplayValue(appointment.requestedDate, 'Date non renseignée'),
    service: cleanDisplayValue(appointment.serviceType, 'Service atelier'),
    sortValue: new Date(appointment.requestedDateValue).getTime() || 0,
    status: getClientStatusLabel(appointment.status),
    type: 'Rendez-vous' as const,
    workshop: cleanDisplayValue(appointment.workshop, 'Atelier SMEIA'),
  }));
  const repairItems = repairs.map((repair) => ({
    date: repair.entryDateLabel,
    service: repair.serviceLabel,
    sortValue: repair.entryDateValue
      ? new Date(repair.entryDateValue).getTime() || 0
      : 0,
    status: repair.statusLabel,
    type: 'Réparation' as const,
    workshop: repair.workshopLabel,
  }));

  return [...appointmentItems, ...repairItems]
    .sort((first, second) => second.sortValue - first.sortValue)
    .slice(0, 5);
}

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const repairsQuery = useRepairs();
  const appointmentsQuery = useAppointmentsHistory();
  const notificationsQuery = useNotifications();
  const markNotificationAsRead = useMarkNotificationAsRead();
  const repairs = repairsQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];
  const repairPresentation = useClientRepairPresentation(
    repairs,
    appointments
  );
  const vehiclesQuery = repairPresentation.vehiclesQuery;
  const vehicles = vehiclesQuery.data ?? [];
  const presentedRepairs = repairPresentation.data;
  const activeRepairs = presentedRepairs
    .filter((repair) => repair.isActive)
    .sort((first, second) => second.sortValue - first.sortValue);
  const isRepairPresentationLoading =
    repairsQuery.isLoading || repairPresentation.isLoading;
  const activeAppointments = appointments.filter(isAppointmentActive);
  const unreadNotifications = notifications.filter(
    (notification) => !notification.read_at
  );
  const nextAppointment = activeAppointments[0] ?? null;
  const serviceHistory = getServiceHistory(appointments, presentedRepairs);
  const clientName = getDisplayName(customer, user);

  return (
    <ClientPortalLayout activeRoute="/">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <DashboardHeader
          clientName={clientName}
          isNarrow={isNarrow}
          unreadCount={unreadNotifications.length}
        />

        <RepairProgressCard
          hasError={repairsQuery.isError}
          isLoading={isRepairPresentationLoading}
          isNarrow={isNarrow}
          repair={activeRepairs[0] ?? null}
        />

        <View style={[styles.dashboardGrid, isNarrow && styles.stack]}>
          <View style={styles.mainColumn}>
            <VehiclesShowcase
              activeRepairs={activeRepairs}
              hasError={vehiclesQuery.isError}
              isNarrow={isNarrow}
              isLoading={vehiclesQuery.isLoading}
              vehicles={vehicles}
            />

            <View style={[styles.serviceCardsGrid, isNarrow && styles.stack]}>
              <AppointmentCard
                appointment={nextAppointment}
                hasError={appointmentsQuery.isError}
                isLoading={appointmentsQuery.isLoading}
              />
              <CurrentRepairCard
                hasError={repairsQuery.isError}
                isLoading={isRepairPresentationLoading}
                repairs={activeRepairs}
              />
            </View>

            <ServiceHistoryCard
              hasError={
                appointmentsQuery.isError && repairsQuery.isError
              }
              items={serviceHistory}
            />
          </View>

          <View style={styles.sideColumn}>
            <SavSummaryPanel
              activeAppointmentsCount={activeAppointments.length}
              activeRepairsCount={activeRepairs.length}
              unreadNotificationsCount={unreadNotifications.length}
              vehiclesCount={vehicles.length}
            />

            <NotificationsCard
              errorMessage={
                notificationsQuery.isError
                  ? 'Impossible de charger vos notifications pour le moment.'
                  : null
              }
              isLoading={notificationsQuery.isLoading}
              isMarkingRead={markNotificationAsRead.isPending}
              notifications={notifications}
              onMarkAsRead={(notificationId) => {
                markNotificationAsRead.mutate(notificationId);
              }}
            />
          </View>
        </View>
      </ScrollView>
    </ClientPortalLayout>
  );
}

type DashboardHeaderProps = {
  clientName: string;
  isNarrow: boolean;
  unreadCount: number;
};

function DashboardHeader({
  clientName,
  isNarrow,
  unreadCount,
}: DashboardHeaderProps) {
  return (
    <View style={[styles.headerPanel, isNarrow && styles.headerPanelNarrow]}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>Portail client SMEIA</Text>
        <Text style={styles.title}>Tableau de bord</Text>
        <Text style={styles.subtitle}>
          Bonjour {clientName}. Retrouvez vos véhicules, rendez-vous et suivis SAV.
        </Text>
      </View>

      <View style={styles.headerActions}>
        <View style={styles.notificationPill}>
          <SymbolView
            name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
            size={16}
            tintColor="#2F5FA6"
          />
          <Text style={styles.notificationPillText}>
            {unreadCount} non lue(s)
          </Text>
        </View>

        <View
          style={[
            styles.heroActionRow,
            isNarrow && styles.heroActionRowNarrow,
          ]}
        >
          <Link href="/appointments" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.heroPrimaryAction,
                isNarrow && styles.heroActionNarrow,
                hovered && styles.heroPrimaryActionHovered,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'calendar.badge.plus',
                  android: 'event',
                  web: 'event',
                }}
                size={17}
                tintColor="#15294D"
              />
              <Text style={styles.heroPrimaryActionText}>
                Prendre rendez-vous
              </Text>
            </Pressable>
          </Link>

          <Link href="/repairs" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.heroSecondaryAction,
                isNarrow && styles.heroActionNarrow,
                hovered && styles.heroSecondaryActionHovered,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'wrench.and.screwdriver',
                  android: 'build',
                  web: 'build',
                }}
                size={17}
                tintColor="#FFFFFF"
              />
              <Text style={styles.heroSecondaryActionText}>
                Voir mes réparations
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

type RepairProgressCardProps = {
  hasError: boolean;
  isLoading: boolean;
  isNarrow: boolean;
  repair: ClientRepairViewModel | null;
};

function RepairProgressCard({
  hasError,
  isLoading,
  isNarrow,
  repair,
}: RepairProgressCardProps) {
  const progress = repair?.progress ?? null;

  return (
    <View style={styles.progressPanel}>
      <View
        style={[
          styles.progressHeader,
          isNarrow && styles.progressHeaderNarrow,
        ]}
      >
        <View style={styles.sectionCopy}>
          <Text style={styles.progressEyebrow}>Suivi atelier</Text>
          <Text style={styles.progressTitle}>Avancement de votre réparation</Text>
          <Text style={styles.sectionDescription}>
            Suivez les principales étapes de prise en charge de votre véhicule.
          </Text>
        </View>
        {repair ? (
          <View style={styles.progressStatusBadge}>
            <View style={styles.progressStatusDot} />
            <Text numberOfLines={1} style={styles.progressStatusText}>
              {repair.statusLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <RepairProgressSkeleton isNarrow={isNarrow} />
      ) : hasError ? (
        <EmptyPanel
          text="L'avancement de votre réparation est temporairement indisponible."
          compact
        />
      ) : !repair || !progress ? (
        <EmptyPanel text="Aucune réparation en cours pour le moment." compact />
      ) : (
        <>
          <View style={styles.progressSummary}>
            <ProgressMeta label="Référence" value={repair.referenceLabel} />
            <ProgressMeta label="Véhicule" value={repair.vehicleLabel} />
            <ProgressMeta label="Atelier" value={repair.workshopLabel} />
            <ProgressMeta
              label="Date d'entrée"
              value={repair.entryDateLabel}
            />
          </View>

          <View
            style={[
              styles.progressTimeline,
              isNarrow && styles.progressTimelineNarrow,
            ]}
          >
            {CLIENT_REPAIR_PROGRESS_STEPS.map((step, index) => {
              const state: RepairProgressState =
                index <= progress.completedThrough
                  ? 'complete'
                  : index === progress.activeIndex
                    ? 'active'
                    : 'future';
              const connectorComplete = index < progress.activeIndex;

              return (
                <View
                  key={step}
                  style={[
                    styles.progressStep,
                    isNarrow && styles.progressStepNarrow,
                  ]}
                >
                  <View
                    style={[
                      styles.progressMarkerTrack,
                      isNarrow && styles.progressMarkerTrackNarrow,
                    ]}
                  >
                    <View
                      style={[
                        styles.progressMarker,
                        state === 'complete' && styles.progressMarkerComplete,
                        state === 'active' && styles.progressMarkerActive,
                      ]}
                    >
                      {state === 'complete' ? (
                        <SymbolView
                          name={{
                            ios: 'checkmark',
                            android: 'check',
                            web: 'check',
                          }}
                          size={15}
                          tintColor="#FFFFFF"
                        />
                      ) : (
                        <Text
                          style={[
                            styles.progressMarkerText,
                            state === 'active' &&
                              styles.progressMarkerTextCurrent,
                          ]}
                        >
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    {index < CLIENT_REPAIR_PROGRESS_STEPS.length - 1 ? (
                      <View
                        style={[
                          styles.progressConnector,
                          connectorComplete && styles.progressConnectorComplete,
                          isNarrow && styles.progressConnectorNarrow,
                        ]}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.progressStepLabel,
                      state === 'complete' && styles.progressStepLabelComplete,
                      state === 'active' && styles.progressStepLabelActive,
                      isNarrow && styles.progressStepLabelNarrow,
                    ]}
                  >
                    {step}
                  </Text>
                  {state === 'active' ? (
                    <Text
                      style={[
                        styles.progressStepCaption,
                        isNarrow && styles.progressStepCaptionNarrow,
                      ]}
                    >
                      Étape actuelle
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View
            style={[
              styles.progressFooter,
              isNarrow && styles.progressFooterNarrow,
            ]}
          >
            <View style={styles.progressMessageBlock}>
              <SymbolView
                name={{
                  ios: 'shield.checkered',
                  android: 'verified_user',
                  web: 'verified_user',
                }}
                size={18}
                tintColor="#2F5FA6"
              />
              <View style={styles.progressMessageCopy}>
                <Text style={styles.progressMessage}>{repair.message}</Text>
                <Text style={styles.progressContext}>
                  {repair.workshopLabel} · {repair.vehicleLabel} · Entrée le{' '}
                  {repair.entryDateLabel}
                </Text>
              </View>
            </View>
            <Link href="/repairs" asChild>
              <Pressable
                accessibilityRole="link"
                style={({ hovered, pressed }) => [
                  styles.progressAction,
                  hovered && styles.progressActionHovered,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.progressActionText}>Voir le dossier</Text>
              </Pressable>
            </Link>
          </View>
        </>
      )}
    </View>
  );
}

function RepairProgressSkeleton({ isNarrow }: { isNarrow: boolean }) {
  return (
    <View
      accessibilityLabel="Chargement de l'avancement de votre réparation"
      style={styles.progressSkeleton}
    >
      <View style={styles.progressSkeletonSummary}>
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.progressSkeletonMeta}>
            <View style={styles.progressSkeletonLabel} />
            <View style={styles.progressSkeletonValue} />
          </View>
        ))}
      </View>
      <View
        style={[
          styles.progressSkeletonTimeline,
          isNarrow && styles.progressSkeletonTimelineNarrow,
        ]}
      >
        {CLIENT_REPAIR_PROGRESS_STEPS.map((step) => (
          <View
            key={step}
            style={[
              styles.progressSkeletonStep,
              isNarrow && styles.progressSkeletonStepNarrow,
            ]}
          >
            <View style={styles.progressSkeletonMarker} />
            <View style={styles.progressSkeletonStepLabel} />
          </View>
        ))}
      </View>
    </View>
  );
}

type ProgressMetaProps = {
  label: string;
  value: string;
};

function ProgressMeta({ label, value }: ProgressMetaProps) {
  return (
    <View style={styles.progressMetaItem}>
      <Text style={styles.progressMetaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.progressMetaValue}>
        {value}
      </Text>
    </View>
  );
}

type VehiclesShowcaseProps = {
  activeRepairs: ClientRepairViewModel[];
  hasError: boolean;
  isNarrow: boolean;
  isLoading: boolean;
  vehicles: VehicleListItem[];
};

function VehiclesShowcase({
  activeRepairs,
  hasError,
  isNarrow,
  isLoading,
  vehicles,
}: VehiclesShowcaseProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null
  );
  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    vehicles[0] ??
    null;
  const selectedVehicleStatus = selectedVehicle
    ? cleanDisplayValue(
        activeRepairs.find(
          (repair) => repair.vehicleId === selectedVehicle.id
        )?.statusLabel,
        ''
      )
    : '';
  const selectedBrandLogo = selectedVehicle
    ? getBrandLogo(selectedVehicle.brandName)
    : null;

  return (
    <View style={styles.vehiclePanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>Mes véhicules</Text>
          <Text style={styles.sectionDescription}>
            Votre garage SMEIA, avec le véhicule principal en vue atelier.
          </Text>
        </View>
        <Link href="/vehicles" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ hovered, pressed }) => [
              styles.secondaryAction,
              hovered && styles.secondaryActionHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>Voir tout</Text>
          </Pressable>
        </Link>
      </View>

      {isLoading ? (
        <EmptyPanel text="Chargement de vos véhicules..." />
      ) : hasError ? (
        <EmptyPanel text="Impossible de charger vos véhicules pour le moment." />
      ) : !selectedVehicle ? (
        <EmptyPanel text="Aucun véhicule enregistré pour le moment." />
      ) : (
        <View style={styles.vehicleWorkspace}>
          {vehicles.length > 1 ? (
            <View style={styles.vehicleSelector}>
              {vehicles.slice(0, 4).map((vehicle) => {
                const isSelected = vehicle.id === selectedVehicle.id;
                const vehicleBrandLogo = getBrandLogo(vehicle.brandName);

                return (
                  <Pressable
                    key={vehicle.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedVehicleId(vehicle.id);
                    }}
                    style={({ hovered, pressed }) => [
                      styles.vehicleSelectorItem,
                      isSelected && styles.vehicleSelectorItemActive,
                      hovered && !isSelected && styles.vehicleSelectorItemHovered,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.vehicleSelectorIcon,
                        isSelected && styles.vehicleSelectorIconActive,
                        vehicleBrandLogo &&
                          'needsLightSurface' in vehicleBrandLogo &&
                          vehicleBrandLogo.needsLightSurface &&
                          styles.vehicleSelectorIconLight,
                      ]}
                    >
                      {vehicleBrandLogo ? (
                        <Image
                          accessibilityLabel={`Logo ${vehicleBrandLogo.name}`}
                          contentFit="contain"
                          source={vehicleBrandLogo.source}
                          style={styles.vehicleSelectorLogo}
                        />
                      ) : (
                        <SymbolView
                          name={{
                            ios: 'car',
                            android: 'directions_car',
                            web: 'directions_car',
                          }}
                          size={20}
                          tintColor={isSelected ? '#FFFFFF' : '#2F5FA6'}
                        />
                      )}
                    </View>
                    <View style={styles.vehicleSelectorCopy}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.vehicleMiniTitle,
                          isSelected && styles.vehicleMiniTitleActive,
                        ]}
                      >
                        {getVehicleTitle(vehicle)}
                      </Text>
                      <Text numberOfLines={1} style={styles.vehicleMiniMeta}>
                        {getVehicleReference(vehicle)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View
            style={[
              styles.heroVehicleCard,
              isNarrow && styles.heroVehicleCardNarrow,
            ]}
          >
            <View style={styles.vehicleVisualStage}>
              {selectedBrandLogo ? (
                <View
                  style={[
                    styles.vehicleBrandLogoFrame,
                    'needsLightSurface' in selectedBrandLogo &&
                      selectedBrandLogo.needsLightSurface &&
                      styles.vehicleBrandLogoFrameLight,
                  ]}
                >
                  <Image
                    accessibilityLabel={`Logo ${selectedBrandLogo.name}`}
                    contentFit="contain"
                    source={selectedBrandLogo.source}
                    style={styles.vehicleBrandLogo}
                  />
                </View>
              ) : (
                <SymbolView
                  name={{
                    ios: 'car',
                    android: 'directions_car',
                    web: 'directions_car',
                  }}
                  size={92}
                  tintColor="#8FB7E8"
                />
              )}
              <View style={styles.vehicleGroundLine} />
            </View>

            <View style={styles.vehicleIdentity}>
              <View style={styles.vehicleIdentityTopline}>
                <Text style={styles.heroVehicleEyebrow}>Véhicule sélectionné</Text>
                {selectedVehicleStatus ? (
                  <View style={styles.heroVehicleStatus}>
                    <View style={styles.heroVehicleStatusDot} />
                    <Text numberOfLines={1} style={styles.heroVehicleStatusText}>
                      {selectedVehicleStatus}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.heroVehicleName}>
                {getVehicleTitle(selectedVehicle)}
              </Text>
              <Text style={styles.heroVehicleMeta}>
                {getVehicleReference(selectedVehicle)}
              </Text>

              <View style={styles.vehicleFacts}>
                <VehicleFact
                  label="Kilométrage"
                  value={cleanDisplayValue(
                    selectedVehicle.mileage,
                    'Kilométrage non renseigné'
                  )}
                />
                <VehicleFact
                  label="Année"
                  value={cleanDisplayValue(
                    selectedVehicle.year,
                    'Année non renseignée'
                  )}
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

type VehicleFactProps = {
  label: string;
  value: string;
};

function VehicleFact({ label, value }: VehicleFactProps) {
  return (
    <View style={styles.vehicleFact}>
      <Text style={styles.vehicleFactLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.vehicleFactValue}>
        {value}
      </Text>
    </View>
  );
}

type AppointmentCardProps = {
  appointment: AppointmentListItem | null;
  hasError: boolean;
  isLoading: boolean;
};

function AppointmentCard({
  appointment,
  hasError,
  isLoading,
}: AppointmentCardProps) {
  return (
    <View style={styles.serviceCard}>
      <SectionTopline
        icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
        title="Prochain rendez-vous"
      />
      {isLoading ? (
        <EmptyPanel text="Chargement du prochain rendez-vous..." compact />
      ) : hasError ? (
        <EmptyPanel
          text="Suivi des rendez-vous temporairement indisponible."
          compact
        />
      ) : appointment ? (
        <>
          <View style={styles.detailRows}>
            <InfoRow
              label="Service"
              value={cleanDisplayValue(
                appointment.serviceType,
                'Service atelier'
              )}
            />
            <InfoRow
              label="Date / heure"
              value={`${appointment.requestedDate} · ${appointment.requestedTime}`}
            />
            <InfoRow
              label="Atelier"
              value={cleanDisplayValue(appointment.workshop, 'Atelier SMEIA')}
            />
            <InfoRow
              label="Statut"
              value={getClientStatusLabel(appointment.status)}
            />
          </View>
          <Link href="/history" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.cardAction,
                hovered && styles.cardActionHovered,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cardActionText}>Voir le rendez-vous</Text>
              <SymbolView
                name={{
                  ios: 'arrow.right',
                  android: 'arrow_forward',
                  web: 'arrow_forward',
                }}
                size={16}
                tintColor="#2F5FA6"
              />
            </Pressable>
          </Link>
        </>
      ) : (
        <EmptyPanel text="Aucun rendez-vous actif." compact />
      )}
    </View>
  );
}

type CurrentRepairCardProps = {
  hasError: boolean;
  isLoading: boolean;
  repairs: ClientRepairViewModel[];
};

function CurrentRepairCard({
  hasError,
  isLoading,
  repairs,
}: CurrentRepairCardProps) {
  return (
    <View style={styles.serviceCard}>
      <SectionTopline
        icon={{ ios: 'wrench', android: 'build', web: 'build' }}
        title="Réparations en cours"
      />
      {isLoading ? (
        <EmptyPanel text="Chargement du suivi réparation..." compact />
      ) : hasError ? (
        <EmptyPanel
          text="Suivi des réparations temporairement indisponible."
          compact
        />
      ) : repairs.length > 0 ? (
        <>
          <View style={styles.activeRepairList}>
            {repairs.slice(0, 2).map((repair) => (
              <View key={repair.id} style={styles.activeRepairRow}>
                <View style={styles.activeRepairHeader}>
                  <Text numberOfLines={1} style={styles.activeRepairDocument}>
                    {repair.referenceLabel}
                  </Text>
                  <Text numberOfLines={1} style={styles.activeRepairStatus}>
                    {repair.statusLabel}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.activeRepairMeta}>
                  {repair.serviceLabel} · {repair.workshopLabel}
                </Text>
              </View>
            ))}
          </View>
          <Link href="/repairs" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.cardAction,
                hovered && styles.cardActionHovered,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cardActionText}>
                {repairs.length > 1
                  ? `Voir les ${repairs.length} dossiers`
                  : 'Suivre le dossier'}
              </Text>
              <SymbolView
                name={{
                  ios: 'arrow.right',
                  android: 'arrow_forward',
                  web: 'arrow_forward',
                }}
                size={16}
                tintColor="#2F5FA6"
              />
            </Pressable>
          </Link>
        </>
      ) : (
        <EmptyPanel text="Aucune réparation active." compact />
      )}
    </View>
  );
}

type SavSummaryPanelProps = {
  activeAppointmentsCount: number;
  activeRepairsCount: number;
  unreadNotificationsCount: number;
  vehiclesCount: number;
};

function SavSummaryPanel({
  activeAppointmentsCount,
  activeRepairsCount,
  unreadNotificationsCount,
  vehiclesCount,
}: SavSummaryPanelProps) {
  return (
    <View style={styles.savPanel}>
      <View style={styles.savHeader}>
        <Text style={styles.sectionTitle}>Suivi SAV</Text>
        <Text style={styles.sectionDescription}>Votre activité en un regard.</Text>
      </View>
      <View style={styles.metricList}>
        <MetricRow
          icon={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
          label="Véhicules enregistrés"
          value={vehiclesCount}
        />
        <MetricRow
          icon={{ ios: 'wrench', android: 'build', web: 'build' }}
          label="Réparations en cours"
          value={activeRepairsCount}
        />
        <MetricRow
          icon={{ ios: 'calendar', android: 'event', web: 'event' }}
          label="Rendez-vous actifs"
          value={activeAppointmentsCount}
        />
        <MetricRow
          icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
          label="Notifications non lues"
          value={unreadNotificationsCount}
        />
      </View>
    </View>
  );
}

type NotificationsCardProps = {
  errorMessage: string | null;
  isLoading: boolean;
  isMarkingRead: boolean;
  notifications: DirectusNotification[];
  onMarkAsRead: (notificationId: number | string) => void;
};

function NotificationsCard({
  errorMessage,
  isLoading,
  isMarkingRead,
  notifications,
  onMarkAsRead,
}: NotificationsCardProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleNotifications = showAll
    ? notifications
    : notifications.slice(0, 3);

  return (
    <View style={styles.notificationsPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.sectionDescription}>
            Messages récents transmis par l'atelier SMEIA.
          </Text>
        </View>
        {notifications.length > 3 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setShowAll((currentValue) => !currentValue);
            }}
            style={({ hovered, pressed }) => [
              styles.notificationsToggle,
              hovered && styles.notificationsToggleHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.notificationsToggleText}>
              {showAll ? 'Réduire' : 'Voir tout'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <EmptyPanel text="Chargement des notifications..." compact />
      ) : errorMessage ? (
        <EmptyPanel text={errorMessage} compact />
      ) : notifications.length === 0 ? (
        <EmptyPanel text="Aucune notification pour le moment." compact />
      ) : (
        <View style={styles.notificationList}>
          {visibleNotifications.map((notification) => {
            const unread = !notification.read_at;

            return (
              <View
                key={String(notification.id)}
                style={[
                  styles.notificationItem,
                  unread && styles.notificationItemUnread,
                ]}
              >
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationBadge}>
                    {unread ? 'Non lu' : 'Lu'}
                  </Text>
                </View>
                <Text style={styles.notificationMessage}>
                  {notification.message}
                </Text>
                <Text style={styles.notificationDate}>
                  {formatNotificationDate(notification.created_at)}
                </Text>
                {unread ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isMarkingRead}
                    onPress={() => {
                      onMarkAsRead(notification.id);
                    }}
                    style={({ hovered, pressed }) => [
                      styles.markReadButton,
                      hovered && !isMarkingRead && styles.markReadButtonHovered,
                      pressed && !isMarkingRead && styles.pressed,
                      isMarkingRead && styles.disabled,
                    ]}
                  >
                    <Text style={styles.markReadButtonText}>
                      Marquer comme lu
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

type ServiceHistoryCardProps = {
  hasError: boolean;
  items: ServiceHistoryItem[];
};

function ServiceHistoryCard({ hasError, items }: ServiceHistoryCardProps) {
  return (
    <View style={styles.historyPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>Historique service</Text>
          <Text style={styles.sectionDescription}>
            Vos derniers rendez-vous et passages en atelier.
          </Text>
        </View>
        <Link href="/history" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ hovered, pressed }) => [
              styles.secondaryAction,
              hovered && styles.secondaryActionHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>Historique complet</Text>
          </Pressable>
        </Link>
      </View>
      {hasError && items.length === 0 ? (
        <EmptyPanel text="Historique temporairement indisponible." compact />
      ) : items.length === 0 ? (
        <EmptyPanel text="Aucun historique à afficher pour le moment." compact />
      ) : (
        <View style={styles.historyList}>
          {items.map((item, index) => (
            <View key={`${item.type}-${index}`} style={styles.historyRow}>
              <View style={styles.historyTypePill}>
                <Text style={styles.historyTypeText}>{item.type}</Text>
              </View>
              <View style={styles.historyCopy}>
                <Text numberOfLines={1} style={styles.historyTitle}>
                  {item.service}
                </Text>
                <Text numberOfLines={1} style={styles.historyMeta}>
                  {item.date} · {item.workshop}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.historyStatus}>
                {item.status}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type SectionToplineProps = {
  icon: SymbolName;
  title: string;
};

function SectionTopline({ icon, title }: SectionToplineProps) {
  return (
    <View style={styles.cardTopline}>
      <View style={styles.cardIcon}>
        <SymbolView name={icon} size={18} tintColor="#2F5FA6" />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

type MetricRowProps = {
  icon: SymbolName;
  label: string;
  value: number;
};

function MetricRow({ icon, label, value }: MetricRowProps) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricIdentity}>
        <View style={styles.metricIcon}>
          <SymbolView name={icon} size={16} tintColor="#2F5FA6" />
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

type EmptyPanelProps = {
  compact?: boolean;
  text: string;
};

function EmptyPanel({ compact = false, text }: EmptyPanelProps) {
  return (
    <View style={[styles.emptyPanel, compact && styles.emptyPanelCompact]}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 1320,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  stack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  headerPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#0B1220',
    overflow: 'hidden',
  },
  headerPanelNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: '#8FB7E8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    maxWidth: 720,
    color: '#D9E5F5',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  notificationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#EDF5FD',
  },
  notificationPillText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  heroActionRowNarrow: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  heroActionNarrow: {
    width: '100%',
  },
  heroPrimaryAction: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  heroPrimaryActionHovered: {
    backgroundColor: '#EAF2FC',
  },
  heroPrimaryActionText: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  heroSecondaryAction: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: '#65758B',
    borderRadius: 14,
    backgroundColor: '#172238',
  },
  heroSecondaryActionHovered: {
    borderColor: '#8FB7E8',
    backgroundColor: '#22314D',
  },
  heroSecondaryActionText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  progressPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressHeaderNarrow: {
    flexDirection: 'column',
  },
  progressEyebrow: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  progressTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  progressStatusBadge: {
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#EDF4FF',
  },
  progressStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#2F5FA6',
  },
  progressStatusText: {
    flexShrink: 1,
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  progressSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E6EAF2',
  },
  progressMetaItem: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 160,
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  progressMetaLabel: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  progressMetaValue: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  progressTimeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressTimelineNarrow: {
    flexDirection: 'column',
  },
  progressStep: {
    flex: 1,
    minWidth: 0,
  },
  progressStepNarrow: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressMarkerTrack: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressMarkerTrackNarrow: {
    width: 30,
    alignSelf: 'stretch',
    flexDirection: 'column',
  },
  progressMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D5DCE8',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  progressMarkerComplete: {
    borderColor: '#2F7D67',
    backgroundColor: '#2F7D67',
  },
  progressMarkerActive: {
    borderColor: '#2F5FA6',
    backgroundColor: '#2F5FA6',
  },
  progressMarkerText: {
    color: '#8A97A8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  progressMarkerTextCurrent: {
    color: '#FFFFFF',
  },
  progressConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#DDE3EC',
  },
  progressConnectorComplete: {
    backgroundColor: '#7EB7A4',
  },
  progressConnectorNarrow: {
    width: 2,
    height: 'auto',
    minHeight: 28,
  },
  progressStepLabel: {
    maxWidth: 132,
    marginTop: spacing.sm,
    paddingRight: spacing.sm,
    color: '#8A97A8',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  progressStepLabelComplete: {
    color: '#2F7D67',
  },
  progressStepLabelActive: {
    color: '#2F5FA6',
    fontWeight: typography.fontWeight.bold,
  },
  progressStepLabelNarrow: {
    flex: 1,
    maxWidth: '100%',
    marginTop: 4,
    paddingLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  progressStepCaption: {
    marginTop: 3,
    paddingRight: spacing.sm,
    color: '#2F5FA6',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  progressStepCaptionNarrow: {
    position: 'absolute',
    top: 25,
    left: 38,
  },
  progressFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: '#F4F7FB',
  },
  progressFooterNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  progressMessageBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressMessageCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  progressMessage: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  progressContext: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  progressSkeleton: {
    gap: spacing.lg,
  },
  progressSkeletonSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E6EAF2',
  },
  progressSkeletonMeta: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 150,
    gap: spacing.sm,
  },
  progressSkeletonLabel: {
    width: 74,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E9EDF3',
  },
  progressSkeletonValue: {
    width: '78%',
    height: 14,
    borderRadius: 5,
    backgroundColor: '#DDE4ED',
  },
  progressSkeletonTimeline: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressSkeletonTimelineNarrow: {
    flexDirection: 'column',
  },
  progressSkeletonStep: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  progressSkeletonStepNarrow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressSkeletonMarker: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#DDE4ED',
  },
  progressSkeletonStepLabel: {
    width: '76%',
    height: 9,
    borderRadius: 4,
    backgroundColor: '#E9EDF3',
  },
  progressAction: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: '#2F5FA6',
  },
  progressActionHovered: {
    backgroundColor: '#244B86',
  },
  progressActionText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  dashboardGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  mainColumn: {
    flex: 1.55,
    minWidth: 0,
    gap: spacing.lg,
  },
  sideColumn: {
    flex: 0.85,
    minWidth: 320,
    gap: spacing.lg,
  },
  vehiclePanel:
    {
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
  sectionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  sectionDescription: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  secondaryAction: {
    minHeight: 38,
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
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleWorkspace: {
    gap: spacing.md,
  },
  vehicleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  vehicleSelectorItem: {
    flexGrow: 1,
    flexBasis: 170,
    minWidth: 150,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  vehicleSelectorItemActive: {
    borderColor: '#9BB9DE',
    backgroundColor: '#EDF4FF',
  },
  vehicleSelectorItemHovered: {
    borderColor: '#C8D5E6',
    backgroundColor: '#F3F7FC',
  },
  vehicleSelectorIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E7EFFA',
  },
  vehicleSelectorIconActive: {
    backgroundColor: '#2F5FA6',
  },
  vehicleSelectorIconLight: {
    backgroundColor: '#FFFFFF',
  },
  vehicleSelectorLogo: {
    width: 28,
    height: 28,
  },
  vehicleSelectorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroVehicleCard: {
    minHeight: 250,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 20,
    backgroundColor: '#0B1220',
    overflow: 'hidden',
  },
  heroVehicleCardNarrow: {
    flexDirection: 'column',
  },
  vehicleVisualStage: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRightWidth: 1,
    borderRightColor: '#26344C',
    backgroundColor: '#101A2C',
    overflow: 'hidden',
  },
  vehicleBrandLogoFrame: {
    width: '78%',
    maxWidth: 230,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  vehicleBrandLogoFrameLight: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D7E0EC',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  vehicleBrandLogo: {
    width: '100%',
    height: '100%',
  },
  vehicleGroundLine: {
    width: '72%',
    height: 1,
    marginTop: spacing.md,
    backgroundColor: '#35547C',
  },
  vehicleIdentity: {
    flex: 1.1,
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  vehicleIdentityTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroVehicleEyebrow: {
    flexShrink: 1,
    color: '#8FB7E8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  heroVehicleStatus: {
    maxWidth: '55%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#35547C',
    borderRadius: 999,
    backgroundColor: '#172238',
  },
  heroVehicleStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#72B7FF',
  },
  heroVehicleStatusText: {
    flexShrink: 1,
    color: '#D9E5F5',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  heroVehicleName: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  heroVehicleMeta: {
    color: '#D9E5F5',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  vehicleMiniTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleMiniTitleActive: {
    color: '#2F5FA6',
  },
  vehicleMiniMeta: {
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  vehicleFacts: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#26344C',
  },
  vehicleFact: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  vehicleFactLabel: {
    color: '#8FA0B8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  vehicleFactValue: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  serviceCardsGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  serviceCard: {
    flex: 1,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  cardTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#EDF5FD',
  },
  cardTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  detailRows: {
    gap: spacing.sm,
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoLabel: {
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  infoValue: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  cardAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E6EAF2',
  },
  cardActionHovered: {
    backgroundColor: '#F7FAFF',
  },
  cardActionText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  activeRepairList: {
    gap: spacing.sm,
  },
  activeRepairRow: {
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#2F5FA6',
    backgroundColor: '#F8FAFC',
    gap: spacing.xs,
  },
  activeRepairHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  activeRepairDocument: {
    flex: 1,
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  activeRepairStatus: {
    maxWidth: '46%',
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  activeRepairMeta: {
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
  },
  savPanel: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },
  savHeader: {
    gap: spacing.xs,
    padding: spacing.xs,
  },
  metricList: {
    gap: 2,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  metricIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metricIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#EDF5FD',
  },
  metricLabel: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  metricValue: {
    color: '#2F5FA6',
    minWidth: 42,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'right',
  },
  notificationsPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  notificationsToggle: {
    minHeight: 34,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    backgroundColor: '#EDF5FD',
  },
  notificationsToggleHovered: {
    backgroundColor: '#DDEAF9',
  },
  notificationsToggleText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  notificationList: {
    gap: spacing.sm,
  },
  notificationItem: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  notificationItemUnread: {
    borderColor: '#BFD2EC',
    backgroundColor: '#F7FAFF',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  notificationTitle: {
    flex: 1,
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  notificationBadge: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  notificationMessage: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  notificationDate: {
    color: '#6B7788',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  markReadButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#C8D5E6',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  markReadButtonHovered: {
    backgroundColor: '#EEF5FF',
  },
  markReadButtonText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  historyPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  historyList: {
    gap: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
  },
  historyTypePill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#EDF5FD',
  },
  historyTypeText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  historyTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  historyMeta: {
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  historyStatus: {
    maxWidth: 140,
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  emptyPanel: {
    minHeight: 104,
    justifyContent: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
  },
  emptyPanelCompact: {
    minHeight: 72,
    padding: spacing.md,
  },
  emptyText: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.84,
  },
  disabled: {
    opacity: 0.5,
  },
});
