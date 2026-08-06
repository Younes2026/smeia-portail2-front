import { useMemo, useState } from 'react';
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
import type {
  AiDiagnosticAnswer,
  DirectusAiDiagnostic,
  DirectusAiDiagnosticAppointment,
  DirectusAiDiagnosticCustomer,
  DirectusAiDiagnosticVehicle,
} from '@/core/api/ai-diagnostics.api';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useSavAiDiagnostics } from '@/features/sav/ai-diagnostics/hooks/useSavAiDiagnostics';
import { SavPortalLayout } from '@/features/sav/shared/ui/SavPortalLayout';
import { useAuthStore } from '@/store/auth.store';

const urgencyLabels: Record<string, string> = {
  low: 'Faible',
  medium: 'Modérée',
  high: 'Élevée',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isCustomerRelation(
  value: DirectusAiDiagnostic['customer_id']
): value is DirectusAiDiagnosticCustomer {
  return isRecord(value);
}

function isVehicleRelation(
  value: DirectusAiDiagnostic['vehicle_id']
): value is DirectusAiDiagnosticVehicle {
  return isRecord(value);
}

function isAppointmentRelation(
  value: DirectusAiDiagnostic['appointment_id']
): value is DirectusAiDiagnosticAppointment {
  return isRecord(value);
}

function isAiDiagnosticAnswer(value: unknown): value is AiDiagnosticAnswer {
  return (
    isRecord(value) &&
    typeof value.question === 'string' &&
    typeof value.answer === 'string'
  );
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return 'Non renseigné';
  }

  return JSON.stringify(value);
}

function getCustomerName(customer: DirectusAiDiagnostic['customer_id']): string {
  if (!isCustomerRelation(customer)) {
    return `Client #${String(customer)}`;
  }

  const fullName = `${customer.first_name ?? ''} ${
    customer.last_name ?? ''
  }`.trim();

  return fullName || customer.email || `Client #${customer.id}`;
}

function getVehicleLabel(vehicle: DirectusAiDiagnostic['vehicle_id']): string {
  if (!isVehicleRelation(vehicle)) {
    return `Véhicule #${String(vehicle)}`;
  }

  const vehicleName = [vehicle.model, vehicle.registration_number]
    .filter((value): value is string => Boolean(value))
    .join(' · ');

  return vehicleName || `Véhicule #${vehicle.id}`;
}

function getAppointmentLabel(
  appointment: DirectusAiDiagnostic['appointment_id']
): string {
  if (appointment === null || appointment === undefined) {
    return 'Aucun rendez-vous lié';
  }

  if (!isAppointmentRelation(appointment)) {
    return `Rendez-vous #${String(appointment)}`;
  }

  const slot =
    appointment.requested_date && appointment.requested_time
      ? `${appointment.requested_date} à ${appointment.requested_time}`
      : null;

  return slot
    ? `Rendez-vous #${appointment.id} · ${slot}`
    : `Rendez-vous #${appointment.id}`;
}

function formatDate(value?: string | null): string {
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

function normalizeUrgency(value?: string | null): string {
  return value?.trim().toLocaleLowerCase('fr-FR') || 'low';
}

function getUrgencyLabel(value?: string | null): string {
  const normalizedUrgency = normalizeUrgency(value);

  return urgencyLabels[normalizedUrgency] ?? value ?? 'Non renseignée';
}

function isHighUrgency(diagnostic: DirectusAiDiagnostic): boolean {
  return normalizeUrgency(diagnostic.urgency_level) === 'high';
}

function isPendingDiagnostic(diagnostic: DirectusAiDiagnostic): boolean {
  const normalizedStatus = diagnostic.status?.trim().toLocaleLowerCase('fr-FR');

  return (
    !normalizedStatus ||
    ['draft', 'pending', 'en attente'].includes(normalizedStatus)
  );
}

function hasRelationDetails(diagnostic: DirectusAiDiagnostic): boolean {
  return (
    isCustomerRelation(diagnostic.customer_id) &&
    isVehicleRelation(diagnostic.vehicle_id)
  );
}

function normalizeQuestions(
  questions: DirectusAiDiagnostic['ai_questions']
): string[] {
  if (Array.isArray(questions)) {
    return questions.filter((question): question is string => {
      return typeof question === 'string' && question.trim().length > 0;
    });
  }

  if (typeof questions === 'string') {
    const parsedQuestions = parseJsonValue(questions);

    if (parsedQuestions !== questions) {
      return normalizeQuestions(
        parsedQuestions as DirectusAiDiagnostic['ai_questions']
      );
    }

    return questions.trim() ? [questions] : [];
  }

  return [];
}

function normalizeAnswers(
  answers: DirectusAiDiagnostic['client_answers'],
  questions: string[]
): AiDiagnosticAnswer[] {
  if (Array.isArray(answers)) {
    return answers.flatMap((answer, index) => {
      if (isAiDiagnosticAnswer(answer)) {
        return answer;
      }

      if (typeof answer === 'string') {
        return {
          question: questions[index] ?? `Question ${index + 1}`,
          answer,
        };
      }

      return [];
    });
  }

  if (isRecord(answers)) {
    return Object.entries(answers).map(([question, answer]) => ({
      question,
      answer: stringifyValue(answer),
    }));
  }

  if (typeof answers === 'string') {
    const parsedAnswers = parseJsonValue(answers);

    if (parsedAnswers !== answers) {
      return normalizeAnswers(
        parsedAnswers as DirectusAiDiagnostic['client_answers'],
        questions
      );
    }

    return answers.trim()
      ? [
          {
            question: 'Réponses client',
            answer: answers,
          },
        ]
      : [];
  }

  return [];
}

export function SavAiDiagnosticsScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const savAgent = useAuthStore((state) => state.savAgent);
  const diagnosticsQuery = useSavAiDiagnostics();
  const diagnostics = diagnosticsQuery.data ?? [];
  const workshopName = savAgent?.workshopName ?? 'Atelier SAV';
  const highUrgencyCount = diagnostics.filter(isHighUrgency).length;
  const pendingCount = diagnostics.filter(isPendingDiagnostic).length;
  const hasReducedRelationFields =
    diagnostics.length > 0 && diagnostics.some((diagnostic) => !hasRelationDetails(diagnostic));
  const [selectedDiagnosticId, setSelectedDiagnosticId] = useState<
    number | string | null
  >(null);
  const selectedDiagnostic = useMemo(() => {
    return (
      diagnostics.find(
        (diagnostic) => diagnostic.id === selectedDiagnosticId
      ) ??
      diagnostics[0] ??
      null
    );
  }, [diagnostics, selectedDiagnosticId]);

  if (diagnosticsQuery.isLoading) {
    return (
      <SavPortalLayout activeRoute="/sav/ai-diagnostics">
        <View style={styles.stateContainer}>
          <LoadingState message="Chargement des pré-diagnostics IA..." />
        </View>
      </SavPortalLayout>
    );
  }

  if (diagnosticsQuery.isError) {
    return (
      <SavPortalLayout activeRoute="/sav/ai-diagnostics">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Erreur de chargement"
            message="Impossible de charger les pré-diagnostics IA depuis Directus. Vérifiez que le rôle Agent SAV possède au moins le droit de lecture sur ai_diagnostics."
            onRetry={() => {
              diagnosticsQuery.refetch();
            }}
          />
        </View>
      </SavPortalLayout>
    );
  }

  return (
    <SavPortalLayout activeRoute="/sav/ai-diagnostics">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={[styles.header, isNarrow && styles.headerNarrow]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{workshopName}</Text>
            <Text style={styles.title}>Espace Agent SAV</Text>
            <Text style={styles.subtitle}>
              Consultez les pré-diagnostics indicatifs créés par les clients
              avant qualification atelier.
            </Text>
          </View>

          <View style={[styles.metricsGrid, isNarrow && styles.metricsGridNarrow]}>
            <MetricCard
              label="Diagnostics reçus"
              tone="blue"
              value={String(diagnostics.length)}
            />
            <MetricCard
              label="Urgences élevées"
              tone="red"
              value={String(highUrgencyCount)}
            />
            <MetricCard
              label="En attente"
              tone="amber"
              value={String(pendingCount)}
            />
          </View>
        </View>

        {hasReducedRelationFields ? (
          <View style={styles.permissionNotice}>
            <Text style={styles.permissionNoticeTitle}>
              Informations client ou véhicule limitées
            </Text>
            <Text style={styles.permissionNoticeText}>
              Directus a renvoyé certains diagnostics sans les détails liés.
              Vérifiez les droits de lecture du rôle Agent SAV sur les
              collections customers et vehicles pour afficher les noms complets.
            </Text>
          </View>
        ) : null}

        {diagnostics.length === 0 ? (
          <View style={styles.statePanel}>
            <EmptyState
              title="Aucun pré-diagnostic IA"
              message="Aucune demande client n'a encore été enregistrée dans Directus."
            />
          </View>
        ) : (
          <View style={[styles.workspaceGrid, isNarrow && styles.stack]}>
            <View style={styles.listPanel}>
              <Text style={styles.panelTitle}>Demandes récentes</Text>

              <View style={styles.diagnosticList}>
                {diagnostics.map((diagnostic) => {
                  const isActive = diagnostic.id === selectedDiagnostic?.id;

                  return (
                    <DiagnosticListItem
                      key={String(diagnostic.id)}
                      active={isActive}
                      diagnostic={diagnostic}
                      onPress={() => {
                        setSelectedDiagnosticId(diagnostic.id);
                      }}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.detailPanel}>
              {selectedDiagnostic ? (
                <DiagnosticDetail diagnostic={selectedDiagnostic} />
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </SavPortalLayout>
  );
}

type DiagnosticListItemProps = {
  active: boolean;
  diagnostic: DirectusAiDiagnostic;
  onPress: () => void;
};

type MetricCardProps = {
  label: string;
  tone: 'amber' | 'blue' | 'red';
  value: string;
};

function MetricCard({ label, tone, value }: MetricCardProps) {
  return (
    <View
      style={[
        styles.metricCard,
        tone === 'amber' && styles.metricCardAmber,
        tone === 'red' && styles.metricCardRed,
      ]}
    >
      <Text
        style={[
          styles.metricValue,
          tone === 'amber' && styles.metricValueAmber,
          tone === 'red' && styles.metricValueRed,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function DiagnosticListItem({
  active,
  diagnostic,
  onPress,
}: DiagnosticListItemProps) {
  const urgency = normalizeUrgency(diagnostic.urgency_level);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.listItem,
        active && styles.listItemActive,
        hovered && !active && styles.listItemHovered,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.listItemHeader}>
        <View style={styles.listItemTitleBlock}>
          <Text style={styles.customerName}>
            {getCustomerName(diagnostic.customer_id)}
          </Text>
          <Text style={styles.vehicleName}>
            {getVehicleLabel(diagnostic.vehicle_id)}
          </Text>
        </View>

        <UrgencyBadge urgency={urgency} value={diagnostic.urgency_level} />
      </View>

      <Text numberOfLines={2} style={styles.problemDescription}>
        {diagnostic.problem_description}
      </Text>

      <View style={styles.listMeta}>
        <Text style={styles.statusText}>
          {diagnostic.status ?? 'Statut non renseigné'}
        </Text>
        <Text style={styles.dateText}>{formatDate(diagnostic.created_at)}</Text>
      </View>
    </Pressable>
  );
}

type DiagnosticDetailProps = {
  diagnostic: DirectusAiDiagnostic;
};

function DiagnosticDetail({ diagnostic }: DiagnosticDetailProps) {
  const questions = normalizeQuestions(diagnostic.ai_questions);
  const answers = normalizeAnswers(diagnostic.client_answers, questions);
  const urgency = normalizeUrgency(diagnostic.urgency_level);

  return (
    <View style={styles.detailContent}>
      <View style={styles.detailHeader}>
        <View style={styles.detailHeaderCopy}>
          <Text style={styles.detailKicker}>
            {formatDate(diagnostic.created_at)}
          </Text>
          <Text style={styles.detailTitle}>
            {getCustomerName(diagnostic.customer_id)}
          </Text>
          <Text style={styles.detailSubtitle}>
            {getVehicleLabel(diagnostic.vehicle_id)}
          </Text>
        </View>

        <UrgencyBadge urgency={urgency} value={diagnostic.urgency_level} />
      </View>

      <InfoGrid
        lines={[
          ['Client', getCustomerName(diagnostic.customer_id)],
          ['Véhicule', getVehicleLabel(diagnostic.vehicle_id)],
          ['Statut', diagnostic.status ?? 'Non renseigné'],
          ['Urgence', getUrgencyLabel(diagnostic.urgency_level)],
          ['Rendez-vous', getAppointmentLabel(diagnostic.appointment_id)],
        ]}
      />

      <DetailSection
        title="Description initiale"
        text={diagnostic.problem_description}
      />

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Questions IA</Text>
        {questions.length > 0 ? (
          <View style={styles.questionList}>
            {questions.map((question, index) => (
              <Text key={`${question}-${index}`} style={styles.questionText}>
                {index + 1}. {question}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.detailText}>Aucune question enregistrée.</Text>
        )}
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Réponses client</Text>
        {answers.length > 0 ? (
          <View style={styles.answerList}>
            {answers.map((answer, index) => (
              <View key={`${answer.question}-${index}`} style={styles.answerRow}>
                <Text style={styles.answerQuestion}>{answer.question}</Text>
                <Text style={styles.answerText}>{answer.answer}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.detailText}>Aucune réponse enregistrée.</Text>
        )}
      </View>

      <DetailSection
        title="Résumé IA indicatif"
        text={diagnostic.problem_summary ?? 'Résumé non renseigné.'}
      />

      <DetailSection
        title="Recommandation IA"
        text={diagnostic.ai_recommendation ?? 'Recommandation non renseignée.'}
      />
    </View>
  );
}

type DetailSectionProps = {
  title: string;
  text: string;
};

function DetailSection({ title, text }: DetailSectionProps) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailSectionTitle}>{title}</Text>
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

type InfoGridProps = {
  lines: Array<[string, string]>;
};

function InfoGrid({ lines }: InfoGridProps) {
  return (
    <View style={styles.infoGrid}>
      {lines.map(([label, value]) => (
        <View key={label} style={styles.infoTile}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

type UrgencyBadgeProps = {
  urgency: string;
  value?: string | null;
};

function UrgencyBadge({ urgency, value }: UrgencyBadgeProps) {
  return (
    <View
      style={[
        styles.urgencyBadge,
        urgency === 'high' && styles.urgencyBadgeHigh,
        urgency === 'medium' && styles.urgencyBadgeMedium,
      ]}
    >
      <Text
        style={[
          styles.urgencyText,
          urgency === 'high' && styles.urgencyTextHigh,
          urgency === 'medium' && styles.urgencyTextMedium,
        ]}
      >
        {getUrgencyLabel(value)}
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
    backgroundColor: '#F4F6FA',
    experimental_backgroundImage:
      'linear-gradient(135deg, #F7F9FC 0%, #F3F6FA 46%, #EEF1F7 100%)',
  },

  content: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
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
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.06,
    shadowRadius: 28,
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
    maxWidth: 760,
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },

  metricsGridNarrow: {
    flexWrap: 'wrap',
  },

  metricCard: {
    width: 142,
    minHeight: 92,
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#C9D8EA',
    borderRadius: 18,
    backgroundColor: '#F3F7FC',
    gap: spacing.xs,
  },

  metricCardAmber: {
    borderColor: '#EBCB8C',
    backgroundColor: '#FFF7E6',
  },

  metricCardRed: {
    borderColor: '#E9B8B8',
    backgroundColor: '#FFF5F5',
  },

  metricValue: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  metricValueAmber: {
    color: '#9A5B13',
  },

  metricValueRed: {
    color: '#B42318',
  },

  metricLabel: {
    color: '#64748B',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  totalBadge: {
    minWidth: 132,
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#C9D8EA',
    borderRadius: 18,
    backgroundColor: '#F3F7FC',
    gap: spacing.xs,
  },

  totalValue: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  totalLabel: {
    color: '#64748B',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'center',
  },

  permissionNotice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EBCB8C',
    borderRadius: 18,
    backgroundColor: '#FFF9EC',
    gap: spacing.xs,
  },

  permissionNoticeTitle: {
    color: '#9A5B13',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  permissionNoticeText: {
    color: '#6B4B16',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  workspaceGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },

  stack: {
    flexDirection: 'column',
  },

  listPanel: {
    flex: 0.82,
    minWidth: 320,
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

  detailPanel: {
    flex: 1.18,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },

  panelTitle: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  diagnosticList: {
    gap: spacing.md,
  },

  listItem: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },

  listItemActive: {
    borderColor: '#0F4C9A',
    backgroundColor: '#F1F6FD',
  },

  listItemHovered: {
    borderColor: '#B8C9DF',
    transform: [{ translateY: -1 }],
  },

  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  listItemTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },

  customerName: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  vehicleName: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  problemDescription: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  listMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  statusText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  dateText: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    textAlign: 'right',
  },

  detailContent: {
    gap: spacing.lg,
  },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  detailHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },

  detailKicker: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  detailTitle: {
    color: '#071832',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  detailSubtitle: {
    color: '#526174',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  infoTile: {
    flexGrow: 1,
    flexBasis: 220,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#E5EBF3',
    borderRadius: 14,
    backgroundColor: '#F6F9FD',
    gap: spacing.xs,
  },

  infoLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  infoValue: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  detailSection: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },

  detailSectionTitle: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  detailText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  questionList: {
    gap: spacing.sm,
  },

  questionText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  answerList: {
    gap: spacing.sm,
  },

  answerRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    gap: spacing.xs,
  },

  answerQuestion: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  answerText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#B7D5C0',
    borderRadius: 999,
    backgroundColor: '#F0F9F3',
  },

  urgencyBadgeMedium: {
    borderColor: '#EBCB8C',
    backgroundColor: '#FFF7E6',
  },

  urgencyBadgeHigh: {
    borderColor: '#E9B8B8',
    backgroundColor: '#FFF5F5',
  },

  urgencyText: {
    color: '#166534',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  urgencyTextMedium: {
    color: '#9A5B13',
  },

  urgencyTextHigh: {
    color: '#B42318',
  },

  statePanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },

  pressed: {
    opacity: 0.86,
  },
});
