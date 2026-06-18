import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import type { DictionaryItem, Workshop } from '@/core/api/dictionaries.api';
import {
  useServiceTypes,
  useShowrooms,
  useWorkshops,
} from '@/core/api/use-dictionaries';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useCreateAppointment } from '@/features/appointments/hooks/useCreateAppointment';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';
import { useAuthStore } from '@/store/auth.store';

const steps = [
  'Véhicule',
  'Vérification',
  'Atelier / concession',
  'Type de service',
  'Date & heure',
  'Confirmation',
] as const;

const appointmentTimeSlots = [
  '08:30',
  '09:30',
  '10:30',
  '11:30',
  '14:00',
  '15:00',
  '16:00',
] as const;

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

function formatWorkshopMeta(
  workshop: Workshop,
  showroomName?: string
): string {
  return [
    workshop.workshop_type,
    showroomName,
    workshop.opening_time && workshop.closing_time
      ? `${workshop.opening_time} - ${workshop.closing_time}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
}

type AppointmentDateOption = {
  value: string;
  weekday: string;
  day: string;
  month: string;
};

function formatLocalDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getUpcomingWorkingDays(count: number): AppointmentDateOption[] {
  const dates: AppointmentDateOption[] = [];
  const cursor = new Date();

  cursor.setHours(12, 0, 0, 0);

  while (dates.length < count) {
    cursor.setDate(cursor.getDate() + 1);

    const weekdayIndex = cursor.getDay();

    if (weekdayIndex === 0 || weekdayIndex === 6) {
      continue;
    }

    dates.push({
      value: formatLocalDateValue(cursor),
      weekday: new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
      })
        .format(cursor)
        .replace('.', ''),
      day: String(cursor.getDate()).padStart(2, '0'),
      month: new Intl.DateTimeFormat('fr-FR', {
        month: 'short',
      })
        .format(cursor)
        .replace('.', ''),
    });
  }

  return dates;
}

export function AppointmentsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.desktop;
  const isNarrow = width < breakpoints.tablet;
  const [activeStep, setActiveStep] = useState(0);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null
  );
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<number | null>(
    null
  );
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<
    number | null
  >(null);
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [comment, setComment] = useState('');
  const vehiclesQuery = useVehicles();
  const workshopsQuery = useWorkshops();
  const showroomsQuery = useShowrooms();
  const serviceTypesQuery = useServiceTypes();
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const logout = useLogout();
  const createAppointment = useCreateAppointment();
  const vehicles = vehiclesQuery.data ?? [];
  const workshops = workshopsQuery.data ?? [];
  const showrooms = showroomsQuery.data ?? [];
  const serviceTypes = serviceTypesQuery.data ?? [];
  const clientName = getDisplayName(
    customer?.firstName ?? user?.firstName,
    customer?.lastName ?? user?.lastName,
    customer?.email ?? user?.email
  );

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles]
  );
  const selectedWorkshop = useMemo(
    () =>
      workshops.find((workshop) => workshop.id === selectedWorkshopId) ?? null,
    [selectedWorkshopId, workshops]
  );
  const selectedServiceType = useMemo(
    () =>
      serviceTypes.find((service) => service.id === selectedServiceTypeId) ??
      null,
    [selectedServiceTypeId, serviceTypes]
  );

  const isLoading =
    vehiclesQuery.isLoading ||
    workshopsQuery.isLoading ||
    showroomsQuery.isLoading ||
    serviceTypesQuery.isLoading;
  const hasError =
    vehiclesQuery.isError ||
    workshopsQuery.isError ||
    showroomsQuery.isError ||
    serviceTypesQuery.isError;
  const canContinue =
    (activeStep === 0 && Boolean(selectedVehicle)) ||
    (activeStep === 1 && Boolean(selectedVehicle)) ||
    (activeStep === 2 && Boolean(selectedWorkshop)) ||
    (activeStep === 3 && Boolean(selectedServiceType)) ||
    (activeStep === 4 &&
      requestedDate.trim().length > 0 &&
      requestedTime.trim().length > 0) ||
    activeStep === 5;
  const canSubmitAppointment =
    customer?.id !== undefined &&
    selectedVehicleId !== null &&
    selectedWorkshopId !== null &&
    selectedServiceTypeId !== null &&
    requestedDate.trim().length > 0 &&
    requestedTime.trim().length > 0 &&
    !createAppointment.isPending &&
    !createAppointment.isSuccess;

  const refetchAll = () => {
    void Promise.all([
      vehiclesQuery.refetch(),
      workshopsQuery.refetch(),
      showroomsQuery.refetch(),
      serviceTypesQuery.refetch(),
    ]);
  };

  const goNext = () => {
    if (!canContinue || activeStep >= steps.length - 1) {
      return;
    }

    setActiveStep((step) => step + 1);
  };

  const goBack = () => {
    if (activeStep === 0) {
      return;
    }

    setActiveStep((step) => step - 1);
  };

  const handleSubmit = () => {
    if (
      customer?.id === undefined ||
      selectedVehicleId === null ||
      selectedWorkshopId === null ||
      selectedServiceTypeId === null ||
      !canSubmitAppointment
    ) {
      return;
    }

    createAppointment.mutate({
      customerId: customer.id,
      vehicleId: selectedVehicleId,
      serviceTypeId: selectedServiceTypeId,
      workshopId: selectedWorkshopId,
      requestedDate: requestedDate.trim(),
      requestedTime: requestedTime.trim(),
      comment,
    });
  };

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Préparation du parcours rendez-vous..." />
      </PageContainer>
    );
  }

  if (hasError) {
    return (
      <PageContainer>
        <ErrorState
          title="Erreur de chargement"
          message="Impossible de charger les informations nécessaires au rendez-vous."
          onRetry={refetchAll}
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
            activeHref="/appointments"
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
                <Text style={styles.eyebrow}>Prendre rendez-vous</Text>
                <Text style={styles.title}>Parcours service SMEIA</Text>
                <Text style={styles.subtitle}>
                  Sélectionnez votre véhicule, vérifiez vos informations et
                  préparez une demande de rendez-vous atelier.
                </Text>
              </View>

              <View style={styles.progressBadge}>
                <Text style={styles.progressBadgeText}>
                  Étape {activeStep + 1} / {steps.length}
                </Text>
              </View>
            </View>

            <View style={[styles.workflowGrid, isCompact && styles.stack]}>
              <View style={styles.stepperPanel}>
                {steps.map((step, index) => (
                  <Pressable
                    key={step}
                    accessibilityRole="button"
                    onPress={() => {
                      setActiveStep(index);
                    }}
                    style={({ hovered, pressed }) => [
                      styles.stepItem,
                      index === activeStep && styles.stepItemActive,
                      index < activeStep && styles.stepItemDone,
                      hovered && styles.stepItemHovered,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepNumber,
                        index === activeStep && styles.stepNumberActive,
                      ]}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                    <Text
                      style={[
                        styles.stepLabel,
                        index === activeStep && styles.stepLabelActive,
                      ]}
                    >
                      {step}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.mainPanel}>
                {activeStep === 0 ? (
                  <VehicleStep
                    selectedVehicleId={selectedVehicleId}
                    vehicles={vehicles}
                    onSelect={setSelectedVehicleId}
                  />
                ) : null}

                {activeStep === 1 ? (
                  <VerificationStep
                    clientName={clientName}
                    customerEmail={customer?.email ?? user?.email ?? null}
                    customerPhone={customer?.phone ?? null}
                    vehicle={selectedVehicle}
                  />
                ) : null}

                {activeStep === 2 ? (
                  <WorkshopStep
                    selectedWorkshopId={selectedWorkshopId}
                    showrooms={showrooms}
                    workshops={workshops}
                    onSelect={setSelectedWorkshopId}
                  />
                ) : null}

                {activeStep === 3 ? (
                  <ServiceTypeStep
                    selectedServiceTypeId={selectedServiceTypeId}
                    serviceTypes={serviceTypes}
                    onSelect={setSelectedServiceTypeId}
                  />
                ) : null}

                {activeStep === 4 ? (
                  <DateTimeStep
                    comment={comment}
                    requestedDate={requestedDate}
                    requestedTime={requestedTime}
                    onCommentChange={setComment}
                    onDateChange={setRequestedDate}
                    onTimeChange={setRequestedTime}
                  />
                ) : null}

                {activeStep === 5 ? (
                  <ConfirmationStep
                    clientName={clientName}
                    comment={comment}
                    createdAppointmentId={createAppointment.data?.id ?? null}
                    errorMessage={
                      createAppointment.error
                        ? 'Impossible de créer le rendez-vous. Vérifiez les informations puis réessayez.'
                        : null
                    }
                    requestedDate={requestedDate}
                    requestedTime={requestedTime}
                    selectedServiceType={selectedServiceType}
                    selectedVehicle={selectedVehicle}
                    selectedWorkshop={selectedWorkshop}
                  />
                ) : null}

                <View style={[styles.actions, isNarrow && styles.stack]}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={activeStep === 0}
                    onPress={goBack}
                    style={({ hovered, pressed }) => [
                      styles.secondaryAction,
                      hovered && activeStep > 0 && styles.secondaryActionHovered,
                      pressed && activeStep > 0 && styles.pressed,
                      activeStep === 0 && styles.disabled,
                    ]}
                  >
                    <Text style={styles.secondaryActionText}>Précédent</Text>
                  </Pressable>

                  {activeStep < steps.length - 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={!canContinue}
                      onPress={goNext}
                      style={({ hovered, pressed }) => [
                        styles.primaryAction,
                        hovered && canContinue && styles.primaryActionHovered,
                        pressed && canContinue && styles.pressed,
                        !canContinue && styles.disabled,
                      ]}
                    >
                      <Text style={styles.primaryActionText}>Continuer</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={!canSubmitAppointment}
                      onPress={handleSubmit}
                      style={({ hovered, pressed }) => [
                        styles.primaryAction,
                        hovered &&
                          canSubmitAppointment &&
                          styles.primaryActionHovered,
                        pressed && canSubmitAppointment && styles.pressed,
                        !canSubmitAppointment && styles.disabled,
                      ]}
                    >
                      <Text style={styles.primaryActionText}>
                        {createAppointment.isPending
                          ? 'Création...'
                          : createAppointment.isSuccess
                            ? 'Rendez-vous créé'
                            : 'Confirmer le rendez-vous'}
                      </Text>
                    </Pressable>
                  )}
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
  activeHref: '/appointments' | '/history' | '/repairs' | '/vehicles';
  clientName: string;
  compact: boolean;
  logoutDisabled: boolean;
  onLogout: () => void;
};

function Sidebar({
  activeHref,
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
        {navigationItems.map((item) => {
          const isActive = item.href === activeHref;

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

type VehicleStepProps = {
  selectedVehicleId: number | null;
  vehicles: VehicleListItem[];
  onSelect: (vehicleId: number) => void;
};

function VehicleStep({
  selectedVehicleId,
  vehicles,
  onSelect,
}: VehicleStepProps) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 1"
        title="Choisissez le véhicule"
        text="Seuls les véhicules associés à votre compte client sont affichés."
      />

      {vehicles.length > 0 ? (
        <View style={styles.optionGrid}>
          {vehicles.map((vehicle) => (
            <SelectableCard
              key={vehicle.id}
              active={vehicle.id === selectedVehicleId}
              detail={`${vehicle.registrationNumber} · ${vehicle.year}`}
              meta={vehicle.vin}
              title={`${vehicle.brandName} ${vehicle.model}`}
              onPress={() => {
                onSelect(vehicle.id);
              }}
            />
          ))}
        </View>
      ) : (
        <EmptyPanel
          title="Aucun véhicule trouvé"
          text="Aucun véhicule n'est lié à votre profil client pour le moment."
        />
      )}
    </View>
  );
}

type VerificationStepProps = {
  clientName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  vehicle: VehicleListItem | null;
};

function VerificationStep({
  clientName,
  customerEmail,
  customerPhone,
  vehicle,
}: VerificationStepProps) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 2"
        title="Vérification"
        text="Confirmez les informations qui seront transmises au conseiller SMEIA."
      />

      <View style={styles.verificationGrid}>
        <InfoPanel
          lines={[
            ['Client', clientName],
            ['Email', customerEmail ?? 'Non renseigné'],
            ['Téléphone', customerPhone ?? 'Non renseigné'],
          ]}
          title="Informations client"
        />
        <InfoPanel
          lines={[
            ['Véhicule', vehicle ? `${vehicle.brandName} ${vehicle.model}` : '-'],
            ['Immatriculation', vehicle?.registrationNumber ?? '-'],
            ['Kilométrage', vehicle?.mileage ?? '-'],
          ]}
          title="Véhicule sélectionné"
        />
      </View>
    </View>
  );
}

type WorkshopStepProps = {
  selectedWorkshopId: number | null;
  showrooms: DictionaryItem[];
  workshops: Workshop[];
  onSelect: (workshopId: number) => void;
};

function WorkshopStep({
  selectedWorkshopId,
  showrooms,
  workshops,
  onSelect,
}: WorkshopStepProps) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 3"
        title="Atelier / concession"
        text="Sélectionnez le point de service le plus adapté à votre demande."
      />

      {workshops.length > 0 ? (
        <View style={styles.optionGrid}>
          {workshops.map((workshop) => {
            const showroomName = showrooms.find(
              (showroom) => showroom.id === workshop.showroom_id
            )?.name;

            return (
              <SelectableCard
                key={workshop.id}
                active={workshop.id === selectedWorkshopId}
                detail={formatWorkshopMeta(workshop, showroomName)}
                title={workshop.name}
                onPress={() => {
                  onSelect(workshop.id);
                }}
              />
            );
          })}
        </View>
      ) : (
        <EmptyPanel
          title="Aucun atelier disponible"
          text="Les ateliers Directus ne sont pas disponibles pour le moment."
        />
      )}
    </View>
  );
}

type ServiceTypeStepProps = {
  selectedServiceTypeId: number | null;
  serviceTypes: DictionaryItem[];
  onSelect: (serviceTypeId: number) => void;
};

function ServiceTypeStep({
  selectedServiceTypeId,
  serviceTypes,
  onSelect,
}: ServiceTypeStepProps) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 4"
        title="Type de service"
        text="Choisissez la nature de votre rendez-vous atelier."
      />

      {serviceTypes.length > 0 ? (
        <View style={styles.optionGrid}>
          {serviceTypes.map((serviceType) => (
            <SelectableCard
              key={serviceType.id}
              active={serviceType.id === selectedServiceTypeId}
              detail="Demande préparée pour validation conseiller."
              title={serviceType.name}
              onPress={() => {
                onSelect(serviceType.id);
              }}
            />
          ))}
        </View>
      ) : (
        <EmptyPanel
          title="Aucun type de service"
          text="Les types de service Directus ne sont pas disponibles pour le moment."
        />
      )}
    </View>
  );
}

type DateTimeStepProps = {
  comment: string;
  requestedDate: string;
  requestedTime: string;
  onCommentChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

function DateTimeStep({
  comment,
  requestedDate,
  requestedTime,
  onCommentChange,
  onDateChange,
  onTimeChange,
}: DateTimeStepProps) {
  const availableDates = useMemo(() => getUpcomingWorkingDays(10), []);

  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 5"
        title="Date & heure"
        text="Indiquez le créneau souhaité. Le conseiller confirmera la disponibilité."
      />

      <View style={styles.selectorSection}>
        <View style={styles.selectorHeader}>
          <Text style={styles.fieldLabel}>Date souhaitée</Text>
          <Text style={styles.selectorHint}>10 prochains jours ouvrés</Text>
        </View>

        <View style={styles.dateGrid}>
          {availableDates.map((date) => {
            const isSelected = requestedDate === date.value;

            return (
              <Pressable
                key={date.value}
                accessibilityRole="button"
                onPress={() => {
                  onDateChange(date.value);
                }}
                style={({ hovered, pressed }) => [
                  styles.dateCard,
                  isSelected && styles.dateCardSelected,
                  hovered && !isSelected && styles.dateCardHovered,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dateWeekday,
                    isSelected && styles.dateTextSelected,
                  ]}
                >
                  {date.weekday}
                </Text>
                <Text
                  style={[
                    styles.dateDay,
                    isSelected && styles.dateTextSelected,
                  ]}
                >
                  {date.day}
                </Text>
                <Text
                  style={[
                    styles.dateMonth,
                    isSelected && styles.dateTextSelected,
                  ]}
                >
                  {date.month}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.selectorSection}>
        <View style={styles.selectorHeader}>
          <Text style={styles.fieldLabel}>Heure souhaitée</Text>
          <Text style={styles.selectorHint}>Créneaux disponibles</Text>
        </View>

        <View style={styles.timeGrid}>
          {appointmentTimeSlots.map((time) => {
            const isSelected = requestedTime === time;

            return (
              <Pressable
                key={time}
                accessibilityRole="button"
                onPress={() => {
                  onTimeChange(time);
                }}
                style={({ hovered, pressed }) => [
                  styles.timeSlot,
                  isSelected && styles.timeSlotSelected,
                  hovered && !isSelected && styles.timeSlotHovered,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.timeSlotText,
                    isSelected && styles.timeSlotTextSelected,
                  ]}
                >
                  {time}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.commentField}>
        <Text style={styles.fieldLabel}>Commentaire (facultatif)</Text>
        <TextInput
          multiline
          numberOfLines={4}
          onChangeText={onCommentChange}
          placeholder="Précisez votre demande ou vos contraintes..."
          placeholderTextColor="#8A97A8"
          style={[styles.input, styles.commentInput]}
          textAlignVertical="top"
          value={comment}
        />
      </View>
    </View>
  );
}

type ConfirmationStepProps = {
  clientName: string;
  comment: string;
  createdAppointmentId: number | string | null;
  errorMessage: string | null;
  requestedDate: string;
  requestedTime: string;
  selectedServiceType: DictionaryItem | null;
  selectedVehicle: VehicleListItem | null;
  selectedWorkshop: Workshop | null;
};

function ConfirmationStep({
  clientName,
  comment,
  createdAppointmentId,
  errorMessage,
  requestedDate,
  requestedTime,
  selectedServiceType,
  selectedVehicle,
  selectedWorkshop,
}: ConfirmationStepProps) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 6"
        title="Confirmation"
        text="Vérifiez le récapitulatif avant préparation de la demande."
      />

      <View style={styles.summaryPanel}>
        <InfoLine label="Client" value={clientName} />
        <InfoLine
          label="Véhicule"
          value={
            selectedVehicle
              ? `${selectedVehicle.brandName} ${selectedVehicle.model}`
              : '-'
          }
        />
        <InfoLine
          label="Immatriculation"
          value={selectedVehicle?.registrationNumber ?? '-'}
        />
        <InfoLine label="Atelier" value={selectedWorkshop?.name ?? '-'} />
        <InfoLine
          label="Service"
          value={selectedServiceType?.name ?? '-'}
        />
        <InfoLine
          label="Créneau souhaité"
          value={
            requestedDate && requestedTime
              ? `${requestedDate} à ${requestedTime}`
              : '-'
          }
        />
        <InfoLine
          label="Commentaire"
          value={comment.trim() || 'Aucun commentaire'}
        />
      </View>

      {createdAppointmentId !== null ? (
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>Rendez-vous créé</Text>
          <Text style={styles.successText}>
            Votre demande a été enregistrée dans Directus sous la référence{' '}
            {String(createdAppointmentId)} avec le statut pending.
          </Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.submitErrorBox}>
          <Text style={styles.submitErrorTitle}>Création impossible</Text>
          <Text style={styles.submitErrorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

type SectionIntroProps = {
  kicker: string;
  title: string;
  text: string;
};

function SectionIntro({ kicker, title, text }: SectionIntroProps) {
  return (
    <View style={styles.sectionIntro}>
      <Text style={styles.sectionKicker}>{kicker}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

type SelectableCardProps = {
  active: boolean;
  detail: string;
  meta?: string;
  title: string;
  onPress: () => void;
};

function SelectableCard({
  active,
  detail,
  meta,
  title,
  onPress,
}: SelectableCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.selectableCard,
        active && styles.selectableCardActive,
        hovered && styles.selectableCardHovered,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.selectableTitle}>{title}</Text>
      <Text style={styles.selectableDetail}>{detail}</Text>
      {meta ? <Text style={styles.selectableMeta}>{meta}</Text> : null}
    </Pressable>
  );
}

type InfoPanelProps = {
  lines: Array<[string, string]>;
  title: string;
};

function InfoPanel({ lines, title }: InfoPanelProps) {
  return (
    <View style={styles.infoPanel}>
      <Text style={styles.infoPanelTitle}>{title}</Text>
      {lines.map(([label, value]) => (
        <InfoLine key={label} label={label} value={value} />
      ))}
    </View>
  );
}

type InfoLineProps = {
  label: string;
  value: string;
};

function InfoLine({ label, value }: InfoLineProps) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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

  progressBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#CBD8EA',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  progressBadgeText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  workflowGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },

  stack: {
    flexDirection: 'column',
  },

  stepperPanel: {
    width: 280,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: spacing.sm,
  },

  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
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

  stepItemDone: {
    backgroundColor: '#F6F9FD',
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

  stepLabel: {
    flex: 1,
    color: '#526174',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  stepLabelActive: {
    color: '#071832',
  },

  mainPanel: {
    flex: 1,
    minHeight: 560,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },

  stepContent: {
    flex: 1,
    gap: spacing.lg,
  },

  sectionIntro: {
    gap: spacing.xs,
  },

  sectionKicker: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  sectionTitle: {
    color: '#071832',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  sectionText: {
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  selectableCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 240,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },

  selectableCardActive: {
    borderColor: '#0F4C9A',
    backgroundColor: '#F1F6FD',
  },

  selectableCardHovered: {
    borderColor: '#B8C9DF',
    transform: [{ translateY: -1 }],
  },

  selectableTitle: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  selectableDetail: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  selectableMeta: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
  },

  verificationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  infoPanel: {
    flex: 1,
    minWidth: 260,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: '#F6F9FD',
    gap: spacing.sm,
  },

  infoPanelTitle: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF6',
  },

  infoLabel: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
  },

  infoValue: {
    flex: 1,
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'right',
  },

  selectorSection: {
    gap: spacing.md,
  },

  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  selectorHint: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
  },

  commentField: {
    gap: spacing.sm,
  },

  fieldLabel: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  dateCard: {
    width: 76,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },

  dateCardSelected: {
    borderColor: '#0F4C9A',
    backgroundColor: '#0F4C9A',
    shadowColor: '#0F4C9A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },

  dateCardHovered: {
    borderColor: '#9CB8DA',
    backgroundColor: '#F4F8FD',
  },

  dateWeekday: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    textTransform: 'capitalize',
  },

  dateDay: {
    color: '#071832',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  dateMonth: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    textTransform: 'capitalize',
  },

  dateTextSelected: {
    color: '#FFFFFF',
  },

  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  timeSlot: {
    minWidth: 86,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  timeSlotSelected: {
    borderColor: '#0F4C9A',
    backgroundColor: '#0F4C9A',
  },

  timeSlotHovered: {
    borderColor: '#9CB8DA',
    backgroundColor: '#F4F8FD',
  },

  timeSlotText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  timeSlotTextSelected: {
    color: '#FFFFFF',
  },

  input: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D5DFEC',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#071832',
    fontSize: typography.fontSize.md,
  },

  commentInput: {
    minHeight: 108,
  },

  summaryPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 18,
    backgroundColor: '#F6F9FD',
    gap: spacing.sm,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
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

  secondaryAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#C8D5E6',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  secondaryActionHovered: {
    backgroundColor: '#F4F8FD',
  },

  secondaryActionText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  pressed: {
    opacity: 0.86,
  },

  disabled: {
    opacity: 0.5,
  },

  emptyPanel: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
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

  submitErrorBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E9B8B8',
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    gap: spacing.xs,
  },

  submitErrorTitle: {
    color: '#B42318',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  submitErrorText: {
    color: '#8F2D24',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
});
