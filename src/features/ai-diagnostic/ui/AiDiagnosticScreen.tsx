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

import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import type {
  AiDiagnosticAnswer,
  AiDiagnosticUrgencyLevel,
} from '@/core/api/ai-diagnostics.api';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useCreateAiDiagnostic } from '@/features/ai-diagnostic/hooks/useCreateAiDiagnostic';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';
import { useAuthStore } from '@/store/auth.store';

const simulatedQuestions = [
  'Depuis quand le symptôme apparaît-il ?',
  'Un voyant ou message est-il affiché au tableau de bord ?',
] as const;

const urgencyLabels: Record<AiDiagnosticUrgencyLevel, string> = {
  low: 'Faible',
  medium: 'Modérée',
  high: 'Élevée',
};

type GeneratedDiagnostic = {
  aiQuestions: string[];
  clientAnswers: AiDiagnosticAnswer[];
  problemSummary: string;
  urgencyLevel: AiDiagnosticUrgencyLevel;
  aiRecommendation: string;
};

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'client SMEIA';
}

function normalizeDiagnosticText(value: string): string {
  return value
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function inferUrgencyLevel(
  problemDescription: string,
  answers: string[]
): AiDiagnosticUrgencyLevel {
  const normalizedText = normalizeDiagnosticText(
    [problemDescription, ...answers].join(' ')
  );
  const highSignals = [
    'frein',
    'fumee',
    'surchauffe',
    'brule',
    'huile',
    'voyant rouge',
    'ne demarre plus',
    'perte totale',
  ];
  const mediumSignals = [
    'voyant',
    'bruit',
    'vibration',
    'perte de puissance',
    'batterie',
    'climatisation',
    'demarrage difficile',
  ];

  if (highSignals.some((signal) => normalizedText.includes(signal))) {
    return 'high';
  }

  if (mediumSignals.some((signal) => normalizedText.includes(signal))) {
    return 'medium';
  }

  return 'low';
}

function buildRecommendation(
  urgencyLevel: AiDiagnosticUrgencyLevel
): string {
  if (urgencyLevel === 'high') {
    return "Pré-diagnostic indicatif : évitez d'utiliser le véhicule si le symptôme persiste, surtout en cas de freinage anormal, surchauffe, fumée ou voyant rouge. Contactez rapidement un conseiller SMEIA pour confirmer le contrôle atelier.";
  }

  if (urgencyLevel === 'medium') {
    return "Pré-diagnostic indicatif : planifiez un passage atelier afin de contrôler le véhicule et limiter l'aggravation possible du symptôme. Cette estimation ne remplace pas le diagnostic d'un technicien SMEIA.";
  }

  return "Pré-diagnostic indicatif : le symptôme semble compatible avec une vérification de confort ou d'entretien, à confirmer par l'atelier SMEIA lors d'un contrôle.";
}

function createSimulatedDiagnostic(
  vehicle: VehicleListItem,
  problemDescription: string,
  firstAnswer: string,
  secondAnswer: string
): GeneratedDiagnostic {
  const answers = [firstAnswer.trim(), secondAnswer.trim()];
  const urgencyLevel = inferUrgencyLevel(problemDescription, answers);
  const clientAnswers = simulatedQuestions.map((question, index) => ({
    question,
    answer: answers[index] || 'Non renseigné',
  }));
  const vehicleLabel = `${vehicle.brandName} ${vehicle.model}`;
  const problemSummary = `Pré-diagnostic indicatif généré localement pour ${vehicleLabel} (${vehicle.registrationNumber}) : le client signale "${problemDescription.trim()}". Le symptôme est présent depuis "${clientAnswers[0].answer}" et l'information tableau de bord indiquée est "${clientAnswers[1].answer}". Niveau d'urgence estimé : ${urgencyLabels[urgencyLevel]}.`;

  return {
    aiQuestions: [...simulatedQuestions],
    clientAnswers,
    problemSummary,
    urgencyLevel,
    aiRecommendation: buildRecommendation(urgencyLevel),
  };
}

export function AiDiagnosticScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null
  );
  const [problemDescription, setProblemDescription] = useState('');
  const [firstAnswer, setFirstAnswer] = useState('');
  const [secondAnswer, setSecondAnswer] = useState('');
  const [generatedDiagnostic, setGeneratedDiagnostic] =
    useState<GeneratedDiagnostic | null>(null);
  const vehiclesQuery = useVehicles();
  const createAiDiagnostic = useCreateAiDiagnostic();
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
  const canSubmit =
    customer?.id !== undefined &&
    selectedVehicle !== null &&
    problemDescription.trim().length >= 10 &&
    firstAnswer.trim().length > 0 &&
    secondAnswer.trim().length > 0 &&
    !createAiDiagnostic.isPending &&
    !createAiDiagnostic.isSuccess;

  const resetForm = () => {
    setSelectedVehicleId(null);
    setProblemDescription('');
    setFirstAnswer('');
    setSecondAnswer('');
    setGeneratedDiagnostic(null);
    createAiDiagnostic.reset();
  };

  const handleSubmit = () => {
    if (!canSubmit || customer?.id === undefined || selectedVehicle === null) {
      return;
    }

    const diagnostic = createSimulatedDiagnostic(
      selectedVehicle,
      problemDescription,
      firstAnswer,
      secondAnswer
    );

    setGeneratedDiagnostic(diagnostic);
    createAiDiagnostic.mutate({
      customerId: customer.id,
      vehicleId: selectedVehicle.id,
      problemDescription,
      aiQuestions: diagnostic.aiQuestions,
      clientAnswers: diagnostic.clientAnswers,
      problemSummary: diagnostic.problemSummary,
      urgencyLevel: diagnostic.urgencyLevel,
      aiRecommendation: diagnostic.aiRecommendation,
    });
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
        showsVerticalScrollIndicator
      >
        <View style={[styles.header, isNarrow && styles.headerNarrow]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{clientName}</Text>
            <Text style={styles.title}>Assistant IA SAV</Text>
            <Text style={styles.subtitle}>
              Préparez un pré-diagnostic indicatif avant échange avec le
              conseiller atelier SMEIA.
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Simulation locale</Text>
          </View>
        </View>

        <View style={[styles.workflowGrid, isNarrow && styles.stack]}>
          <View style={styles.mainPanel}>
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
                    vehicle={vehicle}
                    onPress={() => {
                      setSelectedVehicleId(vehicle.id);
                      createAiDiagnostic.reset();
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

            <View style={styles.formSection}>
              <SectionIntro
                kicker="Étape 2"
                title="Description du problème"
                text="Décrivez le symptôme observé avec vos mots. Le résultat restera indicatif."
              />

              <TextInput
                accessibilityLabel="Description du problème"
                multiline
                numberOfLines={5}
                onChangeText={(value) => {
                  setProblemDescription(value);
                  createAiDiagnostic.reset();
                }}
                placeholder="Exemple : bruit au freinage, voyant moteur, vibration à l'accélération..."
                placeholderTextColor="#8A97A8"
                style={[styles.input, styles.problemInput]}
                textAlignVertical="top"
                value={problemDescription}
              />
            </View>

            <View style={styles.formSection}>
              <SectionIntro
                kicker="Étape 3"
                title="Questions complémentaires simulées"
                text="Ces questions sont générées localement pour enrichir le pré-diagnostic."
              />

              <QuestionField
                answer={firstAnswer}
                question={simulatedQuestions[0]}
                onChange={(value) => {
                  setFirstAnswer(value);
                  createAiDiagnostic.reset();
                }}
              />
              <QuestionField
                answer={secondAnswer}
                question={simulatedQuestions[1]}
                onChange={(value) => {
                  setSecondAnswer(value);
                  createAiDiagnostic.reset();
                }}
              />
            </View>

            <View style={[styles.actions, isNarrow && styles.stack]}>
              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={handleSubmit}
                style={({ hovered, pressed }) => [
                  styles.primaryAction,
                  hovered && canSubmit && styles.primaryActionHovered,
                  pressed && canSubmit && styles.pressed,
                  !canSubmit && styles.disabled,
                ]}
              >
                <Text style={styles.primaryActionText}>
                  {createAiDiagnostic.isPending
                    ? 'Envoi du pré-diagnostic...'
                    : createAiDiagnostic.isSuccess
                      ? 'Pré-diagnostic envoyé'
                      : 'Générer et envoyer'}
                </Text>
              </Pressable>

              {createAiDiagnostic.isSuccess ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={resetForm}
                  style={({ hovered, pressed }) => [
                    styles.secondaryAction,
                    hovered && styles.secondaryActionHovered,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryActionText}>
                    Nouveau pré-diagnostic
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sidePanel}>
            <Text style={styles.sidePanelTitle}>Prévisualisation</Text>
            <Text style={styles.sidePanelText}>
              Le résumé est généré dans le navigateur, puis enregistré dans
              Directus avec le statut initial défini côté backend.
            </Text>

            {generatedDiagnostic ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Urgence estimée</Text>
                <Text style={styles.previewUrgency}>
                  {urgencyLabels[generatedDiagnostic.urgencyLevel]}
                </Text>
                <Text style={styles.previewLabel}>Résumé indicatif</Text>
                <Text style={styles.previewText}>
                  {generatedDiagnostic.problemSummary}
                </Text>
                <Text style={styles.previewLabel}>Recommandation</Text>
                <Text style={styles.previewText}>
                  {generatedDiagnostic.aiRecommendation}
                </Text>
              </View>
            ) : (
              <View style={styles.previewEmpty}>
                <Text style={styles.previewEmptyText}>
                  Le résumé apparaîtra ici après génération.
                </Text>
              </View>
            )}

            {createAiDiagnostic.isPending ? (
              <View style={styles.loadingBox}>
                <LoadingState message="Création du diagnostic dans Directus..." />
              </View>
            ) : null}

            {createAiDiagnostic.isError ? (
              <View style={styles.submitErrorBox}>
                <Text style={styles.submitErrorTitle}>Envoi impossible</Text>
                <Text style={styles.submitErrorText}>
                  Impossible de créer le pré-diagnostic dans Directus. Vérifiez
                  les informations puis réessayez.
                </Text>
              </View>
            ) : null}

            {createAiDiagnostic.isSuccess ? (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>Pré-diagnostic créé</Text>
                <Text style={styles.successText}>
                  Le pré-diagnostic a été enregistré dans Directus sous la
                  référence {String(createAiDiagnostic.data.id)}.
                </Text>
                {generatedDiagnostic ? (
                  <Text style={styles.successSummary}>
                    {generatedDiagnostic.problemSummary}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ClientPortalLayout>
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
  vehicle: VehicleListItem;
  onPress: () => void;
};

function SelectableVehicleCard({
  active,
  vehicle,
  onPress,
}: SelectableVehicleCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.vehicleCard,
        active && styles.vehicleCardActive,
        hovered && styles.vehicleCardHovered,
        pressed && styles.pressed,
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

type QuestionFieldProps = {
  answer: string;
  question: string;
  onChange: (answer: string) => void;
};

function QuestionField({ answer, question, onChange }: QuestionFieldProps) {
  return (
    <View style={styles.questionField}>
      <Text style={styles.fieldLabel}>{question}</Text>
      <TextInput
        accessibilityLabel={question}
        onChangeText={onChange}
        placeholder="Votre réponse..."
        placeholderTextColor="#8A97A8"
        style={styles.input}
        value={answer}
      />
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
    shadowOffset: {
      width: 0,
      height: 14,
    },
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
    shadowOffset: {
      width: 0,
      height: 14,
    },
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

  questionField: {
    gap: spacing.sm,
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
    shadowColor: '#0F4C9A',
    shadowOffset: {
      width: 0,
      height: 10,
    },
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

  previewBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 18,
    backgroundColor: '#F6F9FD',
    gap: spacing.sm,
  },

  previewLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  previewUrgency: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  previewText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  previewEmpty: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  previewEmptyText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },

  loadingBox: {
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
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

  successSummary: {
    marginTop: spacing.sm,
    color: '#1F5E37',
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
