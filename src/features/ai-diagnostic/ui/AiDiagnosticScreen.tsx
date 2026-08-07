import { useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
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
  AiDiagnosticAnswer,
  AiDiagnosticConfidence,
  AiDiagnosticDrivingAdvice,
  AiDiagnosticPhoto,
  AiDiagnosticOutputUrgencyLevel,
  AiDiagnosticQuestion,
  AiDiagnosticResult,
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

type InitialFormErrors = {
  vehicle?: string;
  description?: string;
};

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'client SMEIA';
}

function getQuestionKey(question: AiDiagnosticQuestion, index: number): string {
  return `${question.id}:${index}`;
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

export function AiDiagnosticScreen() {
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
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [flowBlockMessage, setFlowBlockMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<AiDiagnosticResult | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedAiPhoto | null>(
    null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
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
    analyzeDiagnostic.reset();
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
      const answer = (answerDrafts[key] ?? '').trim();

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
          <View pointerEvents="none" style={styles.heroHaloLarge} />
          <View pointerEvents="none" style={styles.heroHaloSmall} />
          <View pointerEvents="none" style={styles.heroRoadLine} />

          <View style={styles.heroCopy}>
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

          <View style={styles.heroOrb}>
            <IntelligenceOrb size={isNarrow ? 142 : 190} />
          </View>
        </View>

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
                onAnswerChange={(key, value) => {
                  setAnswerDrafts((current) => ({
                    ...current,
                    [key]: value,
                  }));
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
                isServiceTypesLoading={serviceTypesQuery.isLoading}
                isWorkshopsLoading={workshopsQuery.isLoading}
                onReset={resetJourney}
                photo={selectedPhoto}
                result={result}
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
      </ScrollView>
    </ClientPortalLayout>
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
          placeholderTextColor="#8A97A8"
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
  answerDrafts: Record<string, string>;
  answerErrors: Record<string, string>;
  blockMessage: string | null;
  isPending: boolean;
  message: string;
  onAnswerChange: (key: string, value: string) => void;
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
  onAnswerChange,
  onReset,
  onSubmit,
  questions,
}: QuestionsStepProps) {
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
                answer={answerDrafts[key] ?? ''}
                disabled={isPending}
                error={answerErrors[key]}
                index={index}
                onChange={(value) => {
                  onAnswerChange(key, value);
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
            disabled={isPending}
            onPress={onSubmit}
            style={({ hovered, pressed }) => [
              styles.primaryAction,
              hovered && !isPending && styles.primaryActionHovered,
              pressed && !isPending && styles.pressed,
              isPending && styles.disabled,
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
  answer: string;
  disabled: boolean;
  error?: string;
  index: number;
  onChange: (answer: string) => void;
  question: AiDiagnosticQuestion;
};

function DynamicQuestionField({
  answer,
  disabled,
  error,
  index,
  onChange,
  question,
}: DynamicQuestionFieldProps) {
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
            const selected = answer === choice;

            return (
              <Pressable
                key={choice}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                onPress={() => {
                  onChange(choice);
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
      ) : (
        <TextInput
          accessibilityLabel={question.text}
          editable={!disabled}
          maxLength={MAX_ANSWER_LENGTH}
          multiline
          onChangeText={onChange}
          placeholder="Votre réponse..."
          placeholderTextColor="#8A97A8"
          style={[
            styles.input,
            styles.answerInput,
            error ? styles.inputError : null,
          ]}
          textAlignVertical="top"
          value={answer}
        />
      )}

      <View style={styles.inputMetaRow}>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
            {error}
          </Text>
        ) : (
          <Text style={styles.fieldHint}>Réponse obligatoire</Text>
        )}
        {choices.length === 0 ? (
          <Text style={styles.characterCount}>
            {answer.length}/{MAX_ANSWER_LENGTH}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type DiagnosticResultPanelProps = {
  isServiceTypesLoading: boolean;
  isWorkshopsLoading: boolean;
  photo: SelectedAiPhoto | null;
  result: AiDiagnosticResult;
  serviceTypes: readonly DictionaryItem[];
  workshops: readonly Workshop[];
  onReset: () => void;
};

function DiagnosticResultPanel({
  isServiceTypesLoading,
  isWorkshopsLoading,
  photo,
  result,
  serviceTypes,
  workshops,
  onReset,
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
    </>
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
            {selectedVehicle.brandName} {selectedVehicle.model}
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
    <View style={styles.submitErrorBox}>
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
        <Text style={styles.vehicleBrand}>{vehicle.brandName}</Text>
        <View style={styles.registrationBadge}>
          <Text style={styles.registrationText}>
            {vehicle.registrationNumber}
          </Text>
        </View>
      </View>
      <Text style={styles.vehicleModel}>{vehicle.model}</Text>
      <Text style={styles.vehicleMeta}>
        {vehicle.year} · {vehicle.mileage}
      </Text>
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
  },
  contentScroll: {
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
  heroNarrow: {
    minHeight: 470,
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
    maxWidth: 760,
    alignItems: 'flex-start',
    gap: spacing.sm,
    zIndex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: '#DFE7F1',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    gap: spacing.lg,
    shadowColor: '#102A4D',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
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
    borderColor: '#DDE6F1',
    borderRadius: 24,
    backgroundColor: 'rgba(250, 252, 255, 0.96)',
    gap: spacing.md,
    shadowColor: '#102A4D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },
  sectionIntro: {
    gap: spacing.xs,
  },
  sectionKicker: {
    color: '#2B6BAA',
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#091E39',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.3,
  },
  sectionText: {
    color: '#52657A',
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
    borderColor: '#DFE7F1',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
    shadowColor: '#102A4D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
  },
  vehicleCardActive: {
    borderColor: '#3E86BD',
    backgroundColor: '#EFF8FC',
    shadowColor: '#2A78AE',
    shadowOpacity: 0.11,
  },
  vehicleCardHovered: {
    borderColor: '#9BC1DA',
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
    color: '#2B6BAA',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleModel: {
    color: '#091E39',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleMeta: {
    color: '#5A6D82',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  registrationBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#CADAEA',
    borderRadius: 999,
    backgroundColor: '#F5F8FC',
  },
  registrationText: {
    color: '#193653',
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
    borderColor: '#CFDAE7',
    borderRadius: 14,
    backgroundColor: '#FBFCFE',
    color: '#091E39',
    fontSize: typography.fontSize.md,
  },
  problemInput: {
    minHeight: 150,
  },
  answerInput: {
    minHeight: 96,
  },
  inputError: {
    borderColor: '#B42318',
  },
  inputMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fieldLabel: {
    color: '#152F4D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  fieldError: {
    flex: 1,
    color: '#B42318',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  fieldHint: {
    flex: 1,
    color: '#6A7B8E',
    fontSize: typography.fontSize.xs,
  },
  characterCount: {
    color: '#6A7B8E',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
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
    borderColor: '#83B8D4',
    borderRadius: 20,
    backgroundColor: '#F2F9FC',
  },
  photoDropZoneHovered: {
    borderColor: '#2D78AD',
    backgroundColor: '#EAF6FB',
    transform: [{ translateY: -1 }],
  },
  photoGlyph: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#155C9B',
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
    color: '#0B3158',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  photoOptionalText: {
    color: '#4B657D',
    fontSize: typography.fontSize.sm,
  },
  photoFormatsText: {
    color: '#718295',
    fontSize: typography.fontSize.xs,
  },
  photoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#B9D8E6',
    borderRadius: 20,
    backgroundColor: '#F5FBFD',
  },
  photoPreview: {
    width: 112,
    height: 84,
    borderRadius: 14,
    backgroundColor: '#DCEAF2',
  },
  photoPreviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  photoFileName: {
    color: '#0B2746',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  photoFileSize: {
    color: '#60758A',
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
    borderColor: '#2B78AD',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  photoActionHovered: {
    backgroundColor: '#EAF6FB',
  },
  photoSecondaryActionText: {
    color: '#175F94',
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
    borderColor: '#D7A6A2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  photoRemoveActionHovered: {
    backgroundColor: '#FFF1F0',
  },
  photoRemoveActionText: {
    color: '#A3342D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#CBE4ED',
    borderRadius: 18,
    backgroundColor: '#F0F9FC',
  },
  privacyIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#155C9B',
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
    color: '#164E72',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  privacyText: {
    color: '#486D82',
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
    borderColor: '#DCE6F0',
    borderRadius: 20,
    backgroundColor: '#F9FBFD',
    shadowColor: '#102A4D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
  },
  questionNumber: {
    alignSelf: 'flex-start',
    color: '#2B6BAA',
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
    borderColor: '#C8D7E6',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  choiceButtonSelected: {
    borderColor: '#2E78B1',
    backgroundColor: '#EAF6FB',
  },
  choiceButtonHovered: {
    borderColor: '#83B7D6',
  },
  choiceButtonText: {
    color: '#53677D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  choiceButtonTextSelected: {
    color: '#155C9B',
  },
  answerCount: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#EEF4F9',
    color: '#567087',
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
    borderColor: '#1D70A9',
    borderRadius: 15,
    backgroundColor: '#155C9B',
    experimental_backgroundImage:
      'linear-gradient(135deg, #155C9B 0%, #1878AA 100%)',
    shadowColor: '#155C9B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  primaryActionHovered: {
    backgroundColor: '#0D4D87',
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
    borderColor: '#C7D6E5',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  secondaryActionHovered: {
    borderColor: '#9DBBD2',
    backgroundColor: '#F3F8FC',
  },
  secondaryActionText: {
    color: '#173957',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  sidePanelTitle: {
    color: '#0A213C',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  sidePanelText: {
    color: '#53677D',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  progressBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D5E4EF',
    borderRadius: 18,
    backgroundColor: '#F1F7FB',
    gap: spacing.xs,
  },
  progressValue: {
    color: '#155C9B',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  selectedVehicleText: {
    color: '#102E4B',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  previewLabel: {
    color: '#667A8F',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  disclaimerBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#C8E0EA',
    borderRadius: 18,
    backgroundColor: '#EFF8FB',
    gap: spacing.xs,
  },
  disclaimerTitle: {
    color: '#155C77',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  disclaimerText: {
    color: '#496F82',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
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
    borderColor: '#DCE6F0',
    borderRadius: 20,
    backgroundColor: '#F9FBFD',
    gap: spacing.xs,
  },
  resultKicker: {
    color: '#2A6C9F',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.9,
  },
  summaryTitle: {
    color: '#0B2039',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  summaryText: {
    color: '#41586F',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  visualAnalysisCard: {
    width: '100%',
    overflow: 'hidden',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#A8D2E2',
    borderRadius: 22,
    backgroundColor: '#F0F8FB',
    gap: spacing.md,
    shadowColor: '#103957',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
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
    color: '#0A2947',
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
    borderColor: '#91C6D9',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  photoAnalyzedDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#257CAB',
  },
  photoAnalyzedBadgeText: {
    color: '#155C87',
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
    borderColor: '#C0D9E5',
    borderRadius: 17,
    backgroundColor: '#DCEAF2',
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
    borderColor: '#9DCDB9',
    borderRadius: 999,
    backgroundColor: '#EAF8F1',
  },
  usefulImageBadgeText: {
    color: '#287457',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  visualAnalysisObservations: {
    color: '#36556E',
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
    borderColor: '#D9E4EE',
    borderRadius: 18,
    backgroundColor: '#F5F8FB',
    gap: spacing.xs,
  },
  resultMetricCalm: {
    borderColor: '#B9DCCE',
    backgroundColor: '#F1FAF6',
  },
  resultMetricWarning: {
    borderColor: '#E8D19D',
    backgroundColor: '#FFF9EC',
  },
  resultMetricDanger: {
    borderColor: '#E5BBB7',
    backgroundColor: '#FFF5F4',
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
    color: '#60758A',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  resultMetricValue: {
    color: '#244766',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  resultMetricValueCalm: {
    color: '#27765A',
  },
  resultMetricValueWarning: {
    color: '#946111',
  },
  resultMetricValueDanger: {
    color: '#A83B34',
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E4CD98',
    borderRadius: 18,
    backgroundColor: '#FFF9EC',
  },
  safetyBoxCritical: {
    borderColor: '#E1B3AE',
    backgroundColor: '#FFF4F3',
  },
  safetyIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F5DFAD',
  },
  safetyIconCritical: {
    backgroundColor: '#F5D2CE',
  },
  safetyIconText: {
    color: '#805407',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  safetyIconTextCritical: {
    color: '#A83B34',
  },
  safetyCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  safetyTitle: {
    color: '#805407',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  safetyTitleCritical: {
    color: '#A83B34',
  },
  safetyText: {
    color: '#704A00',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  safetyTextCritical: {
    color: '#87352F',
    fontWeight: typography.fontWeight.semiBold,
  },
  recommendationBox: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#BDD8E6',
    borderRadius: 22,
    backgroundColor: '#F1F8FC',
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
    color: '#0B2945',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  recommendationMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#0C3156',
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
    backgroundColor: 'rgba(55, 117, 158, 0.08)',
    gap: spacing.sm,
  },
  catalogSkeletonLineWide: {
    width: '68%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(69, 122, 155, 0.16)',
  },
  catalogSkeletonLineShort: {
    width: '38%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(69, 122, 155, 0.12)',
  },
  serviceRecommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#C5DDE9',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  recommendationIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E6F4F9',
  },
  recommendationIconText: {
    color: '#155C9B',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  recommendationCardCopy: {
    flex: 1,
    gap: 2,
  },
  recommendationCardLabel: {
    color: '#658095',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  recommendationCardName: {
    color: '#0B2945',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  workshopsTitle: {
    color: '#34536D',
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
    borderColor: '#D3E1EA',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  workshopIndex: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#DCEEF5',
  },
  workshopIndexText: {
    color: '#155C9B',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  workshopName: {
    flex: 1,
    color: '#1C3E5B',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  workshopSkeleton: {
    flexGrow: 1,
    flexBasis: 210,
    minWidth: 190,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(69, 122, 155, 0.1)',
  },
  catalogUnavailableText: {
    color: '#667A8F',
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  savBox: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#D4DFEB',
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#102D4C',
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
    color: '#102E4B',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  savText: {
    color: '#53677D',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  professionalNotice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#CBE2EA',
    borderRadius: 18,
    backgroundColor: '#F0F9FB',
    gap: spacing.xs,
  },
  professionalNoticeTitle: {
    color: '#155C77',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  professionalNoticeText: {
    color: '#4B7082',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  photoSuggestionBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D4E2EC',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  photoSuggestionTitle: {
    color: '#315E8F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  photoSuggestionText: {
    color: '#53677D',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  outOfScopeCard: {
    alignItems: 'flex-start',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#C9DDE9',
    borderRadius: 22,
    backgroundColor: '#F4F9FC',
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
    borderColor: '#C6D9E5',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  resultStatusBadgeMutedText: {
    color: '#4F7088',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.7,
  },
  outOfScopeTitle: {
    color: '#0B2945',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  outOfScopeText: {
    maxWidth: 720,
    color: '#53677D',
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
    borderColor: '#E4BAB7',
    borderRadius: 18,
    backgroundColor: '#FFF5F4',
  },
  errorIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F5D5D2',
  },
  errorIconText: {
    color: '#A83B34',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  errorCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  submitErrorTitle: {
    color: '#A83B34',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  submitErrorText: {
    color: '#873C36',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  emptyPanel: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#D7E2ED',
    borderRadius: 20,
    backgroundColor: '#F9FBFD',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: '#0B2945',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  emptyText: {
    color: '#53677D',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.5,
  },
});
