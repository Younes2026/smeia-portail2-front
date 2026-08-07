import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

import { MonthlyCalendar } from '@/components/calendar/MonthlyCalendar';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import type { DictionaryItem, Workshop } from '@/core/api/dictionaries.api';
import {
  useServiceTypes,
  useShowrooms,
  useWorkshops,
} from '@/core/api/use-dictionaries';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useCreateAppointment } from '@/features/appointments/hooks/useCreateAppointment';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import { getBrandLogo } from '@/features/vehicles/model/brand-logo';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';
import { useAuthStore } from '@/store/auth.store';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

type StepDefinition = {
  description: string;
  icon: SymbolName;
  label: string;
};

const STEPS: StepDefinition[] = [
  {
    label: 'Véhicule',
    description: 'Sélectionnez le véhicule concerné par votre visite.',
    icon: { ios: 'car', android: 'directions_car', web: 'directions_car' },
  },
  {
    label: 'Coordonnées',
    description: 'Vérifiez les informations transmises à votre conseiller.',
    icon: { ios: 'person', android: 'person', web: 'person' },
  },
  {
    label: 'Atelier',
    description: 'Choisissez l’atelier SMEIA adapté à votre demande.',
    icon: { ios: 'mappin', android: 'location_on', web: 'location_on' },
  },
  {
    label: 'Prestation',
    description: 'Vérifiez la prestation associée à l’atelier choisi.',
    icon: { ios: 'wrench', android: 'build', web: 'build' },
  },
  {
    label: 'Date et heure',
    description: 'Sélectionnez une date et un créneau de préférence.',
    icon: { ios: 'calendar', android: 'event', web: 'event' },
  },
  {
    label: 'Confirmation',
    description: 'Relisez votre demande avant de la transmettre à l’atelier.',
    icon: { ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' },
  },
];

const APPOINTMENT_TIME_SLOT_GROUPS = [
  { label: 'Matin', slots: ['08:30', '09:30', '10:30', '11:30'] },
  { label: 'Après-midi', slots: ['14:00', '15:00', '16:00'] },
] as const;

const SERVICE_TYPE_ID_BY_WORKSHOP_ID: Readonly<Record<number, number>> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
};

type AutomaticServiceSelection =
  | { errorMessage: null; serviceType: DictionaryItem }
  | { errorMessage: string; serviceType: null };

function resolveAutomaticServiceSelection(
  workshopId: number,
  workshops: readonly Workshop[],
  serviceTypes: readonly DictionaryItem[]
): AutomaticServiceSelection {
  if (!workshops.some((workshop) => workshop.id === workshopId)) {
    return {
      errorMessage:
        'L’atelier sélectionné n’est plus disponible. Veuillez choisir un autre atelier.',
      serviceType: null,
    };
  }

  const serviceTypeId = SERVICE_TYPE_ID_BY_WORKSHOP_ID[workshopId];

  if (serviceTypeId === undefined) {
    return {
      errorMessage:
        'Aucune prestation automatique n’est configurée pour cet atelier. Veuillez choisir un autre atelier.',
      serviceType: null,
    };
  }

  const serviceType = serviceTypes.find((service) => service.id === serviceTypeId);

  if (!serviceType) {
    return {
      errorMessage:
        'La prestation correspondant à cet atelier n’est pas disponible. Veuillez choisir un autre atelier ou réessayer plus tard.',
      serviceType: null,
    };
  }

  return { errorMessage: null, serviceType };
}

const WEB_STICKY_SUMMARY_STYLE =
  Platform.OS === 'web'
    ? ({ position: 'sticky', top: spacing.md } as unknown as ViewStyle)
    : undefined;

const WEB_STICKY_ACTION_STYLE =
  Platform.OS === 'web'
    ? ({ position: 'sticky', bottom: 0 } as unknown as ViewStyle)
    : undefined;

function cleanValue(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR');

  if (normalized.includes('unknown') || normalized.includes('non renseigne')) {
    return null;
  }

  return trimmed;
}

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'Client SMEIA';
}

function getVehicleTitle(vehicle: VehicleListItem | null): string {
  if (!vehicle) {
    return 'Votre véhicule';
  }

  return (
    [cleanValue(vehicle.brandName), cleanValue(vehicle.model)]
      .filter(Boolean)
      .join(' ') || 'Votre véhicule'
  );
}

function getVehicleRegistration(vehicle: VehicleListItem | null): string | null {
  return cleanValue(vehicle?.registrationNumber);
}

function getMaskedVin(vehicle: VehicleListItem): string | null {
  const vin = cleanValue(vehicle.vin);

  if (!vin) {
    return null;
  }

  return `VIN ••••••${vin.slice(-6).toLocaleUpperCase('fr-FR')}`;
}

function formatWorkshopMeta(
  workshop: Workshop,
  showroomName?: string
): string {
  return [cleanValue(workshop.workshop_type), cleanValue(showroomName)]
    .filter(Boolean)
    .join(' • ');
}

function formatLocalDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseLocalDateValue(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLongAppointmentDateTime(
  requestedDate: string,
  requestedTime: string
): string {
  const date = parseLocalDateValue(requestedDate);

  if (!date || !requestedTime) {
    return 'À sélectionner';
  }

  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return `${formattedDate.charAt(0).toLocaleUpperCase('fr-FR')}${formattedDate.slice(1)} à ${requestedTime}`;
}

function formatShortAppointmentDate(requestedDate: string): string {
  const date = parseLocalDateValue(requestedDate);

  return date
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date)
    : 'À sélectionner';
}

export function AppointmentsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.desktop;
  const isNarrow = width < breakpoints.tablet;
  const [activeStep, setActiveStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<number | null>(null);
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<number | null>(null);
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [comment, setComment] = useState('');
  const vehiclesQuery = useVehicles();
  const workshopsQuery = useWorkshops();
  const showroomsQuery = useShowrooms();
  const serviceTypesQuery = useServiceTypes();
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
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
    () => workshops.find((workshop) => workshop.id === selectedWorkshopId) ?? null,
    [selectedWorkshopId, workshops]
  );
  const selectedServiceType = useMemo(
    () => serviceTypes.find((service) => service.id === selectedServiceTypeId) ?? null,
    [selectedServiceTypeId, serviceTypes]
  );
  const automaticServiceSelection = useMemo(
    () =>
      selectedWorkshopId === null
        ? null
        : resolveAutomaticServiceSelection(
            selectedWorkshopId,
            workshops,
            serviceTypes
          ),
    [selectedWorkshopId, serviceTypes, workshops]
  );
  const hasValidAutomaticServiceSelection =
    automaticServiceSelection !== null &&
    automaticServiceSelection.errorMessage === null &&
    automaticServiceSelection.serviceType.id === selectedServiceTypeId &&
    selectedServiceType?.id === selectedServiceTypeId;
  const serviceSelectionError = automaticServiceSelection?.errorMessage ?? null;
  const selectedShowroom = selectedWorkshop
    ? showrooms.find((showroom) => showroom.id === selectedWorkshop.showroom_id) ?? null
    : null;
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
    (activeStep === 2 && hasValidAutomaticServiceSelection) ||
    (activeStep === 3 && hasValidAutomaticServiceSelection) ||
    (activeStep === 4 &&
      hasValidAutomaticServiceSelection &&
      Boolean(requestedDate.trim() && requestedTime.trim())) ||
    (activeStep === 5 && hasValidAutomaticServiceSelection);
  const canSubmitAppointment =
    customer?.id !== undefined &&
    selectedVehicleId !== null &&
    selectedWorkshopId !== null &&
    selectedServiceTypeId !== null &&
    hasValidAutomaticServiceSelection &&
    requestedDate.trim().length > 0 &&
    requestedTime.trim().length > 0 &&
    !createAppointment.isPending &&
    !createAppointment.isSuccess;
  const progress = Math.round(((activeStep + 1) / STEPS.length) * 100);

  const refetchAll = () => {
    void Promise.all([
      vehiclesQuery.refetch(),
      workshopsQuery.refetch(),
      showroomsQuery.refetch(),
      serviceTypesQuery.refetch(),
    ]);
  };

  const goNext = () => {
    if (!canContinue || activeStep >= STEPS.length - 1) {
      return;
    }

    const nextStep = activeStep + 1;
    setActiveStep(nextStep);
    setFurthestStep((current) => Math.max(current, nextStep));
  };

  const goBack = () => {
    if (activeStep > 0) {
      setActiveStep((step) => step - 1);
    }
  };

  const handleWorkshopSelect = (workshopId: number) => {
    const selection = resolveAutomaticServiceSelection(
      workshopId,
      workshops,
      serviceTypes
    );

    setSelectedWorkshopId(workshopId);
    setSelectedServiceTypeId(selection.serviceType?.id ?? null);
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
      <ClientPortalLayout activeRoute="/appointments">
        <AppointmentSkeleton />
      </ClientPortalLayout>
    );
  }

  if (hasError) {
    return (
      <ClientPortalLayout activeRoute="/appointments">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Conciergerie temporairement indisponible"
            message="Impossible de préparer les informations nécessaires au rendez-vous."
            onRetry={refetchAll}
          />
        </View>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout activeRoute="/appointments">
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <AppointmentHeader activeStep={activeStep} progress={progress} />

        <HorizontalStepper
          activeStep={activeStep}
          furthestStep={
            hasValidAutomaticServiceSelection
              ? furthestStep
              : Math.min(furthestStep, 2)
          }
          onSelectStep={setActiveStep}
        />

        {createAppointment.isSuccess ? (
          <SuccessPanel
            date={requestedDate}
            time={requestedTime}
            workshopName={selectedWorkshop?.name ?? 'Atelier SMEIA'}
          />
        ) : (
          <View style={[styles.workspace, isCompact && styles.workspaceCompact]}>
            {isCompact ? (
              <AppointmentSummary
                expanded={summaryExpanded}
                isCompact
                requestedDate={requestedDate}
                requestedTime={requestedTime}
                selectedServiceType={selectedServiceType}
                selectedVehicle={selectedVehicle}
                selectedWorkshop={selectedWorkshop}
                selectedShowroomName={selectedShowroom?.name ?? null}
                onToggle={() => setSummaryExpanded((value) => !value)}
              />
            ) : null}
            <View style={styles.formColumn}>
              <View style={styles.formPanel}>
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
                    errorMessage={serviceSelectionError}
                    selectedWorkshopId={selectedWorkshopId}
                    showrooms={showrooms}
                    workshops={workshops}
                    onSelect={handleWorkshopSelect}
                  />
                ) : null}

                {activeStep === 3 ? (
                  <ServiceTypeStep
                    errorMessage={serviceSelectionError}
                    selectedServiceType={selectedServiceType}
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
                    customerEmail={customer?.email ?? user?.email ?? null}
                    customerPhone={customer?.phone ?? null}
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
              </View>

              <WizardActions
                activeStep={activeStep}
                canContinue={canContinue}
                canSubmit={canSubmitAppointment}
                isNarrow={isNarrow}
                isSubmitting={createAppointment.isPending}
                onBack={goBack}
                onContinue={goNext}
                onSubmit={handleSubmit}
              />
            </View>

            {!isCompact ? (
              <AppointmentSummary
                expanded={summaryExpanded}
                isCompact={false}
                requestedDate={requestedDate}
                requestedTime={requestedTime}
                selectedServiceType={selectedServiceType}
                selectedVehicle={selectedVehicle}
                selectedWorkshop={selectedWorkshop}
                selectedShowroomName={selectedShowroom?.name ?? null}
                onToggle={() => setSummaryExpanded((value) => !value)}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
    </ClientPortalLayout>
  );
}

function AppointmentHeader({
  activeStep,
  progress,
}: {
  activeStep: number;
  progress: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>Conciergerie atelier</Text>
        <Text style={styles.title}>Planifiez votre visite SMEIA</Text>
        <Text style={styles.subtitle}>{STEPS[activeStep].description}</Text>
      </View>
      <View style={styles.progressBlock}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressStepText}>
            Étape {activeStep + 1} sur {STEPS.length}
          </Text>
          <Text style={styles.progressPercent}>{progress} %</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
    </View>
  );
}

function HorizontalStepper({
  activeStep,
  furthestStep,
  onSelectStep,
}: {
  activeStep: number;
  furthestStep: number;
  onSelectStep: (step: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.stepperContent}
      showsHorizontalScrollIndicator={false}
      style={styles.stepperScroll}
    >
      {STEPS.map((step, index) => {
        const isActive = index === activeStep;
        const isComplete = index < furthestStep && !isActive;
        const isAccessible = index <= furthestStep;

        return (
          <View key={step.label} style={styles.stepWrapper}>
            <Pressable
              accessibilityRole="button"
              disabled={!isAccessible || isActive}
              onPress={() => onSelectStep(index)}
              style={({ hovered, pressed }) => [
                styles.stepButton,
                hovered && isAccessible && !isActive && styles.stepButtonHovered,
                pressed && isAccessible && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.stepCircle,
                  isComplete && styles.stepCircleComplete,
                  isActive && styles.stepCircleActive,
                ]}
              >
                <SymbolView
                  name={
                    isComplete
                      ? { ios: 'checkmark', android: 'check', web: 'check' }
                      : step.icon
                  }
                  size={17}
                  tintColor={
                    isComplete || isActive ? '#FFFFFF' : '#8A97A8'
                  }
                />
              </View>
              <View style={styles.stepCopy}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stepLabel,
                    isComplete && styles.stepLabelComplete,
                    isActive && styles.stepLabelActive,
                  ]}
                >
                  {step.label}
                </Text>
                {isActive ? <Text style={styles.stepCurrent}>En cours</Text> : null}
              </View>
            </Pressable>
            {index < STEPS.length - 1 ? (
              <View
                style={[
                  styles.stepConnector,
                  isComplete && styles.stepConnectorComplete,
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

type VehicleStepProps = {
  selectedVehicleId: number | null;
  vehicles: VehicleListItem[];
  onSelect: (vehicleId: number) => void;
};

function VehicleStep({ selectedVehicleId, vehicles, onSelect }: VehicleStepProps) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 1"
        title="Choisissez votre véhicule"
        text="Seuls les véhicules associés à votre compte client sont proposés."
      />
      {vehicles.length > 0 ? (
        <View style={styles.vehicleGrid}>
          {vehicles.map((vehicle) => (
            <VehicleChoice
              key={vehicle.id}
              active={vehicle.id === selectedVehicleId}
              vehicle={vehicle}
              onPress={() => onSelect(vehicle.id)}
            />
          ))}
        </View>
      ) : (
        <EmptyPanel
          icon={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
          title="Aucun véhicule enregistré"
          text="Aucun véhicule n’est actuellement lié à votre profil client."
        />
      )}
    </View>
  );
}

function VehicleChoice({
  active,
  vehicle,
  onPress,
}: {
  active: boolean;
  vehicle: VehicleListItem;
  onPress: () => void;
}) {
  const logo = getBrandLogo(cleanValue(vehicle.brandName));
  const registration = getVehicleRegistration(vehicle);
  const year = cleanValue(vehicle.year);
  const mileage = cleanValue(vehicle.mileage);
  const maskedVin = getMaskedVin(vehicle);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.vehicleChoice,
        active && styles.vehicleChoiceActive,
        hovered && !active && styles.choiceHovered,
        pressed && styles.choicePressed,
      ]}
    >
      <View style={styles.vehicleChoiceTopline}>
        <View
          style={[
            styles.vehicleLogoFrame,
            logo &&
              'needsLightSurface' in logo &&
              logo.needsLightSurface &&
              styles.vehicleLogoFrameLight,
          ]}
        >
          {logo ? (
            <Image
              accessibilityLabel={`Logo ${logo.name}`}
              contentFit="contain"
              source={logo.source}
              style={styles.vehicleLogo}
            />
          ) : (
            <SymbolView
              name={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
              size={34}
              tintColor="#8FB7E8"
            />
          )}
        </View>
        {active ? (
          <View style={styles.selectedCheck}>
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              size={14}
              tintColor="#FFFFFF"
            />
          </View>
        ) : null}
      </View>
      <Text style={styles.vehicleName}>{getVehicleTitle(vehicle)}</Text>
      {registration ? (
        <Text style={styles.vehicleRegistration}>{registration}</Text>
      ) : null}
      <View style={styles.vehicleFacts}>
        {year ? <Text style={styles.vehicleFact}>{year}</Text> : null}
        {mileage ? <Text style={styles.vehicleFact}>{mileage}</Text> : null}
      </View>
      {maskedVin ? <Text style={styles.vehicleVin}>{maskedVin}</Text> : null}
    </Pressable>
  );
}

function VerificationStep({
  clientName,
  customerEmail,
  customerPhone,
  vehicle,
}: {
  clientName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  vehicle: VehicleListItem | null;
}) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 2"
        title="Vérifiez vos coordonnées"
        text="Ces informations permettent à l’atelier de préparer votre accueil."
      />
      <View style={styles.verificationGrid}>
        <InfoPanel
          icon={{ ios: 'person', android: 'person', web: 'person' }}
          lines={[
            ['Nom complet', clientName],
            ['Email', cleanValue(customerEmail) ?? 'À compléter'],
            ['Téléphone', cleanValue(customerPhone) ?? 'À compléter'],
          ]}
          title="Informations client"
        />
        <InfoPanel
          icon={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
          lines={[
            ['Véhicule', getVehicleTitle(vehicle)],
            ['Immatriculation', getVehicleRegistration(vehicle) ?? 'À compléter'],
          ]}
          title="Véhicule sélectionné"
        />
      </View>
      <View style={styles.privacyNotice}>
        <SymbolView
          name={{ ios: 'lock', android: 'lock', web: 'lock' }}
          size={16}
          tintColor="#2F5FA6"
        />
        <Text style={styles.privacyText}>
          Ces informations seront transmises uniquement à l’atelier sélectionné.
        </Text>
      </View>
    </View>
  );
}

function WorkshopStep({
  errorMessage,
  selectedWorkshopId,
  showrooms,
  workshops,
  onSelect,
}: {
  errorMessage: string | null;
  selectedWorkshopId: number | null;
  showrooms: DictionaryItem[];
  workshops: Workshop[];
  onSelect: (workshopId: number) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 3"
        title="Sélectionnez votre atelier"
        text="Choisissez le point de service correspondant à votre besoin."
      />
      {workshops.length > 0 ? (
        <View style={styles.choiceList}>
          {workshops.map((workshop) => {
            const active = workshop.id === selectedWorkshopId;
            const showroomName = showrooms.find(
              (showroom) => showroom.id === workshop.showroom_id
            )?.name;
            const meta = formatWorkshopMeta(workshop, showroomName);

            return (
              <CompactChoice
                key={workshop.id}
                active={active}
                icon={{ ios: 'mappin', android: 'location_on', web: 'location_on' }}
                meta={meta || undefined}
                title={cleanValue(workshop.name) ?? 'Atelier SMEIA'}
                onPress={() => onSelect(workshop.id)}
              />
            );
          })}
        </View>
      ) : (
        <EmptyPanel
          icon={{ ios: 'mappin', android: 'location_on', web: 'location_on' }}
          title="Aucun atelier disponible"
          text="Les ateliers SMEIA sont temporairement indisponibles."
        />
      )}
      {errorMessage ? (
        <View accessibilityRole="alert" style={styles.selectionErrorBox}>
          <SymbolView
            name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
            size={18}
            tintColor="#9B2C2C"
          />
          <Text style={styles.selectionErrorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ServiceTypeStep({
  errorMessage,
  selectedServiceType,
}: {
  errorMessage: string | null;
  selectedServiceType: DictionaryItem | null;
}) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 4"
        title="Votre prestation"
        text="Vérifiez la prestation déterminée à partir de l’atelier sélectionné."
      />
      {selectedServiceType ? (
        <>
          <View
            accessible
            accessibilityLabel={`Prestation sélectionnée : ${selectedServiceType.name}`}
            style={[styles.compactChoice, styles.compactChoiceActive]}
          >
            <View style={[styles.choiceIcon, styles.choiceIconActive]}>
              <SymbolView
                name={{ ios: 'wrench', android: 'build', web: 'build' }}
                size={20}
                tintColor="#FFFFFF"
              />
            </View>
            <View style={styles.choiceCopy}>
              <Text style={styles.choiceTitle}>{selectedServiceType.name}</Text>
            </View>
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>Sélectionnée</Text>
            </View>
          </View>
          <View style={styles.automaticSelectionNotice}>
            <SymbolView
              name={{ ios: 'info.circle', android: 'info', web: 'info' }}
              size={18}
              tintColor="#2F5FA6"
            />
            <Text style={styles.automaticSelectionNoticeText}>
              Cette prestation a été sélectionnée automatiquement selon l’atelier choisi.
            </Text>
          </View>
        </>
      ) : (
        <View accessibilityRole="alert">
          <EmptyPanel
            icon={{ ios: 'wrench', android: 'build', web: 'build' }}
            title="Prestation indisponible"
            text={
              errorMessage ??
              'Sélectionnez un atelier disponible pour déterminer la prestation.'
            }
          />
        </View>
      )}
    </View>
  );
}

function DateTimeStep({
  comment,
  requestedDate,
  requestedTime,
  onCommentChange,
  onDateChange,
  onTimeChange,
}: {
  comment: string;
  requestedDate: string;
  requestedTime: string;
  onCommentChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const selectedCalendarDate = useMemo(
    () => parseLocalDateValue(requestedDate),
    [requestedDate]
  );
  const minSelectableDate = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + 1);
    return date;
  }, []);
  const maxSelectableDate = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setMonth(date.getMonth() + 3);
    return date;
  }, []);
  const hasTimeSlots = APPOINTMENT_TIME_SLOT_GROUPS.some(
    (group) => group.slots.length > 0
  );

  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 5"
        title="Choisissez une date et une heure"
        text="Le créneau souhaité sera transmis à votre conseiller SMEIA."
      />
      <View style={[styles.dateTimeGrid, isNarrow && styles.dateTimeGridNarrow]}>
        <View style={styles.calendarPanel}>
          <Text style={styles.fieldLabel}>Date souhaitée</Text>
          <MonthlyCalendar
            maxDate={maxSelectableDate}
            minDate={minSelectableDate}
            selectedDate={selectedCalendarDate}
            testID="appointment-monthly-calendar"
            onSelect={(date) => onDateChange(formatLocalDateValue(date))}
          />
        </View>
        <View style={styles.timePanel}>
          <Text style={styles.fieldLabel}>Heure souhaitée</Text>
          {!requestedDate ? (
            <EmptyPanel
              compact
              icon={{ ios: 'calendar', android: 'event', web: 'event' }}
              title="Sélectionnez d’abord une date"
              text="Les créneaux apparaîtront après votre choix."
            />
          ) : !hasTimeSlots ? (
            <EmptyPanel
              compact
              icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
              title="Aucun créneau disponible"
              text="Choisissez une autre date pour poursuivre."
            />
          ) : (
            <View style={styles.timeSlotGroups}>
              {APPOINTMENT_TIME_SLOT_GROUPS.map((group) => (
                <View key={group.label} style={styles.timeSlotGroup}>
                  <Text style={styles.timeSlotGroupLabel}>{group.label}</Text>
                  <View style={styles.timeGrid}>
                    {group.slots.map((time) => {
                      const selected = requestedTime === time;
                      return (
                        <Pressable
                          key={time}
                          accessibilityRole="button"
                          onPress={() => onTimeChange(time)}
                          style={({ hovered, pressed }) => [
                            styles.timeSlot,
                            selected && styles.timeSlotSelected,
                            hovered && !selected && styles.choiceHovered,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.timeSlotText,
                              selected && styles.timeSlotTextSelected,
                            ]}
                          >
                            {time}
                          </Text>
                          {selected ? (
                            <SymbolView
                              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                              size={14}
                              tintColor="#FFFFFF"
                            />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      <View style={styles.commentField}>
        <Text style={styles.fieldLabel}>Commentaire client (facultatif)</Text>
        <TextInput
          multiline
          numberOfLines={4}
          onChangeText={onCommentChange}
          placeholder="Précisez votre demande ou vos contraintes..."
          placeholderTextColor="#8A97A8"
          style={styles.commentInput}
          textAlignVertical="top"
          value={comment}
        />
      </View>
    </View>
  );
}

function ConfirmationStep({
  clientName,
  comment,
  customerEmail,
  customerPhone,
  errorMessage,
  requestedDate,
  requestedTime,
  selectedServiceType,
  selectedVehicle,
  selectedWorkshop,
}: {
  clientName: string;
  comment: string;
  customerEmail: string | null;
  customerPhone: string | null;
  errorMessage: string | null;
  requestedDate: string;
  requestedTime: string;
  selectedServiceType: DictionaryItem | null;
  selectedVehicle: VehicleListItem | null;
  selectedWorkshop: Workshop | null;
}) {
  return (
    <View style={styles.stepContent}>
      <SectionIntro
        kicker="Étape 6"
        title="Confirmez votre demande"
        text="Relisez les informations avant leur transmission à l’atelier."
      />
      <View style={styles.confirmationGrid}>
        <View style={styles.confirmationSummary}>
          <InfoLine label="Véhicule" value={getVehicleTitle(selectedVehicle)} />
          <InfoLine
            label="Immatriculation"
            value={getVehicleRegistration(selectedVehicle) ?? 'À compléter'}
          />
          <InfoLine
            label="Coordonnées"
            value={
              [clientName, cleanValue(customerEmail), cleanValue(customerPhone)]
                .filter(Boolean)
                .join(' • ') || 'À compléter'
            }
          />
          <InfoLine
            label="Atelier"
            value={cleanValue(selectedWorkshop?.name) ?? 'À sélectionner'}
          />
          <InfoLine
            label="Prestation"
            value={cleanValue(selectedServiceType?.name) ?? 'À sélectionner'}
          />
          <InfoLine
            label="Date et heure"
            value={formatLongAppointmentDateTime(requestedDate, requestedTime)}
          />
          <InfoLine label="Commentaire" value={comment.trim() || 'Aucun commentaire'} />
        </View>
        <View style={styles.checklistPanel}>
          <Text style={styles.checklistTitle}>Votre demande est prête</Text>
          {[
            'Véhicule vérifié',
            'Atelier sélectionné',
            'Créneau réservé',
          ].map((item) => (
            <View key={item} style={styles.checklistItem}>
              <View style={styles.checklistIcon}>
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={13}
                  tintColor="#FFFFFF"
                />
              </View>
              <Text style={styles.checklistText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
      {errorMessage ? (
        <View style={styles.submitErrorBox}>
          <Text style={styles.submitErrorTitle}>Création impossible</Text>
          <Text style={styles.submitErrorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

function AppointmentSummary({
  expanded,
  isCompact,
  requestedDate,
  requestedTime,
  selectedServiceType,
  selectedVehicle,
  selectedWorkshop,
  selectedShowroomName,
  onToggle,
}: {
  expanded: boolean;
  isCompact: boolean;
  requestedDate: string;
  requestedTime: string;
  selectedServiceType: DictionaryItem | null;
  selectedVehicle: VehicleListItem | null;
  selectedWorkshop: Workshop | null;
  selectedShowroomName: string | null;
  onToggle: () => void;
}) {
  const logo = getBrandLogo(cleanValue(selectedVehicle?.brandName));
  const showContent = !isCompact || expanded;

  return (
    <View
      style={[
        styles.summaryColumn,
        isCompact && styles.summaryColumnCompact,
        !isCompact && WEB_STICKY_SUMMARY_STYLE,
      ]}
    >
      <Pressable
        accessibilityRole={isCompact ? 'button' : undefined}
        disabled={!isCompact}
        onPress={onToggle}
        style={styles.summaryHeader}
      >
        <View style={styles.summaryHeaderCopy}>
          <Text style={styles.summaryEyebrow}>Votre demande</Text>
          <Text style={styles.summaryTitle}>Résumé de votre rendez-vous</Text>
        </View>
        {isCompact ? (
          <SymbolView
            name={{
              ios: expanded ? 'chevron.up' : 'chevron.down',
              android: expanded ? 'expand_less' : 'expand_more',
              web: expanded ? 'expand_less' : 'expand_more',
            }}
            size={20}
            tintColor="#2F5FA6"
          />
        ) : null}
      </Pressable>
      {showContent ? (
        <View style={styles.summaryContent}>
          <View style={styles.summaryVehicle}>
            <View
              style={[
                styles.summaryLogoFrame,
                logo &&
                  'needsLightSurface' in logo &&
                  logo.needsLightSurface &&
                  styles.summaryLogoFrameLight,
              ]}
            >
              {logo ? (
                <Image
                  accessibilityLabel={`Logo ${logo.name}`}
                  contentFit="contain"
                  source={logo.source}
                  style={styles.summaryLogo}
                />
              ) : (
                <SymbolView
                  name={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
                  size={27}
                  tintColor="#8FB7E8"
                />
              )}
            </View>
            <View style={styles.summaryVehicleCopy}>
              <Text style={styles.summaryVehicleName}>
                {selectedVehicle ? getVehicleTitle(selectedVehicle) : 'À sélectionner'}
              </Text>
              <Text style={styles.summaryVehicleMeta}>
                {getVehicleRegistration(selectedVehicle) ?? 'À sélectionner'}
              </Text>
            </View>
          </View>
          <SummaryRow
            icon={{ ios: 'mappin', android: 'location_on', web: 'location_on' }}
            label="Atelier"
            value={cleanValue(selectedWorkshop?.name) ?? 'À sélectionner'}
            meta={cleanValue(selectedShowroomName)}
          />
          <SummaryRow
            icon={{ ios: 'wrench', android: 'build', web: 'build' }}
            label="Prestation"
            value={cleanValue(selectedServiceType?.name) ?? 'À sélectionner'}
          />
          <SummaryRow
            icon={{ ios: 'calendar', android: 'event', web: 'event' }}
            label="Date"
            value={formatShortAppointmentDate(requestedDate)}
          />
          <SummaryRow
            icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
            label="Heure"
            value={requestedTime || 'À sélectionner'}
          />
        </View>
      ) : null}
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  meta,
}: {
  icon: SymbolName;
  label: string;
  value: string;
  meta?: string | null;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryRowIcon}>
        <SymbolView name={icon} size={16} tintColor="#2F5FA6" />
      </View>
      <View style={styles.summaryRowCopy}>
        <Text style={styles.summaryRowLabel}>{label}</Text>
        <Text style={styles.summaryRowValue}>{value}</Text>
        {meta ? <Text style={styles.summaryRowMeta}>{meta}</Text> : null}
      </View>
    </View>
  );
}

function WizardActions({
  activeStep,
  canContinue,
  canSubmit,
  isNarrow,
  isSubmitting,
  onBack,
  onContinue,
  onSubmit,
}: {
  activeStep: number;
  canContinue: boolean;
  canSubmit: boolean;
  isNarrow: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSubmit: () => void;
}) {
  const isLastStep = activeStep === STEPS.length - 1;
  const primaryEnabled = isLastStep ? canSubmit : canContinue;

  return (
    <View
      style={[
        styles.actions,
        isNarrow && styles.actionsNarrow,
        WEB_STICKY_ACTION_STYLE,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        disabled={activeStep === 0 || isSubmitting}
        onPress={onBack}
        style={({ hovered, pressed }) => [
          styles.secondaryAction,
          isNarrow && styles.actionButtonNarrow,
          hovered && activeStep > 0 && styles.secondaryActionHovered,
          pressed && activeStep > 0 && styles.pressed,
          (activeStep === 0 || isSubmitting) && styles.disabled,
        ]}
      >
        <SymbolView
          name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }}
          size={16}
          tintColor="#2F5FA6"
        />
        <Text style={styles.secondaryActionText}>Précédent</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!primaryEnabled || isSubmitting}
        onPress={isLastStep ? onSubmit : onContinue}
        style={({ hovered, pressed }) => [
          styles.primaryAction,
          isNarrow && styles.actionButtonNarrow,
          hovered && primaryEnabled && styles.primaryActionHovered,
          pressed && primaryEnabled && styles.pressed,
          (!primaryEnabled || isSubmitting) && styles.disabled,
        ]}
      >
        {isSubmitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        <Text numberOfLines={2} style={styles.primaryActionText}>
          {isSubmitting
            ? 'Création en cours...'
            : isLastStep
              ? 'Confirmer mon rendez-vous'
              : 'Continuer'}
        </Text>
        {!isSubmitting && !isLastStep ? (
          <SymbolView
            name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
            size={16}
            tintColor="#FFFFFF"
          />
        ) : null}
      </Pressable>
    </View>
  );
}

function CompactChoice({
  active,
  icon,
  meta,
  title,
  onPress,
}: {
  active: boolean;
  icon: SymbolName;
  meta?: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.compactChoice,
        active && styles.compactChoiceActive,
        hovered && !active && styles.choiceHovered,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
        <SymbolView name={icon} size={20} tintColor={active ? '#FFFFFF' : '#2F5FA6'} />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        {meta ? <Text style={styles.choiceMeta}>{meta}</Text> : null}
      </View>
      {active ? (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>Sélectionné</Text>
        </View>
      ) : (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={18}
          tintColor="#8A97A8"
        />
      )}
    </Pressable>
  );
}

function SectionIntro({
  kicker,
  title,
  text,
}: {
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.sectionIntro}>
      <Text style={styles.sectionKicker}>{kicker}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

function InfoPanel({
  icon,
  lines,
  title,
}: {
  icon: SymbolName;
  lines: Array<[string, string]>;
  title: string;
}) {
  return (
    <View style={styles.infoPanel}>
      <View style={styles.infoPanelHeader}>
        <View style={styles.infoPanelIcon}>
          <SymbolView name={icon} size={18} tintColor="#2F5FA6" />
        </View>
        <Text style={styles.infoPanelTitle}>{title}</Text>
      </View>
      {lines.map(([label, value]) => (
        <InfoLine key={label} label={label} value={value} />
      ))}
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

function EmptyPanel({
  compact = false,
  icon,
  title,
  text,
}: {
  compact?: boolean;
  icon: SymbolName;
  title: string;
  text: string;
}) {
  return (
    <View style={[styles.emptyPanel, compact && styles.emptyPanelCompact]}>
      <View style={styles.emptyIcon}>
        <SymbolView name={icon} size={22} tintColor="#2F5FA6" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function SuccessPanel({
  date,
  time,
  workshopName,
}: {
  date: string;
  time: string;
  workshopName: string;
}) {
  return (
    <View style={styles.successPanel}>
      <View style={styles.successIcon}>
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          size={30}
          tintColor="#FFFFFF"
        />
      </View>
      <Text style={styles.successTitle}>Votre demande est confirmée</Text>
      <Text style={styles.successText}>
        Votre rendez-vous a bien été transmis à {workshopName}.
      </Text>
      <View style={styles.successDetails}>
        <SummaryRow
          icon={{ ios: 'calendar', android: 'event', web: 'event' }}
          label="Date et heure"
          value={formatLongAppointmentDateTime(date, time)}
        />
        <SummaryRow
          icon={{ ios: 'mappin', android: 'location_on', web: 'location_on' }}
          label="Atelier"
          value={workshopName}
        />
      </View>
      <Link href="/" asChild>
        <Pressable
          accessibilityRole="link"
          style={({ hovered, pressed }) => [
            styles.successAction,
            hovered && styles.primaryActionHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryActionText}>Retour au tableau de bord</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function AppointmentSkeleton() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.desktop;

  return (
    <View style={styles.skeletonPage} accessibilityLabel="Chargement de la conciergerie atelier">
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSubtitle} />
      </View>
      <View style={styles.skeletonStepper}>
        {STEPS.map((step) => (
          <View key={step.label} style={styles.skeletonStep} />
        ))}
      </View>
      <View
        style={[
          styles.skeletonWorkspace,
          isCompact && styles.skeletonWorkspaceCompact,
        ]}
      >
        <View style={styles.skeletonMain} />
        <View style={styles.skeletonSide} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stateContainer: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  contentScroll: { flex: 1, backgroundColor: '#F4F6FA' },
  content: {
    width: '100%',
    maxWidth: 1320,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#26344C',
    borderRadius: 20,
    backgroundColor: '#0B1220',
  },
  headerCopy: { flex: 1, flexShrink: 1, minWidth: 0, gap: spacing.xs },
  eyebrow: {
    color: '#8FB7E8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    maxWidth: 680,
    color: '#D9E5F5',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  progressBlock: { width: 250, maxWidth: '100%', gap: spacing.sm },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  progressStepText: { color: '#D9E5F5', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  progressPercent: { color: '#FFFFFF', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  progressTrack: { width: '100%', height: 7, borderRadius: 7, backgroundColor: '#26344C', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 7, backgroundColor: '#72B7FF' },
  stepperScroll: { flexGrow: 0, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 18, backgroundColor: '#FFFFFF' },
  stepperContent: { minWidth: '100%', paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  stepWrapper: { minWidth: 172, flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepButton: { minWidth: 138, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs, borderRadius: 12 },
  stepButtonHovered: { backgroundColor: '#F4F8FD' },
  stepCircle: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D5DCE8', borderRadius: 17, backgroundColor: '#F7F9FC' },
  stepCircleComplete: { borderColor: '#2F7D67', backgroundColor: '#2F7D67' },
  stepCircleActive: { borderColor: '#2F5FA6', backgroundColor: '#2F5FA6' },
  stepCopy: { minWidth: 0, flex: 1, gap: 2 },
  stepLabel: { color: '#8A97A8', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semiBold },
  stepLabelComplete: { color: '#2F7D67' },
  stepLabelActive: { color: '#2F5FA6', fontWeight: typography.fontWeight.bold },
  stepCurrent: { color: '#2F5FA6', fontSize: 10, fontWeight: typography.fontWeight.bold },
  stepConnector: { flex: 1, minWidth: 20, height: 2, backgroundColor: '#DDE3EC' },
  stepConnectorComplete: { backgroundColor: '#7EB7A4' },
  workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  workspaceCompact: { flexDirection: 'column' },
  formColumn: { flex: 1, minWidth: 0, gap: spacing.md },
  formPanel: { minHeight: 430, padding: spacing.lg, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 20, backgroundColor: '#FFFFFF' },
  stepContent: { gap: spacing.lg },
  sectionIntro: { gap: spacing.xs },
  sectionKicker: { color: '#2F5FA6', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textTransform: 'uppercase' },
  sectionTitle: { color: '#15294D', fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold },
  sectionText: { maxWidth: 720, color: '#5A6470', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  vehicleChoice: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 18, backgroundColor: '#FFFFFF', transform: [{ scale: 0.995 }] },
  vehicleChoiceActive: { borderColor: '#7FA5D4', backgroundColor: '#F1F6FD', shadowColor: '#2F5FA6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 18, transform: [{ scale: 1 }] },
  choiceHovered: { borderColor: '#BFD2EC', backgroundColor: '#F7FAFF' },
  choicePressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  vehicleChoiceTopline: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  vehicleLogoFrame: { width: 74, height: 58, alignItems: 'center', justifyContent: 'center', padding: spacing.xs, borderRadius: 14, backgroundColor: '#0B1220' },
  vehicleLogoFrameLight: { borderWidth: 1, borderColor: '#D7E0EC', backgroundColor: '#FFFFFF' },
  vehicleLogo: { width: '100%', height: '100%' },
  selectedCheck: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#2F5FA6' },
  vehicleName: { color: '#15294D', fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  vehicleRegistration: { color: '#2F5FA6', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  vehicleFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vehicleFact: { color: '#5A6470', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semiBold },
  vehicleVin: { color: '#7A8798', fontSize: typography.fontSize.xs },
  verificationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  infoPanel: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 18, backgroundColor: '#F8FAFC' },
  infoPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#E6EAF2' },
  infoPanelIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF2FC' },
  infoPanelTitle: { flex: 1, color: '#15294D', fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  infoLabel: { flex: 0.8, color: '#5A6470', fontSize: typography.fontSize.sm },
  infoValue: { flex: 1.2, color: '#15294D', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semiBold, textAlign: 'right' },
  privacyNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: '#EDF4FF' },
  privacyText: { flex: 1, color: '#46617F', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  selectionErrorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#F0B6B6', borderRadius: 14, backgroundColor: '#FFF5F5' },
  selectionErrorText: { flex: 1, color: '#7A3434', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  choiceList: { gap: spacing.sm },
  compactChoice: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 16, backgroundColor: '#FFFFFF' },
  compactChoiceActive: { borderColor: '#7FA5D4', backgroundColor: '#F1F6FD' },
  choiceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EDF4FF' },
  choiceIconActive: { backgroundColor: '#2F5FA6' },
  choiceCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  choiceTitle: { color: '#15294D', fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  choiceMeta: { color: '#5A6470', fontSize: typography.fontSize.xs },
  selectedBadge: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 12, backgroundColor: '#DDEAF9' },
  selectedBadgeText: { color: '#2F5FA6', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  automaticSelectionNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: '#EDF4FF' },
  automaticSelectionNoticeText: { flex: 1, color: '#46617F', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  dateTimeGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  dateTimeGridNarrow: { flexDirection: 'column' },
  calendarPanel: { flex: 1.2, minWidth: 0, gap: spacing.sm },
  timePanel: { flex: 0.8, width: '100%', minWidth: 0, gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 18, backgroundColor: '#F8FAFC' },
  fieldLabel: { color: '#15294D', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  timeSlotGroups: { gap: spacing.lg },
  timeSlotGroup: { gap: spacing.sm },
  timeSlotGroupLabel: { color: '#5A6470', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textTransform: 'uppercase' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeSlot: { minWidth: 84, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#D8E2F0', borderRadius: 12, backgroundColor: '#FFFFFF' },
  timeSlotSelected: { borderColor: '#2F5FA6', backgroundColor: '#2F5FA6' },
  timeSlotText: { color: '#15294D', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  timeSlotTextSelected: { color: '#FFFFFF' },
  commentField: { gap: spacing.sm },
  commentInput: { minHeight: 100, padding: spacing.md, borderWidth: 1, borderColor: '#D8E2F0', borderRadius: 14, backgroundColor: '#F8FAFC', color: '#15294D', fontSize: typography.fontSize.sm },
  confirmationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  confirmationSummary: { flex: 1.4, flexShrink: 1, flexBasis: 320, minWidth: 0, gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 18, backgroundColor: '#F8FAFC' },
  checklistPanel: { flex: 0.6, flexShrink: 1, flexBasis: 240, minWidth: 0, gap: spacing.md, padding: spacing.md, borderRadius: 18, backgroundColor: '#0B1220' },
  checklistTitle: { color: '#FFFFFF', fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  checklistItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checklistIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#2F7D67' },
  checklistText: { flex: 1, color: '#D9E5F5', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semiBold },
  submitErrorBox: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: '#F0B6B6', borderRadius: 14, backgroundColor: '#FFF5F5' },
  submitErrorTitle: { color: '#9B2C2C', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  submitErrorText: { color: '#7A3434', fontSize: typography.fontSize.sm },
  summaryColumn: { width: 340, maxWidth: '100%', alignSelf: 'flex-start', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 20, backgroundColor: '#FFFFFF' },
  summaryColumnCompact: { width: '100%' },
  summaryHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryHeaderCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  summaryEyebrow: { color: '#2F5FA6', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textTransform: 'uppercase' },
  summaryTitle: { color: '#15294D', fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  summaryContent: { gap: spacing.sm },
  summaryVehicle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: '#0B1220' },
  summaryLogoFrame: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', padding: spacing.xs },
  summaryLogoFrameLight: { borderRadius: 12, backgroundColor: '#FFFFFF' },
  summaryLogo: { width: '100%', height: '100%' },
  summaryVehicleCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  summaryVehicleName: { color: '#FFFFFF', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  summaryVehicleMeta: { color: '#AFC3DC', fontSize: typography.fontSize.xs },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  summaryRowIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EDF4FF' },
  summaryRowCopy: { flex: 1, minWidth: 0, gap: 2 },
  summaryRowLabel: { color: '#7A8798', fontSize: typography.fontSize.xs },
  summaryRowValue: { color: '#15294D', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  summaryRowMeta: { color: '#5A6470', fontSize: typography.fontSize.xs },
  actions: { zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF2', borderRadius: 18, backgroundColor: '#FFFFFF' },
  actionsNarrow: { gap: spacing.sm },
  actionButtonNarrow: { flex: 1, minWidth: 0, maxWidth: '100%', paddingHorizontal: spacing.sm },
  primaryAction: { minWidth: 190, maxWidth: '60%', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 14, backgroundColor: '#2F5FA6' },
  primaryActionHovered: { backgroundColor: '#244B86' },
  primaryActionText: { flexShrink: 1, color: '#FFFFFF', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, textAlign: 'center' },
  secondaryAction: { minWidth: 130, maxWidth: '40%', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: '#C8D5E6', borderRadius: 14, backgroundColor: '#FFFFFF' },
  secondaryActionHovered: { backgroundColor: '#F4F8FD' },
  secondaryActionText: { flexShrink: 1, color: '#2F5FA6', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  disabled: { opacity: 0.46 },
  pressed: { opacity: 0.84 },
  emptyPanel: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 18, backgroundColor: '#F8FAFC' },
  emptyPanelCompact: { minHeight: 130, padding: spacing.md },
  emptyIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#EAF2FC' },
  emptyTitle: { color: '#15294D', fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, textAlign: 'center' },
  emptyText: { maxWidth: 440, color: '#5A6470', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm, textAlign: 'center' },
  successPanel: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderWidth: 1, borderColor: '#B9DCCF', borderRadius: 20, backgroundColor: '#FFFFFF' },
  successIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: '#2F7D67' },
  successTitle: { color: '#15294D', fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, textAlign: 'center' },
  successText: { color: '#5A6470', fontSize: typography.fontSize.sm, textAlign: 'center' },
  successDetails: { width: '100%', maxWidth: 560, gap: spacing.xs, padding: spacing.md, borderRadius: 16, backgroundColor: '#F8FAFC' },
  successAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 14, backgroundColor: '#2F5FA6' },
  skeletonPage: { flex: 1, width: '100%', maxWidth: 1320, alignSelf: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: '#F4F6FA' },
  skeletonHeader: { minHeight: 130, gap: spacing.md, padding: spacing.lg, borderRadius: 20, backgroundColor: '#DDE4ED' },
  skeletonTitle: { width: '42%', height: 24, borderRadius: 8, backgroundColor: '#C7D0DC' },
  skeletonSubtitle: { width: '68%', height: 12, borderRadius: 6, backgroundColor: '#C7D0DC' },
  skeletonStepper: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 18, backgroundColor: '#FFFFFF' },
  skeletonStep: { flex: 1, height: 34, borderRadius: 12, backgroundColor: '#E6EAF2' },
  skeletonWorkspace: { flexDirection: 'row', gap: spacing.lg },
  skeletonWorkspaceCompact: { flexDirection: 'column' },
  skeletonMain: { flex: 1, minHeight: 430, borderRadius: 20, backgroundColor: '#FFFFFF' },
  skeletonSide: { width: 340, maxWidth: '100%', minHeight: 350, borderRadius: 20, backgroundColor: '#FFFFFF' },
});
