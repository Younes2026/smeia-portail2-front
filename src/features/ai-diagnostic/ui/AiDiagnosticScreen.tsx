import { useMemo, useRef, useState } from 'react';
import {
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
  AiDiagnosticOutputUrgencyLevel,
  AiDiagnosticQuestion,
  AiDiagnosticResult,
} from '@/core/api/ai-diagnostics.api';
import { HttpError } from '@/core/api/http-client';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useAnalyzeAiDiagnostic } from '@/features/ai-diagnostic/hooks/useAnalyzeAiDiagnostic';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';
import { useAuthStore } from '@/store/auth.store';

const MAX_DESCRIPTION_LENGTH = 3_000;
const MAX_ANSWER_LENGTH = 1_000;
const MAX_ANSWERS = 5;

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

function formatWorkshopIds(ids: readonly number[]): string {
  const labels = ids.map((id) => `atelier n°${id}`);

  if (labels.length === 0) {
    return 'Aucun atelier proposé';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`;
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
  const vehiclesQuery = useVehicles();
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
    analyzeDiagnostic.reset();
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
        photo: null,
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
        <View style={[styles.header, isNarrow && styles.headerNarrow]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{clientName}</Text>
            <Text style={styles.title}>Assistant IA SAV</Text>
            <Text style={styles.subtitle}>
              Obtenez une orientation et un pré-diagnostic indicatif avant un
              contrôle par un professionnel SMEIA.
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Assistant de pré-diagnostic</Text>
          </View>
        </View>

        <View style={[styles.workflowGrid, isNarrow && styles.stack]}>
          <View style={[styles.mainPanel, isNarrow && styles.panelNarrow]}>
            {journeyStep === 'initial' ? (
              <InitialStep
                description={description}
                errors={initialFormErrors}
                isPending={isPending}
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
              <DiagnosticResultPanel result={result} onReset={resetJourney} />
            ) : null}

            {analysisError ? (
              <View style={styles.submitErrorBox}>
                <Text style={styles.submitErrorTitle}>Analyse impossible</Text>
                <Text style={styles.submitErrorText}>{analysisError}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.sidePanel, isNarrow && styles.panelNarrow]}>
            <JourneyAside
              accumulatedAnswerCount={accumulatedAnswers.length}
              isPending={isPending}
              journeyStep={journeyStep}
              selectedVehicle={selectedVehicle}
            />
          </View>
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
  onSubmit: () => void;
  onVehicleSelect: (vehicleId: number) => void;
  selectedVehicleId: number | null;
  vehicles: VehicleListItem[];
};

function InitialStep({
  description,
  errors,
  isPending,
  onDescriptionBlur,
  onDescriptionChange,
  onSubmit,
  onVehicleSelect,
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
          {isPending ? 'Analyse en cours...' : 'Analyser ma demande'}
        </Text>
      </Pressable>
    </>
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
        <View style={styles.submitErrorBox}>
          <Text style={styles.submitErrorTitle}>Analyse à reprendre</Text>
          <Text style={styles.submitErrorText}>{blockMessage}</Text>
        </View>
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
              {isPending ? 'Analyse en cours...' : "Continuer l'analyse"}
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
  result: AiDiagnosticResult;
  onReset: () => void;
};

function DiagnosticResultPanel({
  result,
  onReset,
}: DiagnosticResultPanelProps) {
  if (result.diagnosis_status === 'out_of_scope') {
    return (
      <>
        <SectionIntro
          kicker="Demande hors périmètre"
          title="Une autre prise en charge est recommandée"
          text={result.client_message}
        />
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
      </>
    );
  }

  const requiresStrongWarning =
    result.urgency_level === 'critical' ||
    result.driving_advice === 'do_not_drive';

  return (
    <>
      <SectionIntro
        kicker="Pré-diagnostic indicatif"
        title="Orientation proposée"
        text={result.client_message}
      />

      <View style={styles.resultSection}>
        <Text style={styles.resultLabel}>Résumé du problème</Text>
        <Text style={styles.resultText}>{result.problem_summary}</Text>
      </View>

      <View style={styles.resultGrid}>
        <ResultMetric
          emphasized={result.urgency_level === 'critical'}
          label="Niveau d'urgence"
          value={urgencyLabels[result.urgency_level]}
        />
        <ResultMetric
          emphasized={result.driving_advice === 'do_not_drive'}
          label="Conseil de conduite"
          value={drivingAdviceLabels[result.driving_advice]}
        />
        <ResultMetric
          label="Niveau de confiance"
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
      ) : null}

      <View style={styles.recommendationBox}>
        <Text style={styles.resultLabel}>Recommandation de contrôle</Text>
        <Text style={styles.resultText}>
          Service recommandé :{' '}
          {result.suggested_service_type_id === null
            ? 'à confirmer avec le SAV'
            : `service n°${result.suggested_service_type_id}`}
        </Text>
        <Text style={styles.resultText}>
          Ateliers proposés :{' '}
          {formatWorkshopIds(result.suggested_workshop_ids)}
        </Text>
      </View>

      <OptionalPhotoSuggestion result={result} />

      <View style={styles.savBox}>
        <Text style={styles.savTitle}>Résumé destiné au SAV</Text>
        <Text style={styles.savText}>{result.sav_notes}</Text>
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
    return (
      <>
        <Text style={styles.sidePanelTitle}>Analyse en cours</Text>
        <Text style={styles.sidePanelText}>
          Votre demande est en cours d'analyse. Ne fermez pas cet écran et
          évitez un second envoi.
        </Text>
        <View style={styles.loadingBox}>
          <LoadingState message="Préparation du pré-diagnostic..." />
        </View>
      </>
    );
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

function ResultMetric({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.resultMetric, emphasized && styles.resultMetricStrong]}>
      <Text style={styles.resultMetricLabel}>{label}</Text>
      <Text
        style={[
          styles.resultMetricValue,
          emphasized && styles.resultMetricValueStrong,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
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
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 999,
    backgroundColor: '#EDF5FD',
  },
  statusBadgeText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
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
    flex: 1.35,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },
  sidePanel: {
    flex: 1,
    minWidth: 300,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
    shadowColor: '#071832',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.06,
    shadowRadius: 26,
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
  vehicleCard: {
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },
  vehicleCardActive: {
    borderColor: '#0F4C9A',
    backgroundColor: '#F1F6FD',
  },
  vehicleCardHovered: {
    borderColor: '#B8C9DF',
    transform: [{ translateY: -1 }],
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  vehicleBrand: {
    flex: 1,
    color: '#1E5AA8',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleModel: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  vehicleMeta: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  registrationBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#CBD8EA',
    borderRadius: 999,
    backgroundColor: '#F4F8FD',
  },
  registrationText: {
    color: '#10243F',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  formSection: {
    gap: spacing.md,
  },
  questionsList: {
    gap: spacing.lg,
  },
  questionField: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 16,
    backgroundColor: '#FBFCFE',
  },
  questionNumber: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  fieldLabel: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
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
  problemInput: {
    minHeight: 126,
  },
  answerInput: {
    minHeight: 88,
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
  fieldError: {
    flex: 1,
    color: '#B42318',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  fieldHint: {
    flex: 1,
    color: '#657386',
    fontSize: typography.fontSize.xs,
  },
  characterCount: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
  },
  choiceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceButton: {
    minHeight: 44,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#CBD8EA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  choiceButtonSelected: {
    borderColor: '#0F4C9A',
    backgroundColor: '#EDF5FD',
  },
  choiceButtonHovered: {
    borderColor: '#8EAED3',
  },
  choiceButtonText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  choiceButtonTextSelected: {
    color: '#0F4C9A',
  },
  answerCount: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    shadowColor: '#0F4C9A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
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
  sidePanelTitle: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  sidePanelText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  loadingBox: {
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  progressBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 16,
    backgroundColor: '#F6F9FD',
    gap: spacing.xs,
  },
  progressValue: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  selectedVehicleText: {
    color: '#10243F',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  previewLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  disclaimerBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 16,
    backgroundColor: '#EDF5FD',
    gap: spacing.xs,
  },
  disclaimerTitle: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  disclaimerText: {
    color: '#315E8F',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  resultSection: {
    gap: spacing.sm,
  },
  resultLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  resultText: {
    color: '#10243F',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  resultMetric: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 16,
    backgroundColor: '#F6F9FD',
    gap: spacing.xs,
  },
  resultMetricStrong: {
    borderColor: '#D99A96',
    backgroundColor: '#FFF3F2',
  },
  resultMetricLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  resultMetricValue: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  resultMetricValueStrong: {
    color: '#B42318',
  },
  safetyBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E5C27A',
    borderRadius: 16,
    backgroundColor: '#FFF9E8',
    gap: spacing.xs,
  },
  safetyBoxCritical: {
    borderColor: '#D99A96',
    backgroundColor: '#FFF3F2',
  },
  safetyTitle: {
    color: '#8A5B00',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  safetyTitleCritical: {
    color: '#B42318',
  },
  safetyText: {
    color: '#704A00',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  safetyTextCritical: {
    color: '#8F2D24',
    fontWeight: typography.fontWeight.semiBold,
  },
  recommendationBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 16,
    backgroundColor: '#F4F8FD',
    gap: spacing.sm,
  },
  photoSuggestionBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  photoSuggestionTitle: {
    color: '#315E8F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  photoSuggestionText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  savBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#C7D4E5',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    gap: spacing.xs,
  },
  savTitle: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  savText: {
    color: '#526174',
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
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.5,
  },
});
