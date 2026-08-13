import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uuid as expoUuid } from 'expo-modules-core';
import { Link, useLocalSearchParams } from 'expo-router';
import {
  Image,
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
import { useToasts } from '@/components/feedback/ToastProvider';
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import type {
  AiBookingAvailabilityOption,
  AiBookingAvailabilityResult,
  AiBookingConfirmationResult,
  AiBookingPreferredPeriod,
  AiBookingResultMode,
} from '@/core/api/ai-booking.api';
import type {
  AiDiagnosticAnswer,
  AiDiagnosticConfidence,
  AiDiagnosticDrivingAdvice,
  AiDiagnosticPhoto,
  AiDiagnosticOutputUrgencyLevel,
  AiDiagnosticQuestion,
  AiDiagnosticResult,
  AiDiagnosticServiceTypeId,
  AiDiagnosticWorkshopId,
} from '@/core/api/ai-diagnostics.api';
import type { DictionaryItem, Workshop } from '@/core/api/dictionaries.api';
import { HttpError } from '@/core/api/http-client';
import {
  useServiceTypes,
  useWorkshops,
} from '@/core/api/use-dictionaries';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useAnalyzeAiDiagnostic } from '@/features/ai-diagnostic/hooks/useAnalyzeAiDiagnostic';
import { useConfirmAiAppointment } from '@/features/ai-diagnostic/hooks/useConfirmAiAppointment';
import { useSearchAiAppointmentAvailability } from '@/features/ai-diagnostic/hooks/useSearchAiAppointmentAvailability';
import {
  AI_BOOKING_TIME_ZONE,
  formatBookingDate,
  formatBookingTime,
  getAiBookingErrorMessage,
  getBookingWindowEndIso,
  getCasablancaTodayIso,
  getCompatibleWorkshopIds,
  getDaySlotsNotFoundMessage,
  isBookingConflict,
  isBookingOptionExpired,
  isValidBookingDate,
} from '@/features/ai-diagnostic/model/ai-booking.presenter';
import { BookingDateCalendar } from '@/features/ai-diagnostic/ui/BookingDateCalendar';
import {
  AiJourneyProgress,
  IntelligenceOrb,
  SecureAnalysisVisual,
} from '@/features/ai-diagnostic/ui/AiDiagnosticVisuals';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';
import { useAuthStore } from '@/store/auth.store';

const MAX_DESCRIPTION_LENGTH = 3_000;
const MAX_ANSWER_LENGTH = 1_000;
const MAX_ANSWERS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type SelectedAiPhoto = {
  fileName: string | null;
  previewUri: string;
  sizeBytes: number;
  payload: AiDiagnosticPhoto;
};

const acceptedPhotoMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function getPhotoMimeType(asset: ImagePicker.ImagePickerAsset): string | null {
  const mimeType = asset.mimeType?.trim().toLowerCase();

  if (mimeType) {
    return mimeType;
  }

  const filePath = `${asset.fileName ?? ''} ${asset.uri}`.toLowerCase();

  if (/\.jpe?g(?:$|[?#\s])/.test(filePath)) {
    return 'image/jpeg';
  }

  if (/\.png(?:$|[?#\s])/.test(filePath)) {
    return 'image/png';
  }

  if (/\.webp(?:$|[?#\s])/.test(filePath)) {
    return 'image/webp';
  }

  return null;
}

function getDecodedBase64Size(base64: string): number | null {
  if (
    base64.length === 0 ||
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
  ) {
    return null;
  }

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;

  return (base64.length / 4) * 3 - padding;
}

function formatPhotoSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toLocaleString('fr-FR', {
      maximumFractionDigits: 2,
    })} Mo`;
  }

  return `${Math.max(1, Math.ceil(sizeBytes / 1024)).toLocaleString('fr-FR')} Ko`;
}

const urgencyLabels: Record<AiDiagnosticOutputUrgencyLevel, string> = {
  low: 'Faible',
  medium: 'Modérée',
  high: 'Élevée',
  critical: 'Critique',
};

const drivingAdviceLabels: Record<AiDiagnosticDrivingAdvice, string> = {
  normal: 'Conduite normale',
  caution: 'Conduite avec prudence',
  stop_if_possible: 'Arrêtez-vous dès que possible',
  do_not_drive: 'Ne conduisez pas le véhicule',
};

const confidenceLabels: Record<AiDiagnosticConfidence, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
};

type JourneyStep = 'initial' | 'answering' | 'result';
type BookingPreparationChoice = 'orientation' | 'manual';
type ManualBookingNeed =
  | 'diagnostic'
  | 'mechanical'
  | 'bodywork'
  | 'paint';
type ManualQuoteChoice = 'without_quote' | 'with_quote';

type InitialFormErrors = {
  vehicle?: string;
  description?: string;
};

type AnswerDraft = {
  selectedOption: string;
  freeText: string;
};

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'client SMEIA';
}

function isMissingVehicleLabel(value: string): boolean {
  const normalizedValue = value.trim().toLocaleLowerCase('fr-FR');

  return (
    normalizedValue.length === 0 ||
    normalizedValue === 'unknown' ||
    normalizedValue.includes('non renseign')
  );
}

function getVehicleDisplayName(vehicle: VehicleListItem): string {
  const brandName = isMissingVehicleLabel(vehicle.brandName)
    ? ''
    : vehicle.brandName.trim();
  const model = isMissingVehicleLabel(vehicle.model) ? '' : vehicle.model.trim();

  if (brandName && model) {
    return `${brandName} ${model}`;
  }

  if (brandName) {
    return `Véhicule ${brandName}`;
  }

  return model || 'Véhicule SMEIA';
}

function getVehicleMeta(vehicle: VehicleListItem): string {
  return [
    vehicle.yearValue === null ? null : vehicle.year,
    vehicle.mileageValue === null ? null : vehicle.mileage,
  ]
    .filter((value): value is string => value !== null)
    .join(' · ');
}

function getQuestionKey(question: AiDiagnosticQuestion, index: number): string {
  return `${question.id}:${index}`;
}

function composeAnswer(draft?: AnswerDraft): string {
  const selectedOption = draft?.selectedOption.trim() ?? '';
  const freeText = draft?.freeText.trim() ?? '';

  if (selectedOption && freeText) {
    return `${selectedOption} — Précision : ${freeText}`;
  }

  return selectedOption || freeText;
}

function getAnalysisErrorMessage(error: unknown): string {
  if (!(error instanceof HttpError)) {
    return "Le backend IA est inaccessible. Vérifiez votre connexion puis réessayez.";
  }

  if (error.status === 400) {
    return 'Certaines informations sont invalides. Vérifiez le véhicule, la description et les réponses.';
  }

  if (error.status === 401) {
    return 'Votre session a expiré. Veuillez vous reconnecter.';
  }

  if (error.status === 403 || error.status === 404) {
    return "Ce véhicule n'est pas accessible avec votre compte.";
  }

  if (error.status === 413) {
    return 'Le contenu envoyé est trop volumineux.';
  }

  if (error.status === 429) {
    return 'Trop de demandes ont été envoyées. Réessayez plus tard.';
  }

  if (error.status === 502) {
    return "L'analyse est temporairement indisponible. Réessayez plus tard.";
  }

  if (error.status === 504) {
    return "Le délai d'analyse a été dépassé. Réessayez plus tard.";
  }

  return "L'analyse n'a pas pu être réalisée. Réessayez plus tard.";
}

function getDescriptionError(description: string): string | null {
  const trimmedDescription = description.trim();

  if (trimmedDescription.length === 0) {
    return 'Décrivez le problème rencontré.';
  }

  if (trimmedDescription.length < 10) {
    return 'La description doit contenir au moins 10 caractères.';
  }

  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    return `La description ne doit pas dépasser ${MAX_DESCRIPTION_LENGTH} caractères.`;
  }

  return null;
}

function getUniqueQuestions(
  questions: AiDiagnosticQuestion[],
  previousAnswers: AiDiagnosticAnswer[]
): AiDiagnosticQuestion[] {
  const seenQuestions = new Set(
    previousAnswers.map((answer) => answer.question)
  );

  return questions.filter((question) => {
    if (seenQuestions.has(question.text)) {
      return false;
    }

    seenQuestions.add(question.text);
    return true;
  });
}

function getServiceTypeName(
  serviceTypeId: number | null,
  serviceTypes: readonly DictionaryItem[]
): string {
  if (serviceTypeId === null) {
    return 'Aucun service recommandé';
  }

  const serviceName = serviceTypes
    .find((serviceType) => serviceType.id === serviceTypeId)
    ?.name.trim();

  return serviceName || 'Nom du service indisponible';
}

function getWorkshopDisplayNames(
  workshopIds: readonly number[],
  workshops: readonly Workshop[]
): string[] {
  if (workshopIds.length === 0) {
    return [];
  }

  return workshopIds.map((workshopId) => {
    const workshopName = workshops
      .find((workshop) => workshop.id === workshopId)
      ?.name.trim();

    return workshopName || "Nom de l'atelier indisponible";
  });
}

function createSecureIdempotencyKey(): string | null {
  try {
    return expoUuid.v4();
  } catch {
    return null;
  }
}

type BookingDateMode = 'earliest' | 'date';
type BookingAvailabilityView = 'suggestions' | 'day_slots';

type BookingIdempotencyAttempt = {
  idempotencyKey: string;
  problemSummary: string;
  slotToken: string;
};

type AiBookingContext = {
  problemSummary: string;
  serviceTypeId: AiDiagnosticServiceTypeId;
  serviceTypeName: string;
  workshopCardLabel: string;
  workshopIds: readonly AiDiagnosticWorkshopId[];
  workshopSelectionDescription: string;
};

type BookingContactDetails = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

const AI_BOOKING_WORKSHOP_IDS = new Set<number>([1, 2, 3, 4]);
const MANUAL_BOOKING_NEEDS: ReadonlyArray<{
  label: string;
  value: ManualBookingNeed;
}> = [
  { label: 'Diagnostic ou voyant', value: 'diagnostic' },
  { label: 'Problème mécanique', value: 'mechanical' },
  { label: 'Carrosserie', value: 'bodywork' },
  { label: 'Peinture', value: 'paint' },
];

const MANUAL_PROBLEM_SUMMARY_BY_SERVICE_TYPE_ID: Readonly<
  Record<AiDiagnosticServiceTypeId, string>
> = {
  2: 'Le client demande un diagnostic pour son véhicule.',
  3: 'Le client demande l’établissement d’un devis mécanique.',
  4: 'Le client demande l’établissement d’un devis carrosserie.',
  5: 'Le client demande l’établissement d’un devis peinture.',
  6: 'Le client demande une réparation carrosserie selon un devis SMEIA validé.',
  7: 'Le client demande une réparation peinture selon un devis SMEIA validé.',
  8: 'Le client demande une réparation mécanique selon un devis SMEIA validé.',
};

function getManualServiceTypeId(
  need: ManualBookingNeed | null,
  quoteChoice: ManualQuoteChoice | null
): AiDiagnosticServiceTypeId | null {
  if (need === 'diagnostic') {
    return 2;
  }

  if (need === null || quoteChoice === null) {
    return null;
  }

  if (need === 'mechanical') {
    return quoteChoice === 'with_quote' ? 8 : 3;
  }

  if (need === 'bodywork') {
    return quoteChoice === 'with_quote' ? 6 : 4;
  }

  return quoteChoice === 'with_quote' ? 7 : 5;
}

function buildManualProblemSummary(
  serviceTypeId: AiDiagnosticServiceTypeId,
  precision: string
): string {
  const baseSummary = MANUAL_PROBLEM_SUMMARY_BY_SERVICE_TYPE_ID[serviceTypeId];
  const normalizedPrecision = precision.trim();

  return normalizedPrecision
    ? `${baseSummary} Précision du client : ${normalizedPrecision}`
    : baseSummary;
}

function getSingleSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAiBookingWorkshopId(
  value: number
): value is AiDiagnosticWorkshopId {
  return AI_BOOKING_WORKSHOP_IDS.has(value);
}

const bookingStepLabels = [
  'Atelier',
  'Préférence',
  'Créneau',
  'Confirmation',
] as const;

const bookingPeriodOptions: ReadonlyArray<{
  label: string;
  value: AiBookingPreferredPeriod;
}> = [
  { label: 'Toute la journée', value: 'any' },
  { label: 'Matin', value: 'morning' },
  { label: 'Après-midi', value: 'afternoon' },
];

export function AiDiagnosticScreen() {
  const searchParams = useLocalSearchParams<{
    mode?: string | string[];
    source?: string | string[];
  }>();
  const isBookingMode = getSingleSearchParam(searchParams.mode) === 'booking';
  const bookingSource =
    getSingleSearchParam(searchParams.source) === 'appointments'
      ? 'appointments'
      : null;
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const submissionLockRef = useRef(false);
  const [journeyStep, setJourneyStep] = useState<JourneyStep>('initial');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null
  );
  const [description, setDescription] = useState('');
  const [initialFormErrors, setInitialFormErrors] =
    useState<InitialFormErrors>({});
  const [accumulatedAnswers, setAccumulatedAnswers] = useState<
    AiDiagnosticAnswer[]
  >([]);
  const [questions, setQuestions] = useState<AiDiagnosticQuestion[]>([]);
  const [questionMessage, setQuestionMessage] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<
    Record<string, AnswerDraft>
  >({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [flowBlockMessage, setFlowBlockMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<AiDiagnosticResult | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedAiPhoto | null>(
    null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [bookingPreparation, setBookingPreparation] =
    useState<BookingPreparationChoice | null>(null);
  const [bookingRequested, setBookingRequested] = useState(false);
  const vehiclesQuery = useVehicles();
  const serviceTypesQuery = useServiceTypes();
  const workshopsQuery = useWorkshops();
  const analyzeDiagnostic = useAnalyzeAiDiagnostic();
  const { showToast } = useToasts();
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const vehicles = vehiclesQuery.data ?? [];
  const clientName = getDisplayName(
    customer?.firstName ?? user?.firstName,
    customer?.lastName ?? user?.lastName,
    customer?.email ?? user?.email
  );
  const bookingContacts: BookingContactDetails = {
    name: clientName,
    email: customer?.email ?? user?.email ?? null,
    phone: customer?.phone ?? null,
    address: customer?.address ?? null,
  };
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles]
  );
  const isPending = analyzeDiagnostic.isPending;
  const progressStep: 1 | 2 | 3 | 4 =
    journeyStep === 'result'
      ? 4
      : isPending || journeyStep === 'answering'
        ? 3
        : selectedVehicleId === null
          ? 1
          : 2;

  const resetJourney = () => {
    submissionLockRef.current = false;
    setJourneyStep('initial');
    setSelectedVehicleId(null);
    setDescription('');
    setInitialFormErrors({});
    setAccumulatedAnswers([]);
    setQuestions([]);
    setQuestionMessage('');
    setAnswerDrafts({});
    setAnswerErrors({});
    setFlowBlockMessage(null);
    setAnalysisError(null);
    setResult(null);
    setSelectedPhoto(null);
    setPhotoError(null);
    setBookingRequested(false);
    analyzeDiagnostic.reset();
  };

  const changeBookingJourney = () => {
    resetJourney();
    setBookingPreparation(null);
  };

  const handlePhotoSelection = async () => {
    if (isPending) {
      return;
    }

    setPhotoError(null);

    try {
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        base64: true,
        exif: false,
        quality: 1,
        selectionLimit: 1,
      });

      if (selection.canceled) {
        return;
      }

      const asset = selection.assets[0];
      const sourceMimeType = asset ? getPhotoMimeType(asset) : null;

      if (
        !asset ||
        (asset.type !== undefined && asset.type !== 'image') ||
        !sourceMimeType ||
        !acceptedPhotoMimeTypes.has(sourceMimeType)
      ) {
        setPhotoError(
          'Format non pris en charge. Choisissez une image JPEG, PNG ou WebP.'
        );
        return;
      }

      if (asset.fileSize !== undefined && asset.fileSize > MAX_PHOTO_BYTES) {
        setPhotoError('La photo ne doit pas dépasser 5 Mo.');
        return;
      }

      if (!asset.base64) {
        setPhotoError("La photo n'a pas pu être préparée. Choisissez-en une autre.");
        return;
      }

      const decodedSize = getDecodedBase64Size(asset.base64);

      if (decodedSize === null) {
        setPhotoError("Le contenu de la photo n'est pas valide.");
        return;
      }

      if (decodedSize > MAX_PHOTO_BYTES) {
        setPhotoError('La photo ne doit pas dépasser 5 Mo.');
        return;
      }

      setSelectedPhoto({
        fileName: asset.fileName ?? null,
        previewUri: asset.uri,
        sizeBytes: decodedSize,
        payload: {
          mime_type: 'image/jpeg',
          data_url: `data:image/jpeg;base64,${asset.base64}`,
        },
      });
    } catch {
      setPhotoError(
        "La photothèque n'est pas accessible. Réessayez depuis votre appareil."
      );
    }
  };

  const handlePhotoRemoval = () => {
    if (isPending) {
      return;
    }

    setSelectedPhoto(null);
    setPhotoError(null);
  };

  const handleAnalysisSuccess = (
    diagnostic: AiDiagnosticResult,
    answersSent: AiDiagnosticAnswer[]
  ) => {
    setAccumulatedAnswers(answersSent);
    setAnalysisError(null);

    if (diagnostic.diagnosis_status === 'needs_questions') {
      const nextQuestions = getUniqueQuestions(
        diagnostic.questions,
        answersSent
      );

      setResult(null);
      setQuestionMessage(diagnostic.client_message);
      setQuestions(nextQuestions);
      setAnswerDrafts({});
      setAnswerErrors({});
      setJourneyStep('answering');

      if (nextQuestions.length === 0) {
        setFlowBlockMessage(
          'Aucune nouvelle question exploitable ne peut être proposée. Contactez le SAV ou démarrez une nouvelle analyse.'
        );
        return;
      }

      if (answersSent.length + nextQuestions.length > MAX_ANSWERS) {
        setQuestions([]);
        setFlowBlockMessage(
          'Le nombre maximal de réponses serait dépassé. Contactez le SAV ou démarrez une nouvelle analyse.'
        );
        return;
      }

      setFlowBlockMessage(null);
      return;
    }

    setQuestions([]);
    setQuestionMessage('');
    setAnswerDrafts({});
    setAnswerErrors({});
    setFlowBlockMessage(null);
    setResult(diagnostic);
    setJourneyStep('result');
  };

  const submitAnalysis = (answers: AiDiagnosticAnswer[]) => {
    if (
      isPending ||
      submissionLockRef.current ||
      selectedVehicleId === null
    ) {
      return;
    }

    submissionLockRef.current = true;
    setAnalysisError(null);
    analyzeDiagnostic.mutate(
      {
        vehicle_id: selectedVehicleId,
        description: description.trim(),
        answers,
        photo: selectedPhoto?.payload ?? null,
      },
      {
        onSuccess: (diagnostic) => {
          handleAnalysisSuccess(diagnostic, answers);
        },
        onError: (error) => {
          const message = getAnalysisErrorMessage(error);
          setAnalysisError(message);
          showToast({
            title: 'Analyse impossible',
            message,
            tone: 'error',
          });
        },
        onSettled: () => {
          submissionLockRef.current = false;
        },
      }
    );
  };

  const handleInitialSubmit = () => {
    if (isPending) {
      return;
    }

    const descriptionError = getDescriptionError(description);
    const nextErrors: InitialFormErrors = {};

    if (selectedVehicleId === null) {
      nextErrors.vehicle = 'Sélectionnez un véhicule.';
    }

    if (descriptionError) {
      nextErrors.description = descriptionError;
    }

    setInitialFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    submitAnalysis([]);
  };

  const handleAnswersSubmit = () => {
    if (isPending || questions.length === 0 || flowBlockMessage) {
      return;
    }

    const nextErrors: Record<string, string> = {};
    const newAnswers = questions.map((question, index) => {
      const key = getQuestionKey(question, index);
      const answer = composeAnswer(answerDrafts[key]);

      if (answer.length === 0) {
        nextErrors[key] = 'Cette réponse est obligatoire.';
      } else if (answer.length > MAX_ANSWER_LENGTH) {
        nextErrors[key] = `La réponse ne doit pas dépasser ${MAX_ANSWER_LENGTH} caractères.`;
      }

      return {
        question: question.text,
        answer,
      };
    });

    setAnswerErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (accumulatedAnswers.length + newAnswers.length > MAX_ANSWERS) {
      setFlowBlockMessage(
        'Le nombre maximal de réponses serait dépassé. Contactez le SAV ou démarrez une nouvelle analyse.'
      );
      return;
    }

    submitAnalysis([...accumulatedAnswers, ...newAnswers]);
  };

  if (vehiclesQuery.isLoading) {
    return (
      <ClientPortalLayout activeRoute="/ai-diagnostic">
        <View style={styles.stateContainer}>
          <LoadingState message="Chargement de vos véhicules..." />
        </View>
      </ClientPortalLayout>
    );
  }

  if (vehiclesQuery.isError) {
    return (
      <ClientPortalLayout activeRoute="/ai-diagnostic">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Erreur de chargement"
            message="Impossible de charger vos véhicules pour préparer le pré-diagnostic."
            onRetry={() => {
              vehiclesQuery.refetch();
            }}
          />
        </View>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout activeRoute="/ai-diagnostic">
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <View style={[styles.hero, isNarrow && styles.heroNarrow]}>
          <ExpoImage
            accessible={false}
            contentFit="cover"
            contentPosition={isNarrow ? 'bottom center' : 'center'}
            source={
              isNarrow
                ? require('@/assets/ai/smeia-ai-hero-mobile.webp')
                : require('@/assets/ai/smeia-ai-hero-desktop.webp')
            }
            style={styles.heroBackdrop}
          />
          <View
            pointerEvents="none"
            style={[
              styles.heroBackdropShade,
              isNarrow && styles.heroBackdropShadeNarrow,
            ]}
          />
          <View pointerEvents="none" style={styles.heroHaloLarge} />
          <View pointerEvents="none" style={styles.heroHaloSmall} />
          <View pointerEvents="none" style={styles.heroRoadLine} />

          <View style={[styles.heroCopy, isNarrow && styles.heroCopyNarrow]}>
            <Text style={styles.heroEyebrow}>SMEIA INTELLIGENCE STUDIO</Text>
            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeText}>
                IA sécurisée • Analyse multimodale
              </Text>
            </View>
            <Text style={styles.heroTitle}>Assistant IA SAV</Text>
            <Text style={styles.heroSubtitle}>
              Votre copilote intelligent pour une première orientation
              automobile
            </Text>
            <Text style={styles.heroClient}>Espace de {clientName}</Text>
            <View style={styles.heroNotice}>
              <Text style={styles.heroNoticeText}>
                Orientation indicative — validation par un professionnel SMEIA
              </Text>
            </View>
          </View>

          <View pointerEvents="none" style={styles.heroOrb}>
            <IntelligenceOrb size={isNarrow ? 104 : 136} />
          </View>
        </View>

        {isBookingMode && bookingPreparation === null ? (
          <BookingPreparationChooser
            fromAppointments={bookingSource === 'appointments'}
            isNarrow={isNarrow}
            onManual={() => {
              resetJourney();
              setBookingPreparation('manual');
            }}
            onOrientation={() => {
              resetJourney();
              setBookingPreparation('orientation');
            }}
          />
        ) : isBookingMode && bookingPreparation === 'manual' ? (
          <ManualBookingJourney
            contacts={bookingContacts}
            isNarrow={isNarrow}
            isServiceTypesError={serviceTypesQuery.isError}
            isServiceTypesLoading={serviceTypesQuery.isLoading}
            isWorkshopsError={workshopsQuery.isError}
            isWorkshopsLoading={workshopsQuery.isLoading}
            onChangeJourney={changeBookingJourney}
            serviceTypes={serviceTypesQuery.data ?? []}
            vehicles={vehicles}
            workshops={workshopsQuery.data ?? []}
          />
        ) : (
          <>
            <AiJourneyProgress
              compact={isNarrow}
              currentStep={progressStep}
              isAnalyzing={isPending}
            />

            <View style={[styles.workflowGrid, isNarrow && styles.stack]}>
          <View
            style={[
              styles.mainPanel,
              journeyStep === 'result' && styles.mainPanelFull,
              isNarrow && styles.panelNarrow,
            ]}
          >
            {journeyStep === 'initial' ? (
              <InitialStep
                description={description}
                errors={initialFormErrors}
                isPending={isPending}
                onPhotoRemove={handlePhotoRemoval}
                onPhotoSelect={handlePhotoSelection}
                onDescriptionBlur={() => {
                  const error = getDescriptionError(description);
                  setInitialFormErrors((current) => ({
                    ...current,
                    description: error ?? undefined,
                  }));
                }}
                onDescriptionChange={(value) => {
                  setDescription(value);
                  setInitialFormErrors((current) => ({
                    ...current,
                    description: undefined,
                  }));
                  setAnalysisError(null);
                }}
                onSubmit={handleInitialSubmit}
                onVehicleSelect={(vehicleId) => {
                  setSelectedVehicleId(vehicleId);
                  setInitialFormErrors((current) => ({
                    ...current,
                    vehicle: undefined,
                  }));
                  setAnalysisError(null);
                }}
                selectedVehicleId={selectedVehicleId}
                photoError={photoError}
                selectedPhoto={selectedPhoto}
                vehicles={vehicles}
              />
            ) : null}

            {journeyStep === 'answering' ? (
              <QuestionsStep
                accumulatedAnswerCount={accumulatedAnswers.length}
                answerDrafts={answerDrafts}
                answerErrors={answerErrors}
                blockMessage={flowBlockMessage}
                isPending={isPending}
                message={questionMessage}
                onDraftChange={(key, change) => {
                  setAnswerDrafts((current) => {
                    const currentDraft = current[key] ?? {
                      selectedOption: '',
                      freeText: '',
                    };

                    return {
                      ...current,
                      [key]: {
                        ...currentDraft,
                        ...change,
                      },
                    };
                  });
                  setAnswerErrors((current) => ({
                    ...current,
                    [key]: '',
                  }));
                  setAnalysisError(null);
                }}
                onReset={resetJourney}
                onSubmit={handleAnswersSubmit}
                questions={questions}
              />
            ) : null}

            {journeyStep === 'result' && result ? (
              <DiagnosticResultPanel
                contacts={bookingContacts}
                isNarrow={isNarrow}
                showBooking={isBookingMode || bookingRequested}
                isServiceTypesLoading={serviceTypesQuery.isLoading}
                isWorkshopsLoading={workshopsQuery.isLoading}
                onChangeJourney={changeBookingJourney}
                onReset={resetJourney}
                onStartBooking={() => {
                  setBookingRequested(true);
                }}
                photo={selectedPhoto}
                result={result}
                selectedVehicle={selectedVehicle}
                serviceTypes={serviceTypesQuery.data ?? []}
                workshops={workshopsQuery.data ?? []}
              />
            ) : null}

            {analysisError ? (
              <ControlledErrorPanel
                message={analysisError}
                title="Analyse impossible"
              />
            ) : null}
          </View>

          {journeyStep !== 'result' ? (
            <View style={[styles.sidePanel, isNarrow && styles.panelNarrow]}>
              <JourneyAside
                accumulatedAnswerCount={accumulatedAnswers.length}
                isPending={isPending}
                journeyStep={journeyStep}
                selectedVehicle={selectedVehicle}
              />
            </View>
          ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </ClientPortalLayout>
  );
}

function BookingPreparationChooser({
  fromAppointments,
  isNarrow,
  onManual,
  onOrientation,
}: {
  fromAppointments: boolean;
  isNarrow: boolean;
  onManual: () => void;
  onOrientation: () => void;
}) {
  return (
    <View style={[styles.bookingWelcome, isNarrow && styles.bookingShellNarrow]}>
      <Text style={styles.bookingKicker}>
        {fromAppointments ? 'RÉSERVATION GUIDÉE' : 'ASSISTANT SMEIA'}
      </Text>
      <Text style={styles.bookingWelcomeTitle}>
        Comment souhaitez-vous préparer votre rendez-vous ?
      </Text>
      <View style={[styles.bookingWelcomeGrid, isNarrow && styles.stack]}>
        <PreparationCard
          description="L’Assistant IA analyse votre besoin et recommande une prestation et un atelier."
          title="J’ai besoin d’une orientation"
          onPress={onOrientation}
        />
        <PreparationCard
          description="Choisissez directement votre prestation et un atelier compatible."
          title="Je connais déjà mon besoin"
          onPress={onManual}
        />
      </View>
    </View>
  );
}

function PreparationCard({
  description,
  title,
  onPress,
}: {
  description: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.bookingWelcomeCard,
        hovered && styles.bookingWelcomeCardHovered,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.bookingWelcomeCardMark}>
        <Text style={styles.bookingWelcomeCardMarkText}>S</Text>
      </View>
      <Text style={styles.bookingWelcomeCardTitle}>{title}</Text>
      <Text style={styles.bookingWelcomeCardText}>{description}</Text>
      <Text style={styles.bookingWelcomeCardLink}>Continuer →</Text>
    </Pressable>
  );
}

function ManualBookingJourney({
  contacts,
  isNarrow,
  isServiceTypesError,
  isServiceTypesLoading,
  isWorkshopsError,
  isWorkshopsLoading,
  onChangeJourney,
  serviceTypes,
  vehicles,
  workshops,
}: {
  contacts: BookingContactDetails;
  isNarrow: boolean;
  isServiceTypesError: boolean;
  isServiceTypesLoading: boolean;
  isWorkshopsError: boolean;
  isWorkshopsLoading: boolean;
  onChangeJourney: () => void;
  serviceTypes: readonly DictionaryItem[];
  vehicles: readonly VehicleListItem[];
  workshops: readonly Workshop[];
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<ManualBookingNeed | null>(null);
  const [quoteChoice, setQuoteChoice] =
    useState<ManualQuoteChoice | null>(null);
  const [precision, setPrecision] = useState('');
  const [submittedContext, setSubmittedContext] =
    useState<AiBookingContext | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const expectedServiceTypeId = getManualServiceTypeId(
    selectedNeed,
    quoteChoice
  );
  const selectedServiceType =
    expectedServiceTypeId === null
      ? null
      : serviceTypes.find((service) => service.id === expectedServiceTypeId) ??
        null;
  const selectedNeedLabel =
    MANUAL_BOOKING_NEEDS.find((need) => need.value === selectedNeed)?.label ??
    null;
  const compatibleWorkshopIds = useMemo(
    () =>
      getCompatibleWorkshopIds(selectedServiceType?.qualification_code)
        .filter(isAiBookingWorkshopId)
        .filter((workshopId) =>
          workshops.some((workshop) => workshop.id === workshopId)
        ),
    [selectedServiceType?.qualification_code, workshops]
  );
  const compatibleWorkshops = compatibleWorkshopIds
    .map((workshopId) =>
      workshops.find((workshop) => workshop.id === workshopId)
    )
    .filter((workshop): workshop is Workshop => workshop !== undefined);
  const requiresQuoteChoice =
    selectedNeed !== null && selectedNeed !== 'diagnostic';
  const catalogIsPending = isServiceTypesLoading || isWorkshopsLoading;
  const catalogHasError = isServiceTypesError || isWorkshopsError;
  const expectedServiceIsMissing =
    expectedServiceTypeId !== null &&
    !catalogIsPending &&
    !catalogHasError &&
    selectedServiceType === null;
  const compatibleWorkshopsAreMissing =
    selectedServiceType !== null &&
    !catalogIsPending &&
    !catalogHasError &&
    compatibleWorkshopIds.length === 0;

  const invalidateBooking = () => {
    setSubmittedContext(null);
    setFormError(null);
  };

  const handleContinue = () => {
    if (!selectedVehicle) {
      setFormError('Sélectionnez le véhicule concerné.');
      return;
    }

    if (!selectedNeed) {
      setFormError('Sélectionnez votre besoin.');
      return;
    }

    if (requiresQuoteChoice && quoteChoice === null) {
      setFormError('Indiquez si vous disposez déjà d’un devis SMEIA validé.');
      return;
    }

    if (precision.length > 0 && precision.trim().length === 0) {
      setFormError('La précision ne peut pas contenir uniquement des espaces.');
      return;
    }

    if (precision.length > 800) {
      setFormError('La précision ne doit pas dépasser 800 caractères.');
      return;
    }

    if (expectedServiceTypeId === null || !selectedServiceType) {
      setFormError(
        'La prestation SMEIA attendue n’est pas disponible. Réessayez plus tard.'
      );
      return;
    }

    if (compatibleWorkshopIds.length === 0) {
      setFormError(
        'Aucun atelier compatible n’est configuré pour cette prestation.'
      );
      return;
    }

    const problemSummary = buildManualProblemSummary(
      expectedServiceTypeId,
      precision
    );

    if (problemSummary.length < 10 || problemSummary.length > 1_000) {
      setFormError(
        'Le résumé de la demande ne respecte pas le format attendu. Modifiez la précision.'
      );
      return;
    }

    setFormError(null);
    setSubmittedContext({
      problemSummary,
      serviceTypeId: expectedServiceTypeId,
      serviceTypeName: selectedServiceType.name,
      workshopCardLabel: 'Atelier compatible',
      workshopIds: compatibleWorkshopIds,
      workshopSelectionDescription:
        'Seuls les ateliers compatibles avec la prestation déterminée sont proposés.',
    });
  };

  return (
    <View style={styles.manualJourney}>
      <View style={[styles.mainPanel, styles.mainPanelFull, isNarrow && styles.panelNarrow]}>
        <SectionIntro
          kicker="RÉSERVATION SANS ANALYSE IA"
          title="Préparez votre demande"
          text="Renseignez votre besoin. Les prestations et ateliers proposés proviennent des catalogues SMEIA."
        />

        <View style={styles.formSection}>
          <Text style={styles.bookingFieldLabel}>Véhicule obligatoire</Text>
          {vehicles.length > 0 ? (
            <View style={styles.optionGrid}>
              {vehicles.map((vehicle) => (
                <SelectableVehicleCard
                  key={vehicle.id}
                  active={vehicle.id === selectedVehicleId}
                  disabled={false}
                  vehicle={vehicle}
                  onPress={() => {
                    if (vehicle.id !== selectedVehicleId) {
                      invalidateBooking();
                      setSelectedVehicleId(vehicle.id);
                      setSelectedNeed(null);
                      setQuoteChoice(null);
                      setPrecision('');
                    }
                  }}
                />
              ))}
            </View>
          ) : (
            <EmptyPanel
              title="Aucun véhicule trouvé"
              text="Aucun véhicule n’est lié à votre profil client."
            />
          )}
        </View>

        {selectedVehicle ? (
          <View style={styles.formSection}>
            <SectionIntro
              kicker="BESOIN"
              title="Quel est votre besoin ?"
              text="Choisissez la situation qui correspond à votre demande."
            />
            <View style={styles.manualNeedGrid}>
              {MANUAL_BOOKING_NEEDS.map((need) => {
                const selected = need.value === selectedNeed;

                return (
                  <Pressable
                    key={need.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      if (need.value !== selectedNeed) {
                        invalidateBooking();
                        setSelectedNeed(need.value);
                        setQuoteChoice(null);
                        setPrecision('');
                      }
                    }}
                    style={({ hovered, pressed }) => [
                      styles.manualNeedCard,
                      isNarrow && styles.bookingCardNarrow,
                      selected && styles.bookingWorkshopCardSelected,
                      hovered && styles.bookingWorkshopCardHovered,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.bookingSelectionDot,
                        selected && styles.bookingSelectionDotSelected,
                      ]}
                    />
                    <Text style={styles.bookingWorkshopName}>{need.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {requiresQuoteChoice ? (
          <View style={styles.formSection}>
            <Text style={styles.bookingSectionTitle}>
              Avez-vous déjà un devis SMEIA validé pour cette intervention ?
            </Text>
            <View style={styles.bookingModeRow}>
              <BookingChoiceButton
                disabled={false}
                label="Non, je souhaite faire établir un devis"
                onPress={() => {
                  if (quoteChoice !== 'without_quote') {
                    invalidateBooking();
                    setQuoteChoice('without_quote');
                  }
                }}
                selected={quoteChoice === 'without_quote'}
              />
              <BookingChoiceButton
                disabled={false}
                label="Oui, j’ai déjà un devis SMEIA validé"
                onPress={() => {
                  if (quoteChoice !== 'with_quote') {
                    invalidateBooking();
                    setQuoteChoice('with_quote');
                  }
                }}
                selected={quoteChoice === 'with_quote'}
              />
            </View>
          </View>
        ) : null}

        {expectedServiceTypeId !== null ? (
          <View style={styles.formSection}>
            <Text style={styles.bookingFieldLabel}>Orientation de la demande</Text>
            {catalogIsPending ? (
              <LoadingState message="Chargement des prestations SMEIA…" />
            ) : catalogHasError ? (
              <ControlledErrorPanel
                message="Les catalogues SMEIA sont temporairement indisponibles."
                title="Réservation indisponible"
              />
            ) : expectedServiceIsMissing ? (
              <ControlledErrorPanel
                message="La prestation SMEIA attendue n’est pas disponible dans le catalogue chargé."
                title="Configuration indisponible"
              />
            ) : compatibleWorkshopsAreMissing ? (
              <ControlledErrorPanel
                message="Aucun atelier compatible n’est configuré pour cette prestation."
                title="Configuration indisponible"
              />
            ) : selectedServiceType && selectedNeedLabel ? (
              <View style={styles.manualSelectionSummary}>
                <BookingSummaryItem
                  label="Besoin sélectionné"
                  value={selectedNeedLabel}
                />
                <BookingSummaryItem
                  label="Prestation SMEIA déterminée automatiquement"
                  value={selectedServiceType.name}
                />
                <BookingSummaryItem
                  label={
                    compatibleWorkshops.length === 1
                      ? 'Atelier compatible'
                      : 'Ateliers compatibles'
                  }
                  value={compatibleWorkshops
                    .map((workshop) => workshop.name)
                    .join(' • ')}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {selectedServiceType && compatibleWorkshopIds.length > 0 ? (
          <View style={styles.formSection}>
            <Text style={styles.bookingFieldLabel}>
              Ajouter une précision — facultatif
            </Text>
            <TextInput
              accessibilityLabel="Ajouter une précision facultative"
              maxLength={800}
              multiline
              numberOfLines={5}
              onChangeText={(value) => {
                invalidateBooking();
                setPrecision(value);
              }}
              placeholder="Exemple : le voyant est apparu hier ou la rayure se trouve sur la porte avant."
              placeholderTextColor="#7892AA"
              style={[styles.input, styles.problemInput]}
              textAlignVertical="top"
              value={precision}
            />
            <View style={styles.inputMetaRow}>
              <Text style={styles.fieldHint}>Champ facultatif</Text>
              <Text style={styles.characterCount}>{precision.length}/800</Text>
            </View>
          </View>
        ) : null}

        {formError ? (
          <ControlledErrorPanel message={formError} title="Demande incomplète" />
        ) : null}

        {selectedServiceType && compatibleWorkshopIds.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            disabled={catalogIsPending || catalogHasError}
            onPress={handleContinue}
            style={({ hovered, pressed }) => [
              styles.bookingPrimaryAction,
              hovered && !catalogIsPending && !catalogHasError &&
                styles.bookingPrimaryActionHovered,
              pressed && styles.pressed,
              (catalogIsPending || catalogHasError) && styles.disabled,
            ]}
          >
            <Text style={styles.bookingPrimaryActionText}>
              Continuer vers les ateliers compatibles
            </Text>
          </Pressable>
        ) : null}

        {!submittedContext ? (
          <BookingResetButton disabled={false} onReset={onChangeJourney} />
        ) : null}
      </View>

      {submittedContext && selectedVehicle ? (
        <AiBookingPanel
          contacts={contacts}
          context={submittedContext}
          isNarrow={isNarrow}
          onChangeJourney={onChangeJourney}
          selectedVehicle={selectedVehicle}
          workshops={workshops}
        />
      ) : null}
    </View>
  );
}

type InitialStepProps = {
  description: string;
  errors: InitialFormErrors;
  isPending: boolean;
  onDescriptionBlur: () => void;
  onDescriptionChange: (value: string) => void;
  onPhotoRemove: () => void;
  onPhotoSelect: () => void;
  onSubmit: () => void;
  onVehicleSelect: (vehicleId: number) => void;
  photoError: string | null;
  selectedPhoto: SelectedAiPhoto | null;
  selectedVehicleId: number | null;
  vehicles: VehicleListItem[];
};

function InitialStep({
  description,
  errors,
  isPending,
  onDescriptionBlur,
  onDescriptionChange,
  onPhotoRemove,
  onPhotoSelect,
  onSubmit,
  onVehicleSelect,
  photoError,
  selectedPhoto,
  selectedVehicleId,
  vehicles,
}: InitialStepProps) {
  return (
    <>
      <SectionIntro
        kicker="Étape 1"
        title="Véhicule concerné"
        text="Sélectionnez l'un des véhicules liés à votre compte client."
      />

      {vehicles.length > 0 ? (
        <View style={styles.optionGrid}>
          {vehicles.map((vehicle) => (
            <SelectableVehicleCard
              key={vehicle.id}
              active={vehicle.id === selectedVehicleId}
              disabled={isPending}
              vehicle={vehicle}
              onPress={() => {
                onVehicleSelect(vehicle.id);
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

      {errors.vehicle ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {errors.vehicle}
        </Text>
      ) : null}

      <View style={styles.formSection}>
        <SectionIntro
          kicker="Étape 2"
          title="Description du problème"
          text="Décrivez précisément le symptôme observé. Le résultat restera une orientation indicative."
        />

        <TextInput
          accessibilityLabel="Description du problème"
          editable={!isPending}
          maxLength={MAX_DESCRIPTION_LENGTH}
          multiline
          numberOfLines={5}
          onBlur={onDescriptionBlur}
          onChangeText={onDescriptionChange}
          placeholder="Exemple : bruit au freinage, voyant moteur, vibration à l'accélération..."
          placeholderTextColor="#7892AA"
          style={[
            styles.input,
            styles.problemInput,
            errors.description ? styles.inputError : null,
          ]}
          textAlignVertical="top"
          value={description}
        />
        <View style={styles.inputMetaRow}>
          {errors.description ? (
            <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
              {errors.description}
            </Text>
          ) : (
            <Text style={styles.fieldHint}>10 caractères minimum</Text>
          )}
          <Text style={styles.characterCount}>
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </Text>
        </View>
      </View>

      <OptionalPhotoField
        error={photoError}
        isPending={isPending}
        onRemove={onPhotoRemove}
        onSelect={onPhotoSelect}
        photo={selectedPhoto}
      />

      <View style={styles.privacyNote}>
        <View style={styles.privacyIcon}>
          <Text style={styles.privacyIconText}>S</Text>
        </View>
        <View style={styles.privacyCopy}>
          <Text style={styles.privacyTitle}>Analyse confidentielle</Text>
          <Text style={styles.privacyText}>
            Vos informations servent uniquement à préparer cette orientation
            dans votre session sécurisée SMEIA.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isPending || vehicles.length === 0}
        onPress={onSubmit}
        style={({ hovered, pressed }) => [
          styles.primaryAction,
          hovered && !isPending && styles.primaryActionHovered,
          pressed && !isPending && styles.pressed,
          (isPending || vehicles.length === 0) && styles.disabled,
        ]}
      >
        <Text style={styles.primaryActionText}>
          {isPending ? 'Analyse sécurisée en cours...' : "Lancer l'analyse IA"}
        </Text>
      </Pressable>
    </>
  );
}

type OptionalPhotoFieldProps = {
  error: string | null;
  isPending: boolean;
  onRemove: () => void;
  onSelect: () => void;
  photo: SelectedAiPhoto | null;
};

function OptionalPhotoField({
  error,
  isPending,
  onRemove,
  onSelect,
  photo,
}: OptionalPhotoFieldProps) {
  return (
    <View style={styles.photoSection}>
      <SectionIntro
        kicker="Pièce jointe"
        title="Photo facultative"
        text="Une photo du voyant, du tableau de bord ou de la zone endommagée peut aider l’assistant à mieux orienter votre demande."
      />

      {photo ? (
        <View style={styles.photoPreviewCard}>
          <Image
            accessibilityLabel="Aperçu de la photo sélectionnée"
            resizeMode="cover"
            source={{ uri: photo.previewUri }}
            style={styles.photoPreview}
          />
          <View style={styles.photoPreviewCopy}>
            <Text numberOfLines={1} style={styles.photoFileName}>
              {photo.fileName || 'Photo sélectionnée'}
            </Text>
            <Text style={styles.photoFileSize}>
              {formatPhotoSize(photo.sizeBytes)}
            </Text>
            <View style={styles.photoActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isPending}
                onPress={onSelect}
                style={({ hovered, pressed }) => [
                  styles.photoSecondaryAction,
                  hovered && !isPending && styles.photoActionHovered,
                  pressed && !isPending && styles.pressed,
                  isPending && styles.disabled,
                ]}
              >
                <Text style={styles.photoSecondaryActionText}>Remplacer</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isPending}
                onPress={onRemove}
                style={({ hovered, pressed }) => [
                  styles.photoRemoveAction,
                  hovered && !isPending && styles.photoRemoveActionHovered,
                  pressed && !isPending && styles.pressed,
                  isPending && styles.disabled,
                ]}
              >
                <Text style={styles.photoRemoveActionText}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityHint="Ouvre la photothèque de votre appareil"
          accessibilityRole="button"
          disabled={isPending}
          onPress={onSelect}
          style={({ hovered, pressed }) => [
            styles.photoDropZone,
            hovered && !isPending && styles.photoDropZoneHovered,
            pressed && !isPending && styles.pressed,
            isPending && styles.disabled,
          ]}
        >
          <View style={styles.photoGlyph}>
            <Text style={styles.photoGlyphText}>+</Text>
          </View>
          <View style={styles.photoDropCopy}>
            <Text style={styles.photoChooseText}>Choisir une photo</Text>
            <Text style={styles.photoOptionalText}>
              Vous pouvez continuer sans photo
            </Text>
            <Text style={styles.photoFormatsText}>
              JPEG, PNG ou WebP — 5 Mo maximum
            </Text>
          </View>
        </Pressable>
      )}

      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type QuestionsStepProps = {
  accumulatedAnswerCount: number;
  answerDrafts: Record<string, AnswerDraft>;
  answerErrors: Record<string, string>;
  blockMessage: string | null;
  isPending: boolean;
  message: string;
  onDraftChange: (key: string, change: Partial<AnswerDraft>) => void;
  onReset: () => void;
  onSubmit: () => void;
  questions: AiDiagnosticQuestion[];
};

function QuestionsStep({
  accumulatedAnswerCount,
  answerDrafts,
  answerErrors,
  blockMessage,
  isPending,
  message,
  onDraftChange,
  onReset,
  onSubmit,
  questions,
}: QuestionsStepProps) {
  const everyQuestionAnswered =
    questions.length > 0 &&
    questions.every((question, index) => {
      const key = getQuestionKey(question, index);

      return composeAnswer(answerDrafts[key]).length > 0;
    });
  const continueDisabled = isPending || !everyQuestionAnswered;

  return (
    <>
      <SectionIntro
        kicker="Questions complémentaires"
        title="Précisons votre demande"
        text={message}
      />

      {blockMessage ? (
        <ControlledErrorPanel
          message={blockMessage}
          title="Analyse à reprendre"
        />
      ) : (
        <View style={styles.questionsList}>
          {questions.map((question, index) => {
            const key = getQuestionKey(question, index);

            return (
              <DynamicQuestionField
                key={key}
                draft={
                  answerDrafts[key] ?? { selectedOption: '', freeText: '' }
                }
                disabled={isPending}
                error={answerErrors[key]}
                index={index}
                onFreeTextChange={(freeText) => {
                  onDraftChange(key, { freeText });
                }}
                onOptionChange={(selectedOption) => {
                  onDraftChange(key, { selectedOption });
                }}
                question={question}
              />
            );
          })}
        </View>
      )}

      <Text style={styles.answerCount}>
        Réponses déjà transmises : {accumulatedAnswerCount}/{MAX_ANSWERS}
      </Text>

      <View style={styles.actions}>
        {!blockMessage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: continueDisabled }}
            disabled={continueDisabled}
            onPress={onSubmit}
            style={({ hovered, pressed }) => [
              styles.primaryAction,
              hovered && !continueDisabled && styles.primaryActionHovered,
              pressed && !continueDisabled && styles.pressed,
              continueDisabled && styles.disabled,
            ]}
          >
            <Text style={styles.primaryActionText}>
              {isPending
                ? 'Analyse sécurisée en cours...'
                : "Continuer l'analyse"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isPending}
          onPress={onReset}
          style={({ hovered, pressed }) => [
            styles.secondaryAction,
            hovered && !isPending && styles.secondaryActionHovered,
            pressed && !isPending && styles.pressed,
            isPending && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryActionText}>Nouvelle analyse</Text>
        </Pressable>
      </View>
    </>
  );
}

type DynamicQuestionFieldProps = {
  draft: AnswerDraft;
  disabled: boolean;
  error?: string;
  index: number;
  onFreeTextChange: (freeText: string) => void;
  onOptionChange: (selectedOption: string) => void;
  question: AiDiagnosticQuestion;
};

function DynamicQuestionField({
  draft,
  disabled,
  error,
  index,
  onFreeTextChange,
  onOptionChange,
  question,
}: DynamicQuestionFieldProps) {
  const [isFreeTextFocused, setIsFreeTextFocused] = useState(false);
  const choices =
    question.answer_type === 'yes_no'
      ? ['Oui', 'Non']
      : question.answer_type === 'single_choice'
        ? question.options
        : [];

  return (
    <View style={styles.questionField}>
      <Text style={styles.questionNumber}>Question {index + 1}</Text>
      <Text style={styles.fieldLabel}>{question.text}</Text>

      {choices.length > 0 ? (
        <View style={styles.choiceList}>
          {choices.map((choice) => {
            const selected = draft.selectedOption === choice;

            return (
              <Pressable
                key={choice}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                onPress={() => {
                  onOptionChange(choice);
                }}
                style={({ hovered, pressed }) => [
                  styles.choiceButton,
                  selected && styles.choiceButtonSelected,
                  hovered && !disabled && styles.choiceButtonHovered,
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}
              >
                <Text
                  style={[
                    styles.choiceButtonText,
                    selected && styles.choiceButtonTextSelected,
                  ]}
                >
                  {choice}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.freeAnswerField}>
        <Text style={styles.freeAnswerLabel}>Autre réponse ou précision</Text>
        <TextInput
          accessibilityLabel={`Autre réponse ou précision pour : ${question.text}`}
          editable={!disabled}
          maxLength={MAX_ANSWER_LENGTH}
          multiline
          numberOfLines={4}
          onBlur={() => {
            setIsFreeTextFocused(false);
          }}
          onChangeText={onFreeTextChange}
          onFocus={() => {
            setIsFreeTextFocused(true);
          }}
          placeholder="Écrivez votre réponse avec vos propres mots…"
          placeholderTextColor="#7892AA"
          style={[
            styles.input,
            styles.answerInput,
            isFreeTextFocused ? styles.answerInputFocused : null,
            error ? styles.inputError : null,
          ]}
          textAlignVertical="top"
          value={draft.freeText}
        />

        <Text style={[styles.characterCount, styles.freeAnswerCounter]}>
          {draft.freeText.length}/{MAX_ANSWER_LENGTH}
        </Text>
      </View>

      <View style={styles.inputMetaRow}>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
            {error}
          </Text>
        ) : (
          <Text style={styles.fieldHint}>
            Sélectionnez une option ou saisissez une réponse libre
          </Text>
        )}
      </View>
    </View>
  );
}

type DiagnosticResultPanelProps = {
  contacts: BookingContactDetails;
  isNarrow: boolean;
  isServiceTypesLoading: boolean;
  isWorkshopsLoading: boolean;
  photo: SelectedAiPhoto | null;
  result: AiDiagnosticResult;
  selectedVehicle: VehicleListItem | null;
  showBooking: boolean;
  serviceTypes: readonly DictionaryItem[];
  workshops: readonly Workshop[];
  onChangeJourney: () => void;
  onReset: () => void;
  onStartBooking: () => void;
};

function DiagnosticResultPanel({
  contacts,
  isNarrow,
  isServiceTypesLoading,
  isWorkshopsLoading,
  photo,
  result,
  selectedVehicle,
  showBooking,
  serviceTypes,
  workshops,
  onChangeJourney,
  onReset,
  onStartBooking,
}: DiagnosticResultPanelProps) {
  if (result.diagnosis_status === 'out_of_scope') {
    return (
      <View style={styles.outOfScopeCard}>
        <View style={styles.outOfScopeOrb}>
          <IntelligenceOrb size={104} />
        </View>
        <View style={styles.outOfScopeCopy}>
          <View style={styles.resultStatusBadgeMuted}>
            <Text style={styles.resultStatusBadgeMutedText}>
              DEMANDE HORS PÉRIMÈTRE
            </Text>
          </View>
          <Text style={styles.outOfScopeTitle}>
            Une autre prise en charge est recommandée
          </Text>
          <Text style={styles.outOfScopeText}>{result.client_message}</Text>
        </View>
        <VisualAnalysisCard photo={photo} result={result} />
        <OptionalPhotoSuggestion result={result} />
        <Pressable
          accessibilityRole="button"
          onPress={onReset}
          style={({ hovered, pressed }) => [
            styles.primaryAction,
            hovered && styles.primaryActionHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryActionText}>Nouvelle analyse</Text>
        </Pressable>
      </View>
    );
  }

  const requiresStrongWarning =
    result.urgency_level === 'critical' ||
    result.driving_advice === 'do_not_drive';
  const serviceTypeName = getServiceTypeName(
    result.suggested_service_type_id,
    serviceTypes
  );
  const workshopNames = getWorkshopDisplayNames(
    result.suggested_workshop_ids,
    workshops
  );
  const urgencyTone: ResultMetricTone =
    result.urgency_level === 'low'
      ? 'calm'
      : result.urgency_level === 'medium'
        ? 'warning'
        : 'danger';
  const drivingTone: ResultMetricTone =
    result.driving_advice === 'normal'
      ? 'calm'
      : result.driving_advice === 'caution'
        ? 'warning'
        : 'danger';
  const confidenceTone: ResultMetricTone =
    result.confidence === 'high'
      ? 'calm'
      : result.confidence === 'medium'
        ? 'neutral'
        : 'warning';

  return (
    <>
      <View style={styles.resultHeroCard}>
        <View style={styles.resultHeroCopy}>
          <View style={styles.resultStatusBadge}>
            <View style={styles.resultStatusDot} />
            <Text style={styles.resultStatusBadgeText}>ORIENTATION PRÊTE</Text>
          </View>
          <Text style={styles.resultHeroTitle}>Première orientation SMEIA</Text>
          <Text style={styles.resultHeroMessage}>{result.client_message}</Text>
        </View>
        <IntelligenceOrb size={112} />
      </View>

      <View style={styles.resultColumns}>
        <View style={styles.resultPrimaryColumn}>
          <View style={styles.summaryCard}>
            <Text style={styles.resultKicker}>SYNTHÈSE DU SYMPTÔME</Text>
            <Text style={styles.summaryTitle}>Résumé du problème</Text>
            <Text style={styles.summaryText}>{result.problem_summary}</Text>
          </View>

          <VisualAnalysisCard photo={photo} result={result} />

          <View style={styles.resultGrid}>
            <ResultMetric
              label="Niveau d'urgence"
              tone={urgencyTone}
              value={urgencyLabels[result.urgency_level]}
            />
            <ResultMetric
              label="Conseil de conduite"
              tone={drivingTone}
              value={drivingAdviceLabels[result.driving_advice]}
            />
            <ResultMetric
              label="Confiance de l’orientation"
              tone={confidenceTone}
              value={confidenceLabels[result.confidence]}
            />
          </View>

          {result.safety_message ? (
            <View
              style={[
                styles.safetyBox,
                requiresStrongWarning && styles.safetyBoxCritical,
              ]}
            >
              <View
                style={[
                  styles.safetyIcon,
                  requiresStrongWarning && styles.safetyIconCritical,
                ]}
              >
                <Text
                  style={[
                    styles.safetyIconText,
                    requiresStrongWarning && styles.safetyIconTextCritical,
                  ]}
                >
                  !
                </Text>
              </View>
              <View style={styles.safetyCopy}>
                <Text
                  style={[
                    styles.safetyTitle,
                    requiresStrongWarning && styles.safetyTitleCritical,
                  ]}
                >
                  Consigne de sécurité
                </Text>
                <Text
                  style={[
                    styles.safetyText,
                    requiresStrongWarning && styles.safetyTextCritical,
                  ]}
                >
                  {result.safety_message}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.recommendationBox}>
            <View style={styles.recommendationHeader}>
              <View>
                <Text style={styles.resultKicker}>ORIENTATION ATELIER</Text>
                <Text style={styles.recommendationTitle}>
                  Recommandation SMEIA
                </Text>
              </View>
              <View style={styles.recommendationMark}>
                <Text style={styles.recommendationMarkText}>S</Text>
              </View>
            </View>

            {isServiceTypesLoading ? (
              <View style={styles.catalogSkeleton}>
                <View style={styles.catalogSkeletonLineWide} />
                <View style={styles.catalogSkeletonLineShort} />
              </View>
            ) : (
              <View style={styles.serviceRecommendationCard}>
                <View style={styles.recommendationIcon}>
                  <Text style={styles.recommendationIconText}>S</Text>
                </View>
                <View style={styles.recommendationCardCopy}>
                  <Text style={styles.recommendationCardLabel}>
                    Service recommandé
                  </Text>
                  <Text style={styles.recommendationCardName}>
                    {serviceTypeName}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.workshopsTitle}>Ateliers proposés</Text>
            {isWorkshopsLoading ? (
              <View style={styles.workshopGrid}>
                <View style={styles.workshopSkeleton} />
                <View style={styles.workshopSkeleton} />
              </View>
            ) : workshopNames.length > 0 ? (
              <View style={styles.workshopGrid}>
                {workshopNames.map((workshopName, index) => (
                  <View
                    key={`${workshopName}:${index}`}
                    style={styles.workshopCard}
                  >
                    <View style={styles.workshopIndex}>
                      <Text style={styles.workshopIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.workshopName}>{workshopName}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.catalogUnavailableText}>
                Aucun atelier proposé
              </Text>
            )}
          </View>
        </View>

        <View style={styles.resultSecondaryColumn}>
          <View style={styles.savBox}>
            <View style={styles.savHeader}>
              <View style={styles.savIcon}>
                <Text style={styles.savIconText}>SAV</Text>
              </View>
              <View style={styles.savHeaderCopy}>
                <Text style={styles.resultKicker}>CONTINUITÉ DE SERVICE</Text>
                <Text style={styles.savTitle}>Résumé transmis au SAV</Text>
              </View>
            </View>
            <Text style={styles.savText}>{result.sav_notes}</Text>
          </View>

          <OptionalPhotoSuggestion result={result} />

          <View style={styles.professionalNotice}>
            <Text style={styles.professionalNoticeTitle}>
              Contrôle professionnel requis
            </Text>
            <Text style={styles.professionalNoticeText}>
              Cette orientation ne remplace pas le contrôle d’un professionnel.
            </Text>
          </View>
        </View>
      </View>

      {result.diagnosis_status === 'ready' &&
      selectedVehicle &&
      showBooking &&
      result.suggested_service_type_id !== null ? (
        <AiBookingPanel
          contacts={contacts}
          context={{
            problemSummary: result.problem_summary,
            serviceTypeId: result.suggested_service_type_id,
            serviceTypeName,
            workshopCardLabel: 'Atelier recommandé',
            workshopIds: result.suggested_workshop_ids,
            workshopSelectionDescription:
              'Seuls les ateliers recommandés par l’orientation IA sont proposés.',
          }}
          isNarrow={isNarrow}
          onChangeJourney={onChangeJourney}
          selectedVehicle={selectedVehicle}
          workshops={workshops}
        />
      ) : null}

      {result.diagnosis_status === 'ready' &&
      selectedVehicle &&
      showBooking &&
      result.suggested_service_type_id === null ? (
        <View style={styles.bookingShell}>
          <ControlledErrorPanel
            message="Aucun service réservable n’a été proposé par cette orientation."
            title="Réservation indisponible"
          />
          <BookingResetButton disabled={false} onReset={onChangeJourney} />
        </View>
      ) : null}

      {result.diagnosis_status === 'ready' &&
      selectedVehicle &&
      !showBooking ? (
        <Pressable
          accessibilityRole="button"
          onPress={onStartBooking}
          style={({ hovered, pressed }) => [
            styles.bookingPrimaryAction,
            hovered && styles.bookingPrimaryActionHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.bookingPrimaryActionText}>
            Prendre rendez-vous avec cette orientation
          </Text>
        </Pressable>
      ) : null}

      {!selectedVehicle ? (
        <Pressable
          accessibilityRole="button"
          onPress={onReset}
          style={({ hovered, pressed }) => [
            styles.primaryAction,
            hovered && styles.primaryActionHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryActionText}>Nouvelle analyse</Text>
        </Pressable>
      ) : null}
    </>
  );
}

type AiBookingPanelProps = {
  contacts: BookingContactDetails;
  context: AiBookingContext;
  isNarrow: boolean;
  onChangeJourney: () => void;
  selectedVehicle: VehicleListItem;
  workshops: readonly Workshop[];
};

type BookingOptionGroup = {
  options: AiBookingAvailabilityOption[];
  showroomName: string;
  workshopId: AiDiagnosticWorkshopId;
  workshopName: string;
};

function groupBookingOptionsByWorkshop(
  options: readonly AiBookingAvailabilityOption[]
): BookingOptionGroup[] {
  const groups = new Map<AiDiagnosticWorkshopId, BookingOptionGroup>();

  for (const option of options) {
    const group = groups.get(option.workshop_id);

    if (group) {
      group.options.push(option);
      continue;
    }

    groups.set(option.workshop_id, {
      options: [option],
      showroomName: option.showroom.name,
      workshopId: option.workshop_id,
      workshopName: option.workshop_name,
    });
  }

  return [...groups.values()];
}

function AiBookingPanel({
  contacts,
  context,
  isNarrow,
  onChangeJourney,
  selectedVehicle,
  workshops,
}: AiBookingPanelProps) {
  const availabilityMutation = useSearchAiAppointmentAvailability();
  const confirmationMutation = useConfirmAiAppointment();
  const availabilityLockRef = useRef(false);
  const confirmationLockRef = useRef(false);
  const idempotencyAttemptRef = useRef<BookingIdempotencyAttempt | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] =
    useState<AiDiagnosticWorkshopId | null>(null);
  const [dateMode, setDateMode] = useState<BookingDateMode>('earliest');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredPeriod, setPreferredPeriod] =
    useState<AiBookingPreferredPeriod>('any');
  const [availability, setAvailability] =
    useState<AiBookingAvailabilityResult | null>(null);
  const [suggestionAvailability, setSuggestionAvailability] =
    useState<AiBookingAvailabilityResult | null>(null);
  const [availabilityView, setAvailabilityView] =
    useState<BookingAvailabilityView>('suggestions');
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [dayPickerDate, setDayPickerDate] = useState('');
  const [dayPickerPeriod, setDayPickerPeriod] =
    useState<AiBookingPreferredPeriod>('any');
  const [daySlotsDate, setDaySlotsDate] = useState<string | null>(null);
  const [daySlotsPeriod, setDaySlotsPeriod] =
    useState<AiBookingPreferredPeriod>('any');
  const [selectedOption, setSelectedOption] =
    useState<AiBookingAvailabilityOption | null>(null);
  const [bookingSuccess, setBookingSuccess] =
    useState<AiBookingConfirmationResult | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [canSearchAllDay, setCanSearchAllDay] = useState(false);
  const [lastSearchPreferredDate, setLastSearchPreferredDate] =
    useState<string | null>(null);
  const [expirationNow, setExpirationNow] = useState(() => Date.now());
  const minimumDate = getCasablancaTodayIso();
  const maximumDate = getBookingWindowEndIso(minimumDate);
  const serviceTypeId = context.serviceTypeId;
  const recommendedWorkshops = useMemo(
    () =>
      context.workshopIds.map((workshopId) => ({
        id: workshopId,
        name:
          workshops.find((workshop) => workshop.id === workshopId)?.name.trim() ||
          "Nom de l'atelier indisponible",
      })),
    [context.workshopIds, workshops]
  );
  const hasReachedSlotSelection =
    availability !== null ||
    (availabilityView === 'day_slots' && !showDayPicker);
  const bookingStep: 1 | 2 | 3 | 4 = selectedOption
    ? 4
    : hasReachedSlotSelection
      ? 3
      : selectedWorkshopId
        ? 2
        : 1;
  const isBookingPending =
    availabilityMutation.isPending || confirmationMutation.isPending;
  const selectedOptionExpired = selectedOption
    ? isBookingOptionExpired(selectedOption.expires_at, expirationNow)
    : false;
  const suggestionTargetDate = useMemo(() => {
    const firstSuggestionDate =
      suggestionAvailability?.options[0]?.requested_date ?? null;

    if (
      lastSearchPreferredDate !== null &&
      suggestionAvailability?.preferred_date_available
    ) {
      return lastSearchPreferredDate;
    }

    return firstSuggestionDate;
  }, [lastSearchPreferredDate, suggestionAvailability]);
  const daySlotGroups = useMemo(
    () =>
      availabilityView === 'day_slots' && availability
        ? groupBookingOptionsByWorkshop(availability.options)
        : [],
    [availability, availabilityView]
  );

  useEffect(() => {
    if (!availability && !suggestionAvailability && !selectedOption) {
      return;
    }

    const now = Date.now();
    const nextExpiration = [
      ...(availability?.options ?? []),
      ...(suggestionAvailability?.options ?? []),
      ...(selectedOption ? [selectedOption] : []),
    ]
      .map((option) => Date.parse(option.expires_at))
      .filter((expiration) => Number.isFinite(expiration) && expiration > now)
      .sort((left, right) => left - right)[0];

    if (nextExpiration === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      setExpirationNow(Date.now());
    }, Math.max(0, nextExpiration - now) + 50);

    return () => {
      clearTimeout(timeout);
    };
  }, [availability, expirationNow, selectedOption, suggestionAvailability]);

  const clearSelectedOffer = () => {
    setSelectedOption(null);
    idempotencyAttemptRef.current = null;
    confirmationMutation.reset();
  };

  const clearAvailability = () => {
    setAvailability(null);
    setSuggestionAvailability(null);
    setAvailabilityView('suggestions');
    setShowDayPicker(false);
    setDayPickerDate('');
    setDayPickerPeriod('any');
    setDaySlotsDate(null);
    setDaySlotsPeriod('any');
    setLastSearchPreferredDate(null);
    setCanSearchAllDay(false);
    clearSelectedOffer();
    availabilityMutation.reset();
  };

  const handleWorkshopSelection = (workshopId: AiDiagnosticWorkshopId) => {
    if (isBookingPending) {
      return;
    }

    if (workshopId !== selectedWorkshopId) {
      clearAvailability();
      setBookingError(null);
      setPreferenceError(null);
      setSelectedWorkshopId(workshopId);
    }
  };

  const handleDateModeChange = (nextMode: BookingDateMode) => {
    if (isBookingPending || nextMode === dateMode) {
      return;
    }

    clearAvailability();
    setBookingError(null);
    setPreferenceError(null);
    setDateMode(nextMode);
  };

  const handlePreferredDateSelection = (value: string) => {
    if (isBookingPending) {
      return;
    }

    clearAvailability();
    setBookingError(null);
    setPreferenceError(null);
    setPreferredDate(value);
  };

  const handlePeriodChange = (period: AiBookingPreferredPeriod) => {
    if (isBookingPending || period === preferredPeriod) {
      return;
    }

    clearAvailability();
    setBookingError(null);
    setPreferenceError(null);
    setPreferredPeriod(period);
  };

  const performAvailabilitySearch = (
    resultMode: AiBookingResultMode,
    requestedDate: string | null,
    requestedPeriod: AiBookingPreferredPeriod
  ) => {
    if (
      availabilityLockRef.current ||
      availabilityMutation.isPending ||
      confirmationMutation.isPending ||
      selectedWorkshopId === null
    ) {
      return;
    }

    if (
      (resultMode === 'day_slots' && requestedDate === null) ||
      (requestedDate !== null &&
        !isValidBookingDate(requestedDate, minimumDate, maximumDate))
    ) {
      setPreferenceError('Sélectionnez une date valide dans le calendrier.');
      return;
    }

    availabilityLockRef.current = true;
    setPreferenceError(null);
    setBookingError(null);
    setAvailability(null);
    clearSelectedOffer();
    setBookingSuccess(null);
    setCanSearchAllDay(false);
    setShowDayPicker(false);
    setAvailabilityView(resultMode);

    if (resultMode === 'suggestions') {
      setSuggestionAvailability(null);
      setLastSearchPreferredDate(requestedDate);
      setDaySlotsDate(null);
    } else {
      setDaySlotsDate(requestedDate);
      setDaySlotsPeriod(requestedPeriod);
    }

    availabilityMutation.mutate(
      {
        vehicle_id: selectedVehicle.id,
        service_type_id: serviceTypeId,
        workshop_ids: [selectedWorkshopId],
        preferred_date: requestedDate,
        preferred_period: requestedPeriod,
        result_mode: resultMode,
      },
      {
        onSuccess: (response) => {
          const displayAvailability =
            resultMode === 'suggestions'
              ? {
                  preferred_date_available: response.preferred_date_available,
                  options: response.options.slice(0, 3),
                }
              : response;

          setExpirationNow(Date.now());
          setAvailability(displayAvailability);
          if (resultMode === 'suggestions') {
            setSuggestionAvailability(displayAvailability);
          }
          availabilityMutation.reset();
        },
        onError: (error) => {
          const availabilityNotFound =
            error instanceof HttpError &&
            error.code === 'BOOKING_AVAILABILITY_NOT_FOUND';

          setBookingError(
            resultMode === 'day_slots' && availabilityNotFound
              ? getDaySlotsNotFoundMessage(requestedPeriod)
              : getAiBookingErrorMessage(error)
          );
          setCanSearchAllDay(
            resultMode === 'suggestions' &&
              requestedPeriod !== 'any' &&
              availabilityNotFound
          );
        },
        onSettled: () => {
          availabilityLockRef.current = false;
        },
      }
    );
  };

  const handleAvailabilitySearch = (
    periodOverride: AiBookingPreferredPeriod = preferredPeriod
  ) => {
    performAvailabilitySearch(
      'suggestions',
      dateMode === 'earliest' ? null : preferredDate.trim(),
      periodOverride
    );
  };

  const handleDaySlotsSearch = (
    requestedDate: string,
    requestedPeriod: AiBookingPreferredPeriod
  ) => {
    performAvailabilitySearch(
      'day_slots',
      requestedDate.trim() || null,
      requestedPeriod
    );
  };

  const openDayPicker = (initialDate: string | null) => {
    if (isBookingPending) {
      return;
    }

    clearSelectedOffer();
    setAvailability(null);
    setAvailabilityView('day_slots');
    setShowDayPicker(true);
    setDayPickerDate(initialDate ?? '');
    setDayPickerPeriod('any');
    setDaySlotsDate(null);
    setBookingError(null);
    setPreferenceError(null);
    setCanSearchAllDay(false);
  };

  const handleReturnToSuggestions = () => {
    if (isBookingPending || suggestionAvailability === null) {
      return;
    }

    clearSelectedOffer();
    setExpirationNow(Date.now());
    setAvailability(suggestionAvailability);
    setAvailabilityView('suggestions');
    setShowDayPicker(false);
    setDaySlotsDate(null);
    setBookingError(null);
    setPreferenceError(null);
    setCanSearchAllDay(false);
  };

  const handleDayPickerDateSelection = (value: string) => {
    if (isBookingPending) {
      return;
    }

    clearSelectedOffer();
    setAvailability(null);
    setDayPickerDate(value);
    setBookingError(null);
    setPreferenceError(null);
  };

  const handleDayPickerPeriodChange = (period: AiBookingPreferredPeriod) => {
    if (isBookingPending || period === dayPickerPeriod) {
      return;
    }

    clearSelectedOffer();
    setAvailability(null);
    setDayPickerPeriod(period);
    setBookingError(null);
    setPreferenceError(null);
  };

  const handleOptionSelection = (option: AiBookingAvailabilityOption) => {
    if (isBookingPending) {
      return;
    }

    if (isBookingOptionExpired(option.expires_at)) {
      clearAvailability();
      setBookingError(
        'Ce créneau a expiré. Recherchez de nouvelles disponibilités.'
      );
      return;
    }

    if (selectedOption?.slot_token !== option.slot_token) {
      idempotencyAttemptRef.current = null;
      confirmationMutation.reset();
    }

    setSelectedOption(option);
    setBookingError(null);
  };

  const handleConfirmation = () => {
    if (
      confirmationLockRef.current ||
      confirmationMutation.isPending ||
      availabilityMutation.isPending ||
      selectedOption === null
    ) {
      return;
    }

    if (isBookingOptionExpired(selectedOption.expires_at)) {
      clearAvailability();
      setBookingError(
        'Ce créneau a expiré. Recherchez de nouvelles disponibilités.'
      );
      return;
    }

    const existingAttempt = idempotencyAttemptRef.current;
    const isSameAttempt =
      existingAttempt?.slotToken === selectedOption.slot_token &&
      existingAttempt.problemSummary === context.problemSummary;
    const idempotencyKey = isSameAttempt
      ? existingAttempt.idempotencyKey
      : createSecureIdempotencyKey();

    if (!idempotencyKey) {
      setBookingError(
        'La confirmation sécurisée n’est pas disponible sur cet appareil.'
      );
      return;
    }

    if (!isSameAttempt) {
      idempotencyAttemptRef.current = {
        idempotencyKey,
        problemSummary: context.problemSummary,
        slotToken: selectedOption.slot_token,
      };
    }

    confirmationLockRef.current = true;
    setBookingError(null);
    confirmationMutation.mutate(
      {
        idempotencyKey,
        input: {
          slot_token: selectedOption.slot_token,
          problem_summary: context.problemSummary,
          confirmation: true,
        },
      },
      {
        onSuccess: (createdAppointment) => {
          idempotencyAttemptRef.current = null;
          setAvailability(null);
          setSelectedOption(null);
          setBookingSuccess(createdAppointment);
          availabilityMutation.reset();
          confirmationMutation.reset();
        },
        onError: (error) => {
          setBookingError(getAiBookingErrorMessage(error));

          if (isBookingConflict(error)) {
            idempotencyAttemptRef.current = null;
            setAvailability(null);
            setSelectedOption(null);
            availabilityMutation.reset();
            confirmationMutation.reset();
          }
        },
        onSettled: () => {
          confirmationLockRef.current = false;
        },
      }
    );
  };

  if (bookingSuccess) {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.bookingShell,
          isNarrow && styles.bookingShellNarrow,
          styles.bookingSuccessShell,
        ]}
      >
        <View style={styles.bookingSuccessBadge}>
          <Text style={styles.bookingSuccessBadgeText}>DEMANDE ENVOYÉE</Text>
        </View>
        <Text style={styles.bookingTitle}>Demande envoyée avec succès</Text>
        <Text style={styles.bookingLead}>
          Votre demande de rendez-vous a bien été enregistrée. Elle est en
          attente de confirmation par le service CRC/SAV.
        </Text>

        <View style={styles.bookingSummaryGrid}>
          <BookingSummaryItem
            label="Numéro du rendez-vous"
            value={`#${bookingSuccess.appointment_id}`}
          />
          <BookingSummaryItem label="Statut" value="En attente" />
          <BookingSummaryItem
            label="Véhicule"
            value={bookingSuccess.vehicle.label}
          />
          <BookingSummaryItem
            label="Service"
            value={bookingSuccess.service_type.name}
          />
          <BookingSummaryItem
            label="Atelier"
            value={bookingSuccess.workshop.name}
          />
          <BookingSummaryItem
            label="Showroom"
            value={bookingSuccess.showroom.name}
          />
          <BookingSummaryItem
            label="Date"
            value={formatBookingDate(bookingSuccess.requested_date)}
          />
          <BookingSummaryItem
            label="Heure"
            value={formatBookingTime(bookingSuccess.requested_time)}
          />
        </View>

        <Link href="/history" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ hovered, pressed }) => [
              styles.bookingPrimaryAction,
              hovered && styles.bookingPrimaryActionHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.bookingPrimaryActionText}>
              Voir mes rendez-vous
            </Text>
          </Pressable>
        </Link>
        <BookingResetButton disabled={false} onReset={onChangeJourney} />
      </View>
    );
  }

  return (
    <View
      style={[styles.bookingShell, isNarrow && styles.bookingShellNarrow]}
    >
      <View style={styles.bookingHeader}>
        <View
          style={[
            styles.bookingHeaderCopy,
            isNarrow && styles.bookingHeaderCopyNarrow,
          ]}
        >
          <Text style={styles.bookingKicker}>PRISE EN CHARGE SMEIA</Text>
          <Text style={styles.bookingTitle}>Planifier mon rendez-vous</Text>
          <Text style={styles.bookingLead}>
            Choisissez un atelier recommandé, puis consultez les créneaux réels
            proposés par le service SAV.
          </Text>
        </View>
        <View style={styles.bookingPendingBadge}>
          <Text style={styles.bookingPendingBadgeText}>
            Validation SAV requise
          </Text>
        </View>
      </View>

      <View style={styles.bookingProgress}>
        {bookingStepLabels.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3 | 4;
          const isActive = step === bookingStep;
          const isComplete = step < bookingStep;

          return (
            <View
              accessible
              accessibilityLabel={`Étape ${step} sur 4 : ${label}${isActive ? ', étape actuelle' : isComplete ? ', terminée' : ''}`}
              key={label}
              style={[
                styles.bookingProgressItem,
                isNarrow && styles.bookingProgressItemNarrow,
                isActive && styles.bookingProgressItemActive,
                isComplete && styles.bookingProgressItemComplete,
              ]}
            >
              <View
                style={[
                  styles.bookingProgressIndex,
                  (isActive || isComplete) &&
                    styles.bookingProgressIndexHighlighted,
                ]}
              >
                <Text
                  style={[
                    styles.bookingProgressIndexText,
                    (isActive || isComplete) &&
                      styles.bookingProgressIndexTextHighlighted,
                  ]}
                >
                  {step}
                </Text>
              </View>
              <Text
                style={[
                  styles.bookingProgressLabel,
                  (isActive || isComplete) &&
                    styles.bookingProgressLabelHighlighted,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={[
          styles.bookingSection,
          isNarrow && styles.bookingSectionNarrow,
        ]}
      >
        <Text style={styles.bookingSectionKicker}>ÉTAPE 1</Text>
        <Text style={styles.bookingSectionTitle}>Choisissez votre atelier</Text>
        <Text style={styles.bookingSectionText}>
          {context.workshopSelectionDescription}
        </Text>

        {recommendedWorkshops.length > 0 ? (
          <View style={styles.bookingWorkshopGrid}>
            {recommendedWorkshops.map((workshop) => {
              const selected = selectedWorkshopId === workshop.id;

              return (
                <Pressable
                  key={workshop.id}
                  accessibilityLabel={`Choisir ${workshop.name}`}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: isBookingPending,
                    selected,
                  }}
                  disabled={isBookingPending}
                  onPress={() => {
                    handleWorkshopSelection(workshop.id);
                  }}
                  style={({ hovered, pressed }) => [
                    styles.bookingWorkshopCard,
                    isNarrow && styles.bookingCardNarrow,
                    selected && styles.bookingWorkshopCardSelected,
                    hovered && !isBookingPending &&
                      styles.bookingWorkshopCardHovered,
                    pressed && styles.pressed,
                    isBookingPending && styles.disabled,
                  ]}
                >
                  <View
                    style={[
                      styles.bookingSelectionDot,
                      selected && styles.bookingSelectionDotSelected,
                    ]}
                  />
                  <View style={styles.bookingWorkshopCopy}>
                    <Text style={styles.bookingSmallLabel}>
                      {context.workshopCardLabel}
                    </Text>
                    <Text style={styles.bookingWorkshopName}>
                      {workshop.name}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.bookingEmptyText}>
            Aucun atelier réservable n’est disponible pour cette orientation.
          </Text>
        )}
      </View>

      {selectedWorkshopId !== null &&
      availabilityView === 'suggestions' &&
      !showDayPicker ? (
        <View
          style={[
            styles.bookingSection,
            isNarrow && styles.bookingSectionNarrow,
          ]}
        >
          <Text style={styles.bookingSectionKicker}>ÉTAPE 2</Text>
          <Text style={styles.bookingSectionTitle}>
            Indiquez votre préférence
          </Text>
          <Text style={styles.bookingSectionText}>
            Les dates et horaires disponibles seront exclusivement calculés à
            partir de Directus. Fuseau : {AI_BOOKING_TIME_ZONE}.
          </Text>

          <View style={styles.bookingModeRow}>
            <BookingChoiceButton
              disabled={isBookingPending}
              label="Trouver les premiers créneaux disponibles"
              onPress={() => {
                handleDateModeChange('earliest');
              }}
              selected={dateMode === 'earliest'}
            />
            <BookingChoiceButton
              disabled={isBookingPending}
              label="Je choisis une date"
              onPress={() => {
                handleDateModeChange('date');
              }}
              selected={dateMode === 'date'}
            />
          </View>

          {dateMode === 'date' ? (
            <BookingDateCalendar
              compact={isNarrow}
              disabled={isBookingPending}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              onSelect={handlePreferredDateSelection}
              selectedDate={preferredDate || null}
            />
          ) : null}

          <Text style={styles.bookingFieldLabel}>Période</Text>
          <View style={styles.bookingPeriodRow}>
            {bookingPeriodOptions.map((period) => (
              <BookingChoiceButton
                key={period.value}
                disabled={isBookingPending}
                label={period.label}
                onPress={() => {
                  handlePeriodChange(period.value);
                }}
                selected={preferredPeriod === period.value}
              />
            ))}
          </View>

          {preferenceError ? (
            <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
              {preferenceError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isBookingPending }}
            disabled={isBookingPending}
            onPress={() => {
              handleAvailabilitySearch();
            }}
            style={({ hovered, pressed }) => [
              styles.bookingPrimaryAction,
              hovered && !isBookingPending &&
                styles.bookingPrimaryActionHovered,
              pressed && styles.pressed,
              isBookingPending && styles.disabled,
            ]}
          >
            <Text style={styles.bookingPrimaryActionText}>
              {availabilityMutation.isPending
                ? 'Recherche en cours…'
                : 'Rechercher les créneaux'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {availabilityMutation.isPending &&
      availabilityView === 'day_slots' &&
      !showDayPicker ? (
        <View style={styles.bookingAlternativeNotice}>
          <Text
            accessibilityLiveRegion="polite"
            style={styles.bookingAlternativeText}
          >
            Recherche des créneaux disponibles pour cette date…
          </Text>
        </View>
      ) : null}

      {bookingError ? (
        <ControlledErrorPanel
          message={bookingError}
          title="Réservation indisponible"
        />
      ) : null}

      {canSearchAllDay && availabilityView === 'suggestions' ? (
        <View style={styles.bookingAlternativeNotice}>
          <Text style={styles.bookingAlternativeText}>
            Aucun créneau n’est disponible sur cette période. Souhaitez-vous
            élargir la recherche à toute la journée ?
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isBookingPending}
            onPress={() => {
              setPreferredPeriod('any');
              handleAvailabilitySearch('any');
            }}
            style={({ hovered, pressed }) => [
              styles.bookingPrimaryAction,
              hovered && !isBookingPending && styles.bookingPrimaryActionHovered,
              pressed && styles.pressed,
              isBookingPending && styles.disabled,
            ]}
          >
            <Text style={styles.bookingPrimaryActionText}>
              Rechercher sur toute la journée
            </Text>
          </Pressable>
        </View>
      ) : null}

      {bookingError &&
      availabilityView === 'day_slots' &&
      !showDayPicker &&
      !availabilityMutation.isPending &&
      availability === null ? (
        <View style={styles.bookingDayNavigationActions}>
          {suggestionAvailability ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBookingPending}
              onPress={handleReturnToSuggestions}
              style={({ hovered, pressed }) => [
                styles.bookingSecondaryAction,
                hovered && !isBookingPending &&
                  styles.bookingSecondaryActionHovered,
                pressed && styles.pressed,
                isBookingPending && styles.disabled,
              ]}
            >
              <Text style={styles.bookingSecondaryActionText}>
                Retour aux suggestions
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isBookingPending}
            onPress={() => {
              openDayPicker(daySlotsDate ?? suggestionTargetDate);
            }}
            style={({ hovered, pressed }) => [
              styles.bookingSecondaryAction,
              hovered && !isBookingPending &&
                styles.bookingSecondaryActionHovered,
              pressed && styles.pressed,
              isBookingPending && styles.disabled,
            ]}
          >
            <Text style={styles.bookingSecondaryActionText}>
              Choisir une autre date
            </Text>
          </Pressable>
        </View>
      ) : null}

      {showDayPicker ? (
        <View
          style={[
            styles.bookingSection,
            isNarrow && styles.bookingSectionNarrow,
          ]}
        >
          <View style={styles.bookingDayNavigation}>
            <View style={styles.bookingHeaderCopy}>
              <Text style={styles.bookingSectionKicker}>CHOIX MANUEL</Text>
              <Text style={styles.bookingSectionTitle}>
                Choisir une autre date et mon créneau
              </Text>
            </View>
            {suggestionAvailability ? (
              <Pressable
                accessibilityRole="button"
                disabled={isBookingPending}
                onPress={handleReturnToSuggestions}
                style={({ hovered, pressed }) => [
                  styles.bookingSecondaryAction,
                  hovered && !isBookingPending &&
                    styles.bookingSecondaryActionHovered,
                  pressed && styles.pressed,
                  isBookingPending && styles.disabled,
                ]}
              >
                <Text style={styles.bookingSecondaryActionText}>
                  Retour aux suggestions
                </Text>
              </Pressable>
            ) : null}
          </View>

          <BookingDateCalendar
            compact={isNarrow}
            disabled={isBookingPending}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            onSelect={handleDayPickerDateSelection}
            selectedDate={dayPickerDate || null}
          />

          <Text style={styles.bookingFieldLabel}>Période</Text>
          <View style={styles.bookingPeriodRow}>
            {bookingPeriodOptions.map((period) => (
              <BookingChoiceButton
                key={period.value}
                disabled={isBookingPending}
                label={period.label}
                onPress={() => {
                  handleDayPickerPeriodChange(period.value);
                }}
                selected={dayPickerPeriod === period.value}
              />
            ))}
          </View>

          {preferenceError ? (
            <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
              {preferenceError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isBookingPending}
            onPress={() => {
              handleDaySlotsSearch(dayPickerDate, dayPickerPeriod);
            }}
            style={({ hovered, pressed }) => [
              styles.bookingPrimaryAction,
              hovered && !isBookingPending && styles.bookingPrimaryActionHovered,
              pressed && styles.pressed,
              isBookingPending && styles.disabled,
            ]}
          >
            <Text style={styles.bookingPrimaryActionText}>
              {availabilityMutation.isPending
                ? 'Recherche en cours…'
                : 'Afficher les créneaux de cette date'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {availability && availabilityView === 'suggestions' ? (
        <View
          style={[
            styles.bookingSection,
            isNarrow && styles.bookingSectionNarrow,
          ]}
        >
          <Text style={styles.bookingSectionKicker}>ÉTAPE 3</Text>
          <Text style={styles.bookingSectionTitle}>
            Choisissez un créneau réel
          </Text>

          {lastSearchPreferredDate !== null &&
          !availability.preferred_date_available &&
          availability.options.some(
            (option) => option.requested_date > lastSearchPreferredDate
          ) ? (
            <View style={styles.bookingAlternativeNotice}>
              <Text style={styles.bookingAlternativeText}>
                Autres créneaux disponibles
              </Text>
            </View>
          ) : null}

          {availability.options.length > 0 ? (
            <View style={styles.bookingOptionsGrid}>
              {availability.options.map((option) => {
                const expired = isBookingOptionExpired(
                  option.expires_at,
                  expirationNow
                );
                const selected =
                  selectedOption?.slot_token === option.slot_token;

                return (
                  <Pressable
                    key={`${option.workshop_id}:${option.requested_date}:${option.requested_time}`}
                    accessibilityLabel={`${option.workshop_name}, ${formatBookingDate(option.requested_date)} à ${formatBookingTime(option.requested_time)}`}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: expired || isBookingPending,
                      selected,
                    }}
                    disabled={expired || isBookingPending}
                    onPress={() => {
                      handleOptionSelection(option);
                    }}
                    style={({ hovered, pressed }) => [
                      styles.bookingOptionCard,
                      isNarrow && styles.bookingCardNarrow,
                      selected && styles.bookingOptionCardSelected,
                      hovered && !expired && !isBookingPending &&
                        styles.bookingOptionCardHovered,
                      (expired || isBookingPending) && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.bookingOptionHeader}>
                      <Text style={styles.bookingOptionDate}>
                        {formatBookingDate(option.requested_date)}
                      </Text>
                      <View
                        style={[
                          styles.bookingAvailableBadge,
                          expired && styles.bookingExpiredBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bookingAvailableBadgeText,
                            expired && styles.bookingExpiredBadgeText,
                          ]}
                        >
                          {expired ? 'Expiré' : 'Disponible'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.bookingOptionTime}>
                      {formatBookingTime(option.requested_time)}
                    </Text>
                    <Text style={styles.bookingOptionService}>
                      {option.service_type.name}
                    </Text>
                    <BookingDetailLine
                      label="Atelier"
                      value={option.workshop_name}
                    />
                    <BookingDetailLine
                      label="Showroom"
                      value={option.showroom.name}
                    />
                    <BookingDetailLine
                      label="Ville"
                      value={option.showroom.city ?? 'Non renseignée'}
                    />
                    <BookingDetailLine
                      label="Adresse"
                      value={option.showroom.address ?? 'Non renseignée'}
                    />
                    <BookingDetailLine
                      label="Téléphone"
                      value={option.showroom.phone ?? 'Non renseigné'}
                    />
                    <BookingDetailLine
                      label="Intervalle"
                      value={`${option.slot_interval_minutes} minutes`}
                    />
                    {expired ? (
                      <Text style={styles.bookingExpiredText}>
                        Ce créneau a expiré. Recherchez de nouvelles
                        disponibilités.
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.bookingEmptyText}>
              Aucun créneau disponible pour cette préférence. Essayez une autre
              date ou un autre atelier.
            </Text>
          )}

          {suggestionTargetDate ? (
            <View style={styles.bookingExpansionGrid}>
              <BookingExpansionAction
                disabled={isBookingPending}
                label="+ Voir tous les créneaux du matin"
                subtitle={`Le ${formatBookingDate(suggestionTargetDate)}`}
                onPress={() => {
                  handleDaySlotsSearch(suggestionTargetDate, 'morning');
                }}
              />
              <BookingExpansionAction
                disabled={isBookingPending}
                label="+ Voir tous les créneaux de l’après-midi"
                subtitle={`Le ${formatBookingDate(suggestionTargetDate)}`}
                onPress={() => {
                  handleDaySlotsSearch(suggestionTargetDate, 'afternoon');
                }}
              />
              <BookingExpansionAction
                disabled={isBookingPending}
                label="Choisir une autre date et mon créneau"
                subtitle="Calendrier des 30 prochains jours"
                onPress={() => {
                  openDayPicker(suggestionTargetDate);
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {availability &&
      availabilityView === 'day_slots' &&
      !showDayPicker ? (
        <View
          style={[
            styles.bookingSection,
            isNarrow && styles.bookingSectionNarrow,
          ]}
        >
          <View style={styles.bookingDayNavigation}>
            <View style={styles.bookingHeaderCopy}>
              <Text style={styles.bookingSectionKicker}>ÉTAPE 3</Text>
              <Text style={styles.bookingSectionTitle}>
                Tous les créneaux du{' '}
                {daySlotsPeriod === 'morning'
                  ? 'matin'
                  : daySlotsPeriod === 'afternoon'
                    ? 'l’après-midi'
                    : 'jour'}
              </Text>
              {daySlotsDate ? (
                <Text style={styles.bookingDayDate}>
                  {formatBookingDate(daySlotsDate)}
                </Text>
              ) : null}
            </View>
            <View style={styles.bookingDayNavigationActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isBookingPending}
                onPress={handleReturnToSuggestions}
                style={({ hovered, pressed }) => [
                  styles.bookingSecondaryAction,
                  hovered && !isBookingPending &&
                    styles.bookingSecondaryActionHovered,
                  pressed && styles.pressed,
                  isBookingPending && styles.disabled,
                ]}
              >
                <Text style={styles.bookingSecondaryActionText}>
                  Retour aux suggestions
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isBookingPending}
                onPress={() => {
                  openDayPicker(daySlotsDate ?? suggestionTargetDate);
                }}
                style={({ hovered, pressed }) => [
                  styles.bookingSecondaryAction,
                  hovered && !isBookingPending &&
                    styles.bookingSecondaryActionHovered,
                  pressed && styles.pressed,
                  isBookingPending && styles.disabled,
                ]}
              >
                <Text style={styles.bookingSecondaryActionText}>
                  Choisir une autre date
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.bookingDayGroups}>
            {daySlotGroups.map((group) => (
              <View
                key={`${group.workshopId}:${group.showroomName}`}
                style={styles.bookingDayGroup}
              >
                <View style={styles.bookingDayGroupHeader}>
                  <Text style={styles.bookingWorkshopName}>
                    {group.workshopName}
                  </Text>
                  <Text style={styles.bookingDayShowroom}>
                    {group.showroomName}
                  </Text>
                </View>
                <View style={styles.bookingTimeGrid}>
                  {group.options.map((option) => {
                    const expired = isBookingOptionExpired(
                      option.expires_at,
                      expirationNow
                    );
                    const selected =
                      selectedOption?.slot_token === option.slot_token;

                    return (
                      <Pressable
                        key={option.slot_token}
                        accessibilityLabel={`Choisir ${formatBookingTime(option.requested_time)} à ${group.workshopName}`}
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: expired || isBookingPending,
                          selected,
                        }}
                        disabled={expired || isBookingPending}
                        onPress={() => {
                          handleOptionSelection(option);
                        }}
                        style={({ hovered, pressed }) => [
                          styles.bookingTimeChip,
                          selected && styles.bookingTimeChipSelected,
                          hovered && !expired && !isBookingPending &&
                            styles.bookingTimeChipHovered,
                          pressed && styles.pressed,
                          (expired || isBookingPending) && styles.disabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bookingTimeChipText,
                            selected && styles.bookingTimeChipTextSelected,
                          ]}
                        >
                          {formatBookingTime(option.requested_time)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {selectedOption ? (
        <View
          style={[
            styles.bookingSection,
            isNarrow && styles.bookingSectionNarrow,
            styles.bookingConfirmationSection,
          ]}
        >
          <Text style={styles.bookingSectionKicker}>ÉTAPE 4</Text>
          <Text style={styles.bookingSectionTitle}>
            Vérifiez votre demande
          </Text>
          <Text style={styles.bookingSectionText}>
            Aucun rendez-vous ne sera créé avant votre confirmation explicite.
          </Text>

          <View style={styles.bookingSummaryGrid}>
            <BookingSummaryItem
              label="Véhicule"
              value={getVehicleDisplayName(selectedVehicle)}
            />
            <BookingSummaryItem
              label="Prestation"
              value={selectedOption.service_type.name || context.serviceTypeName}
            />
            <BookingSummaryItem
              label="Atelier"
              value={selectedOption.workshop_name}
            />
            <BookingSummaryItem
              label="Showroom"
              value={selectedOption.showroom.name}
            />
            <BookingSummaryItem
              label="Date"
              value={formatBookingDate(selectedOption.requested_date)}
            />
            <BookingSummaryItem
              label="Heure"
              value={formatBookingTime(selectedOption.requested_time)}
            />
          </View>

          <View style={styles.bookingSummaryGrid}>
            <BookingSummaryItem label="Client" value={contacts.name} />
            <BookingSummaryItem
              label="E-mail"
              value={contacts.email ?? 'Non renseigné'}
            />
            <BookingSummaryItem
              label="Téléphone"
              value={contacts.phone ?? 'Non renseigné'}
            />
            <BookingSummaryItem
              label="Adresse"
              value={contacts.address ?? 'Non renseignée'}
            />
          </View>

          <Link href="/profile" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ hovered, pressed }) => [
                styles.bookingSecondaryAction,
                hovered && styles.bookingSecondaryActionHovered,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.bookingSecondaryActionText}>
                Modifier mon profil
              </Text>
            </Pressable>
          </Link>

          <View style={styles.bookingProblemSummary}>
            <Text style={styles.bookingSmallLabel}>Résumé du problème</Text>
            <Text style={styles.bookingProblemSummaryText}>
              {context.problemSummary}
            </Text>
          </View>

          <View style={styles.bookingFutureStatus}>
            <Text style={styles.bookingFutureStatusText}>
              Statut après envoi : Demande en attente de validation SAV
            </Text>
          </View>

          {selectedOptionExpired ? (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.bookingExpiredText}
            >
              Ce créneau a expiré. Recherchez de nouvelles disponibilités.
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: isBookingPending || selectedOptionExpired,
            }}
            disabled={isBookingPending || selectedOptionExpired}
            onPress={handleConfirmation}
            style={({ hovered, pressed }) => [
              styles.bookingPrimaryAction,
              hovered && !isBookingPending && !selectedOptionExpired &&
                styles.bookingPrimaryActionHovered,
              pressed && styles.pressed,
              (isBookingPending || selectedOptionExpired) && styles.disabled,
            ]}
          >
            <Text style={styles.bookingPrimaryActionText}>
              {confirmationMutation.isPending
                ? 'Confirmation en cours…'
                : 'Confirmer la demande de rendez-vous'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <BookingResetButton
        disabled={isBookingPending}
        onReset={onChangeJourney}
      />
    </View>
  );
}

function BookingResetButton({
  disabled,
  onReset,
}: {
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onReset}
      style={({ hovered, pressed }) => [
        styles.bookingSecondaryAction,
        hovered && !disabled && styles.bookingSecondaryActionHovered,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.bookingSecondaryActionText}>Changer de parcours</Text>
    </Pressable>
  );
}

type BookingChoiceButtonProps = {
  disabled: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
};

function BookingChoiceButton({
  disabled,
  label,
  onPress,
  selected,
}: BookingChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.bookingChoiceButton,
        selected && styles.bookingChoiceButtonSelected,
        hovered && !disabled && styles.bookingChoiceButtonHovered,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.bookingChoiceButtonText,
          selected && styles.bookingChoiceButtonTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BookingExpansionAction({
  disabled,
  label,
  subtitle,
  onPress,
}: {
  disabled: boolean;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}. ${subtitle}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.bookingExpansionAction,
        hovered && !disabled && styles.bookingExpansionActionHovered,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.bookingExpansionActionLabel}>{label}</Text>
      <Text style={styles.bookingExpansionActionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function BookingDetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bookingDetailLine}>
      <Text style={styles.bookingDetailLabel}>{label}</Text>
      <Text style={styles.bookingDetailValue}>{value}</Text>
    </View>
  );
}

function BookingSummaryItem({ label, value }: { label: string; value: string }) {
  const { width } = useWindowDimensions();

  return (
    <View
      style={[
        styles.bookingSummaryItem,
        width < breakpoints.tablet && styles.bookingCardNarrow,
      ]}
    >
      <Text style={styles.bookingSummaryLabel}>{label}</Text>
      <Text style={styles.bookingSummaryValue}>{value}</Text>
    </View>
  );
}

type VisualAnalysisCardProps = {
  photo: SelectedAiPhoto | null;
  result: AiDiagnosticResult;
};

function VisualAnalysisCard({ photo, result }: VisualAnalysisCardProps) {
  if (!result.image_analysis.image_provided) {
    return null;
  }

  return (
    <View style={styles.visualAnalysisCard}>
      <View style={styles.visualAnalysisHeader}>
        <View style={styles.visualAnalysisHeading}>
          <Text style={styles.resultKicker}>ANALYSE VISUELLE IA</Text>
          <Text style={styles.visualAnalysisTitle}>Analyse visuelle IA</Text>
        </View>
        <View style={styles.photoAnalyzedBadge}>
          <View style={styles.photoAnalyzedDot} />
          <Text style={styles.photoAnalyzedBadgeText}>Photo analysée</Text>
        </View>
      </View>

      <View style={styles.visualAnalysisContent}>
        {photo ? (
          <Image
            accessibilityLabel="Photo analysée par l’assistant IA"
            resizeMode="cover"
            source={{ uri: photo.previewUri }}
            style={styles.visualAnalysisImage}
          />
        ) : null}

        <View style={styles.visualAnalysisCopy}>
          {result.image_analysis.useful ? (
            <View style={styles.usefulImageBadge}>
              <Text style={styles.usefulImageBadgeText}>Image exploitable</Text>
            </View>
          ) : null}
          {result.image_analysis.observations ? (
            <Text style={styles.visualAnalysisObservations}>
              {result.image_analysis.observations}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function OptionalPhotoSuggestion({ result }: { result: AiDiagnosticResult }) {
  if (
    !result.image_analysis.photo_suggested ||
    !result.image_analysis.requested_image_hint
  ) {
    return null;
  }

  return (
    <View style={styles.photoSuggestionBox}>
      <Text style={styles.photoSuggestionTitle}>Photo facultative suggérée</Text>
      <Text style={styles.photoSuggestionText}>
        {result.image_analysis.requested_image_hint}
      </Text>
    </View>
  );
}

type JourneyAsideProps = {
  accumulatedAnswerCount: number;
  isPending: boolean;
  journeyStep: JourneyStep;
  selectedVehicle: VehicleListItem | null;
};

function JourneyAside({
  accumulatedAnswerCount,
  isPending,
  journeyStep,
  selectedVehicle,
}: JourneyAsideProps) {
  if (isPending) {
    return <SecureAnalysisVisual />;
  }

  if (journeyStep === 'answering') {
    return (
      <>
        <Text style={styles.sidePanelTitle}>Analyse à préciser</Text>
        <Text style={styles.sidePanelText}>
          Répondez aux questions affichées. Elles proviennent du service de
          pré-diagnostic et remplacent les questions du tour précédent.
        </Text>
        <View style={styles.progressBox}>
          <Text style={styles.previewLabel}>Réponses déjà analysées</Text>
          <Text style={styles.progressValue}>
            {accumulatedAnswerCount}/{MAX_ANSWERS}
          </Text>
        </View>
      </>
    );
  }

  if (journeyStep === 'result') {
    return (
      <>
        <Text style={styles.sidePanelTitle}>À propos du résultat</Text>
        <Text style={styles.sidePanelText}>
          Cette orientation ne constitue pas un diagnostic certain. Un contrôle
          par un professionnel reste nécessaire pour confirmer la cause et les
          travaux éventuels.
        </Text>
      </>
    );
  }

  return (
    <>
      <Text style={styles.sidePanelTitle}>Comment ça marche ?</Text>
      <Text style={styles.sidePanelText}>
        Sélectionnez votre véhicule et décrivez le symptôme. L'assistant pourra
        poser jusqu'à cinq questions au total avant de proposer une orientation.
      </Text>
      {selectedVehicle ? (
        <View style={styles.progressBox}>
          <Text style={styles.previewLabel}>Véhicule sélectionné</Text>
          <Text style={styles.selectedVehicleText}>
            {getVehicleDisplayName(selectedVehicle)}
          </Text>
        </View>
      ) : null}
      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerTitle}>Pré-diagnostic indicatif</Text>
        <Text style={styles.disclaimerText}>
          Aucune donnée de rendez-vous ou ligne de diagnostic n'est créée à
          cette étape.
        </Text>
      </View>
      <View pointerEvents="none" style={styles.blueprintPanel}>
        <View style={styles.blueprintGlow} />
        <ExpoImage
          accessible={false}
          contentFit="contain"
          resizeMode="contain"
          source={require('@/assets/ai/smeia-ai-vehicle-blueprint.png')}
          style={styles.blueprintImage}
        />
      </View>
    </>
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

function ControlledErrorPanel({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.submitErrorBox}>
      <View style={styles.errorIcon}>
        <Text style={styles.errorIconText}>!</Text>
      </View>
      <View style={styles.errorCopy}>
        <Text style={styles.submitErrorTitle}>{title}</Text>
        <Text style={styles.submitErrorText}>{message}</Text>
      </View>
    </View>
  );
}

type SelectableVehicleCardProps = {
  active: boolean;
  disabled: boolean;
  vehicle: VehicleListItem;
  onPress: () => void;
};

function SelectableVehicleCard({
  active,
  disabled,
  vehicle,
  onPress,
}: SelectableVehicleCardProps) {
  const vehicleMeta = getVehicleMeta(vehicle);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.vehicleCard,
        active && styles.vehicleCardActive,
        hovered && !disabled && styles.vehicleCardHovered,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.vehicleHeader}>
        <Text style={styles.vehicleBrand}>Véhicule SMEIA</Text>
        <View style={styles.registrationBadge}>
          <Text style={styles.registrationText}>
            {vehicle.registrationNumber}
          </Text>
        </View>
      </View>
      <Text style={styles.vehicleModel}>{getVehicleDisplayName(vehicle)}</Text>
      {vehicleMeta ? <Text style={styles.vehicleMeta}>{vehicleMeta}</Text> : null}
    </Pressable>
  );
}

type ResultMetricTone = 'calm' | 'warning' | 'danger' | 'neutral';

function ResultMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: ResultMetricTone;
  value: string;
}) {
  return (
    <View
      style={[
        styles.resultMetric,
        tone === 'calm' && styles.resultMetricCalm,
        tone === 'warning' && styles.resultMetricWarning,
        tone === 'danger' && styles.resultMetricDanger,
      ]}
    >
      <View
        style={[
          styles.metricAccent,
          tone === 'calm' && styles.metricAccentCalm,
          tone === 'warning' && styles.metricAccentWarning,
          tone === 'danger' && styles.metricAccentDanger,
        ]}
      />
      <Text style={styles.resultMetricLabel}>{label}</Text>
      <Text
        style={[
          styles.resultMetricValue,
          tone === 'calm' && styles.resultMetricValueCalm,
          tone === 'warning' && styles.resultMetricValueWarning,
          tone === 'danger' && styles.resultMetricValueDanger,
        ]}
      >
        {value}
      </Text>
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
    backgroundColor: '#020914',
  },
  contentScroll: {
    flex: 1,
    backgroundColor: '#020914',
    experimental_backgroundImage:
      'linear-gradient(145deg, #020914 0%, #041426 46%, #03101E 100%)',
  },
  content: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  hero: {
    minHeight: 310,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xl,
    overflow: 'hidden',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(122, 190, 221, 0.28)',
    borderRadius: 24,
    backgroundColor: '#081C36',
    experimental_backgroundImage:
      'linear-gradient(135deg, #07182F 0%, #0B2D54 57%, #0C4164 100%)',
    shadowColor: '#07182F',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 34,
  },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  heroBackdropShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(3, 15, 32, 0.14)',
    experimental_backgroundImage:
      'linear-gradient(90deg, rgba(3, 14, 30, 0.98) 0%, rgba(3, 15, 32, 0.85) 34%, rgba(3, 18, 38, 0.2) 68%, rgba(3, 18, 38, 0.08) 100%)',
  },
  heroBackdropShadeNarrow: {
    backgroundColor: 'rgba(3, 15, 32, 0.18)',
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(3, 14, 30, 0.98) 0%, rgba(3, 15, 32, 0.82) 48%, rgba(3, 18, 38, 0.16) 100%)',
  },
  heroNarrow: {
    minHeight: 540,
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: spacing.lg,
  },
  heroHaloLarge: {
    position: 'absolute',
    width: 430,
    height: 430,
    top: -180,
    right: -70,
    borderRadius: 999,
    backgroundColor: 'rgba(65, 181, 219, 0.12)',
  },
  heroHaloSmall: {
    position: 'absolute',
    width: 210,
    height: 210,
    bottom: -100,
    left: '38%',
    borderRadius: 999,
    backgroundColor: 'rgba(56, 140, 205, 0.12)',
  },
  heroRoadLine: {
    position: 'absolute',
    width: '72%',
    height: 1,
    right: '-8%',
    bottom: '23%',
    backgroundColor: 'rgba(142, 218, 237, 0.25)',
    transform: [{ rotate: '-8deg' }],
  },
  heroCopy: {
    flex: 1,
    maxWidth: 610,
    alignItems: 'flex-start',
    gap: spacing.sm,
    zIndex: 1,
  },
  heroCopyNarrow: {
    width: '100%',
    maxWidth: '100%',
    paddingTop: 106,
  },
  heroEyebrow: {
    color: '#78CEE5',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.6,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 210, 232, 0.34)',
    borderRadius: 999,
    backgroundColor: 'rgba(35, 113, 162, 0.25)',
  },
  heroBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#79D5E8',
  },
  heroBadgeText: {
    color: '#D8F1F8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 40,
    lineHeight: 46,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    maxWidth: 660,
    color: '#C9DAEB',
    fontSize: typography.fontSize.lg,
    lineHeight: 27,
  },
  heroClient: {
    color: '#85B7D5',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  heroNotice: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(178, 214, 232, 0.18)',
  },
  heroNoticeText: {
    color: '#A8C4D9',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  heroOrb: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.82,
    shadowColor: '#4AC8EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    zIndex: 1,
  },
  workflowGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  stack: {
    flexDirection: 'column',
  },
  panelNarrow: {
    width: '100%',
    minWidth: 0,
  },
  mainPanel: {
    flex: 1.55,
    minWidth: 0,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(95, 190, 228, 0.22)',
    borderRadius: 24,
    backgroundColor: 'rgba(5, 20, 38, 0.88)',
    experimental_backgroundImage:
      'linear-gradient(145deg, rgba(8, 31, 55, 0.94) 0%, rgba(4, 17, 33, 0.94) 100%)',
    gap: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
  },
  mainPanelFull: {
    width: '100%',
    flex: 1,
  },
  sidePanel: {
    flex: 0.85,
    minWidth: 310,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(95, 190, 228, 0.2)',
    borderRadius: 24,
    backgroundColor: 'rgba(5, 21, 40, 0.82)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(8, 34, 60, 0.9) 0%, rgba(4, 17, 32, 0.94) 100%)',
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 26,
  },
  sectionIntro: {
    gap: spacing.xs,
  },
  sectionKicker: {
    color: '#65D3F1',
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#F4FAFF',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.3,
  },
  sectionText: {
    color: '#9CB2C7',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  vehicleCard: {
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(100, 174, 211, 0.24)',
    borderRadius: 20,
    backgroundColor: 'rgba(4, 17, 33, 0.76)',
    experimental_backgroundImage:
      'linear-gradient(145deg, rgba(8, 32, 56, 0.88) 0%, rgba(4, 16, 31, 0.9) 100%)',
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  vehicleCardActive: {
    borderColor: '#39BDE8',
    backgroundColor: 'rgba(12, 73, 112, 0.55)',
    shadowColor: '#29B9EA',
    shadowOpacity: 0.24,
  },
  vehicleCardHovered: {
    borderColor: 'rgba(90, 205, 239, 0.62)',
    transform: [{ translateY: -2 }],
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  vehicleBrand: {
    flex: 1,
    color: '#6FD4F0',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleModel: {
    color: '#F7FBFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleMeta: {
    color: '#8FA7BC',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  registrationBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(97, 184, 220, 0.28)',
    borderRadius: 999,
    backgroundColor: 'rgba(10, 38, 65, 0.72)',
  },
  registrationText: {
    color: '#BBD8E8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  formSection: {
    gap: spacing.md,
  },
  input: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(99, 181, 220, 0.3)',
    borderRadius: 14,
    backgroundColor: 'rgba(2, 13, 27, 0.82)',
    color: '#F4FAFF',
    fontSize: typography.fontSize.md,
  },
  problemInput: {
    minHeight: 150,
  },
  answerInput: {
    minHeight: 96,
  },
  answerInputFocused: {
    borderColor: '#4FD2F2',
    shadowColor: '#3BC8EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  inputError: {
    borderColor: '#FF8F8A',
  },
  inputMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fieldLabel: {
    color: '#DCEAF5',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  fieldError: {
    flex: 1,
    color: '#FFAAA5',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  fieldHint: {
    flex: 1,
    color: '#7892AA',
    fontSize: typography.fontSize.xs,
  },
  characterCount: {
    color: '#7892AA',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  freeAnswerField: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  freeAnswerLabel: {
    color: '#B9D8E8',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  freeAnswerCounter: {
    alignSelf: 'flex-end',
  },
  photoSection: {
    gap: spacing.md,
  },
  photoDropZone: {
    minHeight: 154,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(77, 202, 237, 0.58)',
    borderRadius: 20,
    backgroundColor: 'rgba(5, 36, 61, 0.58)',
  },
  photoDropZoneHovered: {
    borderColor: '#5ED8F5',
    backgroundColor: 'rgba(9, 65, 99, 0.64)',
    transform: [{ translateY: -1 }],
  },
  photoGlyph: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#0B6FA8',
    shadowColor: '#4CD3F4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  photoGlyphText: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: typography.fontWeight.semiBold,
  },
  photoDropCopy: {
    alignItems: 'flex-start',
    gap: 3,
  },
  photoChooseText: {
    color: '#F3FAFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  photoOptionalText: {
    color: '#9DB4C8',
    fontSize: typography.fontSize.sm,
  },
  photoFormatsText: {
    color: '#7894AB',
    fontSize: typography.fontSize.xs,
  },
  photoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(79, 196, 230, 0.4)',
    borderRadius: 20,
    backgroundColor: 'rgba(6, 36, 59, 0.7)',
  },
  photoPreview: {
    width: 112,
    height: 84,
    borderRadius: 14,
    backgroundColor: '#0A2138',
  },
  photoPreviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  photoFileName: {
    color: '#F4FAFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  photoFileSize: {
    color: '#91A9BE',
    fontSize: typography.fontSize.xs,
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  photoSecondaryAction: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#38BDE8',
    borderRadius: 12,
    backgroundColor: 'rgba(7, 36, 60, 0.88)',
  },
  photoActionHovered: {
    backgroundColor: 'rgba(13, 77, 111, 0.88)',
  },
  photoSecondaryActionText: {
    color: '#78D9F2',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  photoRemoveAction: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(238, 126, 126, 0.48)',
    borderRadius: 12,
    backgroundColor: 'rgba(48, 17, 27, 0.72)',
  },
  photoRemoveActionHovered: {
    backgroundColor: 'rgba(91, 29, 37, 0.76)',
  },
  photoRemoveActionText: {
    color: '#FFAAA5',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(77, 187, 219, 0.3)',
    borderRadius: 18,
    backgroundColor: 'rgba(7, 42, 66, 0.62)',
  },
  privacyIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#0A6EA6',
  },
  privacyIconText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  privacyCopy: {
    flex: 1,
    gap: 2,
  },
  privacyTitle: {
    color: '#DDF4FC',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  privacyText: {
    color: '#91B1C5',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  questionsList: {
    gap: spacing.lg,
  },
  questionField: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(91, 174, 211, 0.24)',
    borderRadius: 20,
    backgroundColor: 'rgba(5, 24, 43, 0.7)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  questionNumber: {
    alignSelf: 'flex-start',
    color: '#66D4F1',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  choiceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceButton: {
    minHeight: 46,
    minWidth: 98,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(105, 178, 211, 0.3)',
    borderRadius: 14,
    backgroundColor: 'rgba(3, 16, 31, 0.8)',
  },
  choiceButtonSelected: {
    borderColor: '#3BC2EB',
    backgroundColor: 'rgba(12, 87, 126, 0.66)',
  },
  choiceButtonHovered: {
    borderColor: '#5FD4EF',
  },
  choiceButtonText: {
    color: '#A9BED0',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  choiceButtonTextSelected: {
    color: '#E7FAFF',
  },
  answerCount: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(9, 48, 74, 0.72)',
    color: '#8FCDE2',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  primaryAction: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#45C7ED',
    borderRadius: 15,
    backgroundColor: '#0B74B2',
    experimental_backgroundImage:
      'linear-gradient(135deg, #1688D3 0%, #0A5EA8 100%)',
    shadowColor: '#35C9F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  primaryActionHovered: {
    backgroundColor: '#087FBE',
    transform: [{ translateY: -1 }],
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  secondaryAction: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(91, 181, 218, 0.36)',
    borderRadius: 15,
    backgroundColor: 'rgba(5, 24, 43, 0.84)',
  },
  secondaryActionHovered: {
    borderColor: '#55C8EB',
    backgroundColor: 'rgba(10, 53, 82, 0.9)',
  },
  secondaryActionText: {
    color: '#C9E4F2',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  sidePanelTitle: {
    color: '#F3FAFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  sidePanelText: {
    color: '#9CB3C7',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  progressBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(83, 179, 217, 0.25)',
    borderRadius: 18,
    backgroundColor: 'rgba(6, 35, 58, 0.7)',
    gap: spacing.xs,
  },
  progressValue: {
    color: '#65D6F2',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  selectedVehicleText: {
    color: '#F0F8FE',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  previewLabel: {
    color: '#75BFD9',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  disclaimerBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(77, 188, 218, 0.28)',
    borderRadius: 18,
    backgroundColor: 'rgba(5, 42, 65, 0.64)',
    gap: spacing.xs,
  },
  disclaimerTitle: {
    color: '#C9F0FA',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  disclaimerText: {
    color: '#8EADBF',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  blueprintPanel: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(89, 169, 203, 0.3)',
    borderRadius: 18,
    backgroundColor: 'rgba(2, 15, 29, 0.74)',
  },
  blueprintGlow: {
    position: 'absolute',
    width: '72%',
    height: 90,
    bottom: -42,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 157, 197, 0.18)',
  },
  blueprintImage: {
    width: '100%',
    height: 190,
    opacity: 0.96,
  },
  resultHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#A9D5E3',
    borderRadius: 22,
    backgroundColor: '#0B2B4E',
    experimental_backgroundImage:
      'linear-gradient(135deg, #0A2443 0%, #0D4568 100%)',
  },
  resultHeroCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  resultStatusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(133, 220, 235, 0.35)',
    borderRadius: 999,
    backgroundColor: 'rgba(37, 130, 164, 0.28)',
  },
  resultStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#72D1C0',
  },
  resultStatusBadgeText: {
    color: '#D6F5F5',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
  },
  resultHeroTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  resultHeroMessage: {
    maxWidth: 760,
    color: '#C5D9E9',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  resultColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  resultPrimaryColumn: {
    flexGrow: 1,
    flexBasis: 680,
    minWidth: 0,
    gap: spacing.lg,
  },
  resultSecondaryColumn: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 280,
    gap: spacing.md,
  },
  summaryCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(91, 177, 214, 0.24)',
    borderRadius: 20,
    backgroundColor: 'rgba(5, 25, 45, 0.76)',
    gap: spacing.xs,
  },
  resultKicker: {
    color: '#65D3F1',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.9,
  },
  summaryTitle: {
    color: '#F2F9FE',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  summaryText: {
    color: '#A5BACB',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  visualAnalysisCard: {
    width: '100%',
    overflow: 'hidden',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(80, 202, 235, 0.34)',
    borderRadius: 22,
    backgroundColor: 'rgba(5, 38, 63, 0.74)',
    gap: spacing.md,
    shadowColor: '#22BEE9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
  },
  visualAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  visualAnalysisHeading: {
    flex: 1,
    minWidth: 180,
    gap: 2,
  },
  visualAnalysisTitle: {
    color: '#F2FAFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  photoAnalyzedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'rgba(87, 206, 236, 0.46)',
    borderRadius: 999,
    backgroundColor: 'rgba(7, 48, 76, 0.82)',
  },
  photoAnalyzedDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#257CAB',
  },
  photoAnalyzedBadgeText: {
    color: '#BEEFFD',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  visualAnalysisContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  visualAnalysisImage: {
    width: 168,
    height: 126,
    borderWidth: 1,
    borderColor: 'rgba(95, 198, 228, 0.4)',
    borderRadius: 17,
    backgroundColor: '#081D31',
  },
  visualAnalysisCopy: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  usefulImageBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(90, 205, 157, 0.52)',
    borderRadius: 999,
    backgroundColor: 'rgba(21, 91, 66, 0.46)',
  },
  usefulImageBadgeText: {
    color: '#8DE1BB',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  visualAnalysisObservations: {
    color: '#A8BECE',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  resultMetric: {
    position: 'relative',
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 170,
    overflow: 'hidden',
    padding: spacing.md,
    paddingTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(97, 172, 207, 0.24)',
    borderRadius: 18,
    backgroundColor: 'rgba(5, 25, 44, 0.78)',
    gap: spacing.xs,
  },
  resultMetricCalm: {
    borderColor: 'rgba(80, 192, 145, 0.42)',
    backgroundColor: 'rgba(15, 70, 53, 0.42)',
  },
  resultMetricWarning: {
    borderColor: 'rgba(226, 176, 74, 0.48)',
    backgroundColor: 'rgba(91, 61, 12, 0.42)',
  },
  resultMetricDanger: {
    borderColor: 'rgba(235, 107, 103, 0.5)',
    backgroundColor: 'rgba(91, 28, 35, 0.46)',
  },
  metricAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#7394B2',
  },
  metricAccentCalm: {
    backgroundColor: '#3E9B79',
  },
  metricAccentWarning: {
    backgroundColor: '#C58B2A',
  },
  metricAccentDanger: {
    backgroundColor: '#C9574D',
  },
  resultMetricLabel: {
    color: '#94AFC2',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  resultMetricValue: {
    color: '#EAF6FC',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  resultMetricValueCalm: {
    color: '#82DCB1',
  },
  resultMetricValueWarning: {
    color: '#F2CD7E',
  },
  resultMetricValueDanger: {
    color: '#FFAAA5',
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(230, 180, 81, 0.5)',
    borderRadius: 18,
    backgroundColor: 'rgba(91, 60, 10, 0.46)',
  },
  safetyBoxCritical: {
    borderColor: 'rgba(239, 105, 101, 0.58)',
    backgroundColor: 'rgba(98, 27, 34, 0.5)',
  },
  safetyIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(194, 133, 28, 0.42)',
  },
  safetyIconCritical: {
    backgroundColor: 'rgba(187, 58, 61, 0.46)',
  },
  safetyIconText: {
    color: '#FFE0A0',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  safetyIconTextCritical: {
    color: '#FFD0CC',
  },
  safetyCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  safetyTitle: {
    color: '#F7D58E',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  safetyTitleCritical: {
    color: '#FFB2AD',
  },
  safetyText: {
    color: '#EBCB8D',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  safetyTextCritical: {
    color: '#FFC0BC',
    fontWeight: typography.fontWeight.semiBold,
  },
  recommendationBox: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(82, 191, 225, 0.3)',
    borderRadius: 22,
    backgroundColor: 'rgba(5, 34, 56, 0.76)',
    gap: spacing.md,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recommendationTitle: {
    marginTop: 2,
    color: '#F3FAFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  recommendationMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#0B6C9F',
  },
  recommendationMarkText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  catalogSkeleton: {
    minHeight: 78,
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: 'rgba(60, 142, 182, 0.12)',
    gap: spacing.sm,
  },
  catalogSkeletonLineWide: {
    width: '68%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 184, 220, 0.2)',
  },
  catalogSkeletonLineShort: {
    width: '38%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 184, 220, 0.14)',
  },
  serviceRecommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(98, 184, 218, 0.28)',
    borderRadius: 18,
    backgroundColor: 'rgba(3, 19, 35, 0.72)',
  },
  recommendationIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(17, 90, 128, 0.56)',
  },
  recommendationIconText: {
    color: '#83DDF3',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  recommendationCardCopy: {
    flex: 1,
    gap: 2,
  },
  recommendationCardLabel: {
    color: '#83A9BE',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  recommendationCardName: {
    color: '#F3FAFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  workshopsTitle: {
    color: '#B8CEDC',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  workshopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  workshopCard: {
    flexGrow: 1,
    flexBasis: 210,
    minWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(91, 176, 211, 0.26)',
    borderRadius: 16,
    backgroundColor: 'rgba(3, 18, 34, 0.68)',
  },
  workshopIndex: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(13, 91, 130, 0.58)',
  },
  workshopIndexText: {
    color: '#79D8F0',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  workshopName: {
    flex: 1,
    color: '#DDECF5',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  workshopSkeleton: {
    flexGrow: 1,
    flexBasis: 210,
    minWidth: 190,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(83, 164, 201, 0.14)',
  },
  catalogUnavailableText: {
    color: '#829CAF',
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  savBox: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(91, 176, 211, 0.25)',
    borderRadius: 20,
    backgroundColor: 'rgba(5, 24, 43, 0.74)',
    gap: spacing.md,
  },
  savHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  savIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#0A5887',
  },
  savIconText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  savHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  savTitle: {
    color: '#F0F8FD',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  savText: {
    color: '#9EB4C7',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  professionalNotice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(72, 190, 219, 0.28)',
    borderRadius: 18,
    backgroundColor: 'rgba(5, 43, 65, 0.62)',
    gap: spacing.xs,
  },
  professionalNoticeTitle: {
    color: '#CAF0FA',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  professionalNoticeText: {
    color: '#92B1C3',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  photoSuggestionBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(91, 177, 213, 0.26)',
    borderRadius: 18,
    backgroundColor: 'rgba(4, 22, 40, 0.72)',
    gap: spacing.xs,
  },
  photoSuggestionTitle: {
    color: '#9EDCF0',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  photoSuggestionText: {
    color: '#9DB4C7',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  outOfScopeCard: {
    alignItems: 'flex-start',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(91, 183, 220, 0.28)',
    borderRadius: 22,
    backgroundColor: 'rgba(5, 26, 46, 0.84)',
    gap: spacing.lg,
  },
  outOfScopeOrb: {
    alignSelf: 'center',
    padding: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#0A2949',
  },
  outOfScopeCopy: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultStatusBadgeMuted: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(101, 180, 213, 0.3)',
    borderRadius: 999,
    backgroundColor: 'rgba(4, 22, 40, 0.76)',
  },
  resultStatusBadgeMutedText: {
    color: '#92BED1',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.7,
  },
  outOfScopeTitle: {
    color: '#F2F9FE',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  outOfScopeText: {
    maxWidth: 720,
    color: '#9EB4C7',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    textAlign: 'center',
  },
  submitErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 111, 107, 0.52)',
    borderRadius: 18,
    backgroundColor: 'rgba(91, 25, 33, 0.56)',
  },
  errorIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(187, 54, 59, 0.48)',
  },
  errorIconText: {
    color: '#FFD0CD',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  errorCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  submitErrorTitle: {
    color: '#FFB1AC',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  submitErrorText: {
    color: '#F1B7B3',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  emptyPanel: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(91, 177, 213, 0.24)',
    borderRadius: 20,
    backgroundColor: 'rgba(5, 24, 43, 0.72)',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: '#F2F9FE',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  emptyText: {
    color: '#9EB4C7',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  bookingWelcome: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(54, 192, 233, 0.34)',
    borderRadius: 24,
    backgroundColor: 'rgba(3, 22, 40, 0.9)',
    gap: spacing.lg,
  },
  bookingWelcomeTitle: {
    maxWidth: 780,
    color: '#F4FAFE',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: typography.fontWeight.bold,
  },
  bookingWelcomeGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  bookingWelcomeCard: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(70, 151, 188, 0.4)',
    borderRadius: 20,
    backgroundColor: 'rgba(4, 28, 49, 0.82)',
  },
  bookingWelcomeCardHovered: {
    borderColor: '#4FD5F6',
    backgroundColor: 'rgba(7, 58, 87, 0.84)',
  },
  bookingWelcomeCardMark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#087FBD',
  },
  bookingWelcomeCardMarkText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  bookingWelcomeCardTitle: {
    color: '#F0F9FD',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  bookingWelcomeCardText: {
    flex: 1,
    color: '#A5BACB',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  bookingWelcomeCardLink: {
    color: '#66DDF8',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  manualJourney: {
    width: '100%',
    gap: spacing.lg,
  },
  manualNeedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  manualNeedCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 240,
    minWidth: 210,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(70, 151, 188, 0.35)',
    borderRadius: 17,
    backgroundColor: 'rgba(4, 24, 43, 0.78)',
  },
  manualSelectionSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bookingShell: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(54, 192, 233, 0.34)',
    borderRadius: 24,
    backgroundColor: 'rgba(3, 22, 40, 0.9)',
    gap: spacing.lg,
    shadowColor: '#21BFEF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 4,
  },
  bookingShellNarrow: {
    padding: spacing.md,
    borderRadius: 20,
  },
  bookingSuccessShell: {
    alignItems: 'stretch',
    borderColor: 'rgba(79, 222, 182, 0.48)',
    backgroundColor: 'rgba(3, 38, 48, 0.92)',
  },
  bookingSuccessBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'rgba(88, 235, 190, 0.5)',
    borderRadius: 999,
    backgroundColor: 'rgba(20, 121, 100, 0.3)',
  },
  bookingSuccessBadgeText: {
    color: '#9AF2D2',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
  },
  bookingHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bookingHeaderCopy: {
    flex: 1,
    minWidth: 240,
    gap: spacing.xs,
  },
  bookingHeaderCopyNarrow: {
    width: '100%',
    minWidth: 0,
  },
  bookingKicker: {
    color: '#4CCFF2',
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.9,
  },
  bookingTitle: {
    color: '#F4FAFE',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.xl,
  },
  bookingLead: {
    color: '#A5BACB',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  bookingPendingBadge: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(85, 197, 228, 0.34)',
    borderRadius: 999,
    backgroundColor: 'rgba(7, 70, 101, 0.5)',
  },
  bookingPendingBadgeText: {
    color: '#B8E8F5',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  bookingProgress: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(82, 169, 207, 0.2)',
    borderRadius: 18,
    backgroundColor: 'rgba(2, 16, 31, 0.7)',
  },
  bookingProgressItem: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 13,
    backgroundColor: 'rgba(9, 34, 55, 0.46)',
  },
  bookingProgressItemNarrow: {
    minWidth: 0,
    flexBasis: '46%',
  },
  bookingProgressItemActive: {
    borderColor: 'rgba(51, 197, 239, 0.7)',
    backgroundColor: 'rgba(5, 78, 116, 0.48)',
  },
  bookingProgressItemComplete: {
    borderColor: 'rgba(61, 165, 201, 0.25)',
    backgroundColor: 'rgba(7, 47, 70, 0.56)',
  },
  bookingProgressIndex: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#17334D',
  },
  bookingProgressIndexHighlighted: {
    backgroundColor: '#168FC9',
  },
  bookingProgressIndexText: {
    color: '#86A0B5',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  bookingProgressIndexTextHighlighted: {
    color: '#FFFFFF',
  },
  bookingProgressLabel: {
    color: '#7891A7',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  bookingProgressLabelHighlighted: {
    color: '#DDF7FE',
  },
  bookingSection: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(62, 166, 207, 0.24)',
    borderRadius: 20,
    backgroundColor: 'rgba(4, 28, 49, 0.72)',
    gap: spacing.md,
  },
  bookingSectionNarrow: {
    padding: spacing.md,
    borderRadius: 17,
  },
  bookingConfirmationSection: {
    borderColor: 'rgba(58, 205, 238, 0.48)',
    backgroundColor: 'rgba(4, 37, 62, 0.82)',
  },
  bookingSectionKicker: {
    color: '#49C8EA',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
  },
  bookingSectionTitle: {
    color: '#EDF8FD',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  bookingSectionText: {
    color: '#96AEC1',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  bookingWorkshopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bookingWorkshopCard: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(70, 151, 188, 0.35)',
    borderRadius: 17,
    backgroundColor: 'rgba(4, 24, 43, 0.78)',
  },
  bookingCardNarrow: {
    width: '100%',
    minWidth: 0,
    flexBasis: '100%',
  },
  bookingWorkshopCardSelected: {
    borderColor: '#35C9F1',
    backgroundColor: 'rgba(7, 81, 118, 0.62)',
  },
  bookingWorkshopCardHovered: {
    borderColor: 'rgba(62, 203, 240, 0.68)',
    backgroundColor: 'rgba(7, 58, 87, 0.68)',
  },
  bookingSelectionDot: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#52768E',
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  bookingSelectionDotSelected: {
    borderWidth: 5,
    borderColor: '#8BE8FC',
    backgroundColor: '#087FB6',
  },
  bookingWorkshopCopy: {
    flex: 1,
    gap: 3,
  },
  bookingSmallLabel: {
    color: '#72BCD5',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingWorkshopName: {
    color: '#F0F9FD',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  bookingEmptyText: {
    color: '#A8BAC8',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  bookingModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bookingPeriodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bookingChoiceButton: {
    minWidth: 140,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(75, 157, 194, 0.38)',
    borderRadius: 14,
    backgroundColor: 'rgba(3, 23, 41, 0.78)',
  },
  bookingChoiceButtonSelected: {
    borderColor: '#36C7EF',
    backgroundColor: 'rgba(8, 100, 142, 0.6)',
  },
  bookingChoiceButtonHovered: {
    borderColor: 'rgba(65, 201, 237, 0.72)',
  },
  bookingChoiceButtonText: {
    color: '#9CB2C4',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  bookingChoiceButtonTextSelected: {
    color: '#E7FAFF',
  },
  bookingFieldLabel: {
    color: '#CAEAF4',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  bookingPrimaryAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(91, 219, 249, 0.62)',
    borderRadius: 15,
    backgroundColor: '#087FBD',
    shadowColor: '#2CC8F0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 3,
  },
  bookingPrimaryActionHovered: {
    backgroundColor: '#0A94D5',
    borderColor: '#9AEAFF',
  },
  bookingPrimaryActionText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  bookingSecondaryAction: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(76, 169, 205, 0.38)',
    borderRadius: 14,
    backgroundColor: 'rgba(3, 25, 44, 0.74)',
  },
  bookingSecondaryActionHovered: {
    borderColor: 'rgba(72, 204, 239, 0.72)',
    backgroundColor: 'rgba(6, 53, 78, 0.76)',
  },
  bookingSecondaryActionText: {
    color: '#B8D9E7',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  bookingExpansionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(73, 166, 202, 0.2)',
  },
  bookingExpansionAction: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 250,
    minWidth: 220,
    minHeight: 82,
    justifyContent: 'center',
    gap: 5,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(76, 169, 205, 0.38)',
    borderRadius: 15,
    backgroundColor: 'rgba(3, 25, 44, 0.74)',
  },
  bookingExpansionActionHovered: {
    borderColor: 'rgba(72, 204, 239, 0.72)',
    backgroundColor: 'rgba(6, 53, 78, 0.76)',
  },
  bookingExpansionActionLabel: {
    color: '#DDF7FE',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  bookingExpansionActionSubtitle: {
    color: '#7FB5C9',
    fontSize: typography.fontSize.xs,
    textTransform: 'capitalize',
  },
  bookingDayNavigation: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bookingDayNavigationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bookingDayDate: {
    color: '#62D8F5',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'capitalize',
  },
  bookingDayGroups: {
    gap: spacing.md,
  },
  bookingDayGroup: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(67, 168, 207, 0.28)',
    borderRadius: 17,
    backgroundColor: 'rgba(2, 20, 36, 0.68)',
  },
  bookingDayGroupHeader: {
    gap: 4,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(77, 166, 199, 0.2)',
  },
  bookingDayShowroom: {
    color: '#80AFC1',
    fontSize: typography.fontSize.xs,
  },
  bookingTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bookingTimeChip: {
    minWidth: 78,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: 'rgba(79, 171, 205, 0.42)',
    borderRadius: 12,
    backgroundColor: 'rgba(4, 31, 51, 0.86)',
  },
  bookingTimeChipHovered: {
    borderColor: '#60D8F5',
    backgroundColor: 'rgba(7, 67, 96, 0.86)',
  },
  bookingTimeChipSelected: {
    borderColor: '#8CEBFC',
    backgroundColor: '#087FB8',
  },
  bookingTimeChipText: {
    color: '#CDEAF3',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  bookingTimeChipTextSelected: {
    color: '#FFFFFF',
  },
  bookingAlternativeNotice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 181, 80, 0.38)',
    borderRadius: 14,
    backgroundColor: 'rgba(102, 67, 14, 0.28)',
  },
  bookingAlternativeText: {
    color: '#F4D89B',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  bookingOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  bookingOptionCard: {
    flex: 1,
    minWidth: 260,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(66, 157, 196, 0.35)',
    borderRadius: 18,
    backgroundColor: 'rgba(2, 20, 36, 0.84)',
    gap: spacing.sm,
  },
  bookingOptionCardSelected: {
    borderColor: '#43D1F3',
    backgroundColor: 'rgba(6, 69, 101, 0.72)',
  },
  bookingOptionCardHovered: {
    borderColor: 'rgba(87, 213, 244, 0.76)',
    backgroundColor: 'rgba(5, 48, 73, 0.78)',
  },
  bookingOptionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bookingOptionDate: {
    flex: 1,
    color: '#DDF5FC',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textTransform: 'capitalize',
  },
  bookingAvailableBadge: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(79, 230, 180, 0.42)',
    borderRadius: 999,
    backgroundColor: 'rgba(18, 122, 91, 0.28)',
  },
  bookingAvailableBadgeText: {
    color: '#8BE9C7',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  bookingExpiredBadge: {
    borderColor: 'rgba(235, 123, 116, 0.42)',
    backgroundColor: 'rgba(121, 43, 45, 0.32)',
  },
  bookingExpiredBadgeText: {
    color: '#F5A7A2',
  },
  bookingOptionTime: {
    color: '#5ADAF8',
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
  },
  bookingOptionService: {
    color: '#EAF8FD',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  bookingDetailLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(91, 157, 184, 0.14)',
  },
  bookingDetailLabel: {
    color: '#7894A8',
    fontSize: typography.fontSize.xs,
  },
  bookingDetailValue: {
    flex: 1,
    color: '#C7DDE8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'right',
  },
  bookingExpiredText: {
    color: '#F1A5A0',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  bookingSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bookingSummaryItem: {
    flex: 1,
    minWidth: 190,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(76, 166, 201, 0.24)',
    borderRadius: 14,
    backgroundColor: 'rgba(2, 19, 34, 0.58)',
    gap: 4,
  },
  bookingSummaryLabel: {
    color: '#7898AD',
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bookingSummaryValue: {
    color: '#EDF9FD',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  bookingProblemSummary: {
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#31BEE9',
    borderRadius: 12,
    backgroundColor: 'rgba(3, 24, 42, 0.65)',
    gap: spacing.xs,
  },
  bookingProblemSummaryText: {
    color: '#C4D8E3',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  bookingFutureStatus: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(75, 196, 224, 0.28)',
    borderRadius: 14,
    backgroundColor: 'rgba(6, 64, 88, 0.38)',
  },
  bookingFutureStatusText: {
    color: '#B9E8F3',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.5,
  },
});
