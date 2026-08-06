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

import { ErrorState } from '@/components/feedback/ErrorState';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useSavDashboardData } from '@/features/sav/dashboard/hooks/useSavDashboardData';
import type {
  SavAgendaItem,
  SavAgendaState,
  SavDashboardMetric,
  SavDiagnosticItem,
  SavFlowItem,
  SavMetricTone,
  SavPriorityItem,
  SavPriorityTone,
} from '@/features/sav/dashboard/model/sav-dashboard.presenter';
import { SavPortalLayout } from '@/features/sav/shared/ui/SavPortalLayout';
import { useAuthStore } from '@/store/auth.store';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const metricIcons: Record<SavDashboardMetric['key'], SymbolName> = {
  appointments: {
    ios: 'calendar',
    android: 'calendar_month',
    web: 'calendar_month',
  },
  arrivals: {
    ios: 'car.side.front.open',
    android: 'directions_car',
    web: 'directions_car',
  },
  diagnostics: {
    ios: 'sparkles',
    android: 'auto_awesome',
    web: 'auto_awesome',
  },
  repairs: { ios: 'wrench', android: 'build', web: 'build' },
  ready: {
    ios: 'checkmark.circle',
    android: 'task_alt',
    web: 'task_alt',
  },
};

function cleanAgentName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s*$/, '')
    .trim();
  const usableEmail = email?.trim().toLocaleLowerCase('fr-FR').endsWith('.local')
    ? null
    : email?.trim();

  return fullName || usableEmail || 'Agent SAV';
}

function formatToday(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function SavDashboardScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < breakpoints.tablet;
  const dashboardQuery = useSavDashboardData();
  const user = useAuthStore((state) => state.user);
  const savAgent = useAuthStore((state) => state.savAgent);
  const agentName = cleanAgentName(user?.firstName, user?.lastName, user?.email);
  const workshopName =
    savAgent?.workshopName?.trim() || 'Atelier SAV';

  if (dashboardQuery.isLoading) {
    return (
      <SavPortalLayout activeRoute="/sav/dashboard">
        <DashboardSkeleton isMobile={isMobile} />
      </SavPortalLayout>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <SavPortalLayout activeRoute="/sav/dashboard">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Centre de pilotage indisponible"
            message="Les données de votre atelier ne peuvent pas être chargées pour le moment."
            onRetry={() => {
              void dashboardQuery.refetch();
            }}
          />
        </View>
      </SavPortalLayout>
    );
  }

  const dashboard = dashboardQuery.data;

  return (
    <SavPortalLayout activeRoute="/sav/dashboard">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <OperationalHeader
          agentName={agentName}
          isMobile={isMobile}
          workshopName={workshopName}
        />

        {dashboardQuery.dataErrors.length > 0 ? (
          <View style={styles.partialNotice}>
            <SymbolView
              name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
              size={17}
              tintColor="#9A6200"
            />
            <Text style={styles.partialNoticeText}>
              Données partiellement disponibles :{' '}
              {dashboardQuery.dataErrors.join(', ')}.
            </Text>
          </View>
        ) : null}

        <View style={styles.metricsGrid}>
          {dashboard.metrics.map((metric) => (
            <MetricCard isMobile={isMobile} key={metric.key} metric={metric} />
          ))}
        </View>

        <View style={[styles.mainGrid, isMobile && styles.stack]}>
          <AgendaPanel agenda={dashboard.agenda} isMobile={isMobile} />
          <PrioritiesPanel priorities={dashboard.priorities} />
        </View>

        <WorkshopFlow flow={dashboard.flow} />
        <DiagnosticsPanel
          diagnostics={dashboard.diagnostics}
          isMobile={isMobile}
        />
      </ScrollView>
    </SavPortalLayout>
  );
}

function OperationalHeader({
  agentName,
  isMobile,
  workshopName,
}: {
  agentName: string;
  isMobile: boolean;
  workshopName: string;
}) {
  return (
    <View style={[styles.header, isMobile && styles.headerMobile]}>
      <View style={styles.headerCopy}>
        <Text style={styles.headerEyebrow}>PILOTAGE SAV</Text>
        <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>
          Centre de pilotage atelier
        </Text>
        <View style={styles.headerMetaRow}>
          <Text style={styles.workshopName}>{workshopName}</Text>
          <Text style={styles.metaSeparator}>•</Text>
          <Text style={styles.todayLabel}>{formatToday(new Date())}</Text>
        </View>
      </View>

      <View style={[styles.headerRight, isMobile && styles.headerRightMobile]}>
        <View style={styles.agentIdentity}>
          <View style={styles.sessionBadge}>
            <View style={styles.sessionDot} />
            <Text style={styles.sessionBadgeText}>Session SAV</Text>
          </View>
          <Text style={styles.agentName}>{agentName}</Text>
        </View>
        <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
          <HeaderAction
            href="/sav/appointments"
            icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
            label="Voir les rendez-vous"
          />
          <HeaderAction
            href="/sav/repairs"
            icon={{ ios: 'wrench', android: 'build', web: 'build' }}
            label="Voir les réparations"
          />
        </View>
      </View>
    </View>
  );
}

function HeaderAction({
  href,
  icon,
  label,
}: {
  href: '/sav/appointments' | '/sav/repairs';
  icon: SymbolName;
  label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ hovered, pressed }) => [
          styles.headerAction,
          hovered && styles.headerActionHovered,
          pressed && styles.pressed,
        ]}
      >
        <SymbolView name={icon} size={16} tintColor="#2F5FA6" />
        <Text style={styles.headerActionText}>{label}</Text>
      </Pressable>
    </Link>
  );
}

function MetricCard({
  isMobile,
  metric,
}: {
  isMobile: boolean;
  metric: SavDashboardMetric;
}) {
  return (
    <Link href={metric.href} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ hovered, pressed }) => [
          styles.metricCard,
          isMobile && styles.metricCardMobile,
          getMetricBorderStyle(metric.tone),
          hovered && styles.metricCardHovered,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.metricIcon, getMetricIconStyle(metric.tone)]}>
          <SymbolView
            name={metricIcons[metric.key]}
            size={18}
            tintColor={getMetricColor(metric.tone)}
          />
        </View>
        <View style={styles.metricCopy}>
          <Text style={[styles.metricValue, { color: getMetricColor(metric.tone) }]}>
            {metric.value}
          </Text>
          <Text style={styles.metricLabel}>{metric.label}</Text>
        </View>
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={15}
          tintColor="#7A8798"
        />
      </Pressable>
    </Link>
  );
}

function getMetricColor(tone: SavMetricTone): string {
  if (tone === 'danger') return '#B42318';
  if (tone === 'warning') return '#A66512';
  if (tone === 'success') return '#22734F';
  return '#2F5FA6';
}

function getMetricBorderStyle(tone: SavMetricTone) {
  if (tone === 'danger') return styles.metricDanger;
  if (tone === 'warning') return styles.metricWarning;
  if (tone === 'success') return styles.metricSuccess;
  return styles.metricInfo;
}

function getMetricIconStyle(tone: SavMetricTone) {
  if (tone === 'danger') return styles.metricIconDanger;
  if (tone === 'warning') return styles.metricIconWarning;
  if (tone === 'success') return styles.metricIconSuccess;
  return styles.metricIconInfo;
}

function AgendaPanel({
  agenda,
  isMobile,
}: {
  agenda: SavAgendaItem[];
  isMobile: boolean;
}) {
  return (
    <View style={styles.agendaPanel}>
      <SectionHeader
        eyebrow="JOURNÉE ATELIER"
        meta={`${agenda.length} rendez-vous`}
        title="Agenda du jour"
      />

      {agenda.length > 0 ? (
        <View style={styles.agendaList}>
          {!isMobile ? (
            <View style={styles.agendaTableHeader}>
              <Text style={[styles.tableHeaderText, styles.timeColumn]}>Heure</Text>
              <Text style={[styles.tableHeaderText, styles.clientColumn]}>Client / véhicule</Text>
              <Text style={[styles.tableHeaderText, styles.serviceColumn]}>Prestation</Text>
              <Text style={[styles.tableHeaderText, styles.statusColumn]}>Statut</Text>
              <Text style={[styles.tableHeaderText, styles.arrivalColumn]}>Arrivée</Text>
              <View style={styles.actionColumn} />
            </View>
          ) : null}
          {agenda.map((appointment) => (
            <AgendaRow appointment={appointment} isMobile={isMobile} key={appointment.id} />
          ))}
        </View>
      ) : (
        <EmptySection text="Aucun rendez-vous prévu aujourd’hui dans votre atelier." />
      )}
    </View>
  );
}

function AgendaRow({
  appointment,
  isMobile,
}: {
  appointment: SavAgendaItem;
  isMobile: boolean;
}) {
  if (isMobile) {
    return (
      <View style={styles.agendaMobileRow}>
        <View style={styles.agendaMobileTop}>
          <Text style={styles.agendaTime}>{appointment.timeLabel}</Text>
          <AgendaStateBadge state={appointment.state} />
        </View>
        <Text style={styles.agendaCustomer}>{appointment.customerLabel}</Text>
        <Text style={styles.agendaVehicle}>{appointment.vehicleLabel}</Text>
        <Text style={styles.agendaService}>{appointment.serviceLabel}</Text>
        <View style={styles.agendaMobileFooter}>
          <Text style={styles.arrivalText}>Arrivée : {appointment.arrivalLabel}</Text>
          <OpenAction href="/sav/appointments" label="Ouvrir" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.agendaRow}>
      <Text style={[styles.agendaTime, styles.timeColumn]}>{appointment.timeLabel}</Text>
      <View style={styles.clientColumn}>
        <Text numberOfLines={1} style={styles.agendaCustomer}>
          {appointment.customerLabel}
        </Text>
        <Text numberOfLines={1} style={styles.agendaVehicle}>
          {appointment.vehicleLabel}
        </Text>
      </View>
      <Text numberOfLines={2} style={[styles.agendaService, styles.serviceColumn]}>
        {appointment.serviceLabel}
      </Text>
      <View style={styles.statusColumn}>
        <AgendaStateBadge state={appointment.state} />
        <Text style={styles.appointmentStatus}>{appointment.statusLabel}</Text>
      </View>
      <Text style={[styles.arrivalText, styles.arrivalColumn]}>
        {appointment.arrivalLabel}
      </Text>
      <View style={styles.actionColumn}>
        <OpenAction href="/sav/appointments" label="Ouvrir" />
      </View>
    </View>
  );
}

function AgendaStateBadge({ state }: { state: SavAgendaState }) {
  const labels: Record<SavAgendaState, string> = {
    upcoming: 'À venir',
    late: 'En retard',
    arrived: 'Arrivée confirmée',
    cancelled: 'Annulé',
  };

  return (
    <View
      style={[
        styles.stateBadge,
        state === 'late' && styles.stateBadgeLate,
        state === 'arrived' && styles.stateBadgeArrived,
        state === 'cancelled' && styles.stateBadgeCancelled,
      ]}
    >
      <Text
        style={[
          styles.stateBadgeText,
          state === 'late' && styles.stateBadgeTextLate,
          state === 'arrived' && styles.stateBadgeTextArrived,
          state === 'cancelled' && styles.stateBadgeTextCancelled,
        ]}
      >
        {labels[state]}
      </Text>
    </View>
  );
}

function PrioritiesPanel({ priorities }: { priorities: SavPriorityItem[] }) {
  return (
    <View style={styles.prioritiesPanel}>
      <SectionHeader
        eyebrow="À EXAMINER"
        meta={String(priorities.length)}
        title="Priorités à traiter"
      />
      {priorities.length > 0 ? (
        <View style={styles.priorityList}>
          {priorities.slice(0, 8).map((priority) => (
            <PriorityRow key={priority.id} priority={priority} />
          ))}
        </View>
      ) : (
        <EmptySection text="Aucune priorité urgente pour le moment." compact />
      )}
    </View>
  );
}

function PriorityRow({ priority }: { priority: SavPriorityItem }) {
  return (
    <Link href={priority.href} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ hovered, pressed }) => [
          styles.priorityRow,
          hovered && styles.priorityRowHovered,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.priorityRail, getPriorityRailStyle(priority.tone)]} />
        <View style={styles.priorityCopy}>
          <Text style={[styles.priorityLabel, { color: getPriorityColor(priority.tone) }]}>
            {priority.priorityLabel}
          </Text>
          <Text numberOfLines={1} style={styles.priorityCustomer}>
            {priority.customerLabel}
          </Text>
          <Text numberOfLines={1} style={styles.priorityVehicle}>
            {priority.vehicleLabel}
          </Text>
          <Text numberOfLines={2} style={styles.prioritySummary}>
            {priority.summary}
          </Text>
        </View>
        <Text style={styles.examineText}>Examiner</Text>
      </Pressable>
    </Link>
  );
}

function getPriorityColor(tone: SavPriorityTone): string {
  if (tone === 'danger') return '#B42318';
  if (tone === 'warning') return '#A66512';
  if (tone === 'ready') return '#22734F';
  return '#2F5FA6';
}

function getPriorityRailStyle(tone: SavPriorityTone) {
  if (tone === 'danger') return styles.priorityRailDanger;
  if (tone === 'warning') return styles.priorityRailWarning;
  if (tone === 'ready') return styles.priorityRailReady;
  return styles.priorityRailNeutral;
}

function WorkshopFlow({ flow }: { flow: SavFlowItem[] }) {
  const maxValue = Math.max(1, ...flow.map((item) => item.value));

  return (
    <View style={styles.flowPanel}>
      <SectionHeader eyebrow="CHARGE ATELIER" title="Flux atelier" />
      <View style={styles.flowGrid}>
        {flow.map((item) => (
          <View key={item.key} style={styles.flowItem}>
            <View style={styles.flowHeading}>
              <Text style={styles.flowLabel}>{item.label}</Text>
              <Text style={styles.flowValue}>{item.value}</Text>
            </View>
            <View style={styles.flowTrack}>
              <View
                style={[
                  styles.flowFill,
                  item.key === 'ready' && styles.flowFillReady,
                  { width: `${(item.value / maxValue) * 100}%` },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function DiagnosticsPanel({
  diagnostics,
  isMobile,
}: {
  diagnostics: SavDiagnosticItem[];
  isMobile: boolean;
}) {
  return (
    <View style={styles.diagnosticsPanel}>
      <View style={styles.diagnosticsHeader}>
        <SectionHeader
          eyebrow="AIDE À LA RÉCEPTION"
          meta={`${diagnostics.length} reçus`}
          title="Pré-diagnostics IA récents"
        />
        <OpenAction href="/sav/ai-diagnostics" label="Consulter les pré-diagnostics" />
      </View>

      {diagnostics.length > 0 ? (
        <View style={styles.diagnosticsList}>
          {diagnostics.slice(0, 5).map((diagnostic) => (
            <DiagnosticRow
              diagnostic={diagnostic}
              isMobile={isMobile}
              key={diagnostic.id}
            />
          ))}
        </View>
      ) : (
        <EmptySection text="Aucun pré-diagnostic récent pour cet atelier." />
      )}
    </View>
  );
}

function DiagnosticRow({
  diagnostic,
  isMobile,
}: {
  diagnostic: SavDiagnosticItem;
  isMobile: boolean;
}) {
  if (isMobile) {
    return (
      <View style={styles.diagnosticRowMobile}>
        <View style={styles.diagnosticMobileTop}>
          <View style={styles.diagnosticUrgencyColumnMobile}>
            <Text
              style={[
                styles.diagnosticUrgency,
                { color: getPriorityColor(diagnostic.urgencyTone) },
              ]}
            >
              {diagnostic.urgencyLabel}
            </Text>
            {diagnostic.dateLabel ? (
              <Text style={styles.diagnosticDate}>{diagnostic.dateLabel}</Text>
            ) : null}
          </View>
          <OpenAction href="/sav/ai-diagnostics" label="Consulter" />
        </View>
        <Text style={styles.diagnosticCustomer}>{diagnostic.customerLabel}</Text>
        <Text style={styles.diagnosticVehicle}>{diagnostic.vehicleLabel}</Text>
        <Text numberOfLines={2} style={styles.diagnosticSummaryMobile}>
          {diagnostic.summary}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.diagnosticRow}>
      <View style={styles.diagnosticUrgencyColumn}>
        <Text
          style={[
            styles.diagnosticUrgency,
            { color: getPriorityColor(diagnostic.urgencyTone) },
          ]}
        >
          {diagnostic.urgencyLabel}
        </Text>
        {diagnostic.dateLabel ? (
          <Text style={styles.diagnosticDate}>{diagnostic.dateLabel}</Text>
        ) : null}
      </View>
      <View style={styles.diagnosticIdentity}>
        <Text numberOfLines={1} style={styles.diagnosticCustomer}>
          {diagnostic.customerLabel}
        </Text>
        <Text numberOfLines={1} style={styles.diagnosticVehicle}>
          {diagnostic.vehicleLabel}
        </Text>
      </View>
      <Text numberOfLines={2} style={styles.diagnosticSummary}>
        {diagnostic.summary}
      </Text>
      <OpenAction href="/sav/ai-diagnostics" label="Consulter" />
    </View>
  );
}

function OpenAction({
  href,
  label,
}: {
  href: '/sav/ai-diagnostics' | '/sav/appointments';
  label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ hovered, pressed }) => [
          styles.openAction,
          hovered && styles.openActionHovered,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.openActionText}>{label}</Text>
        <SymbolView
          name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
          size={14}
          tintColor="#2F5FA6"
        />
      </Pressable>
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  meta,
  title,
}: {
  eyebrow: string;
  meta?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

function EmptySection({ compact = false, text }: { compact?: boolean; text: string }) {
  return (
    <View style={[styles.emptySection, compact && styles.emptySectionCompact]}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function DashboardSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <View style={styles.skeletonPage}>
      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonMetrics}>
        {[0, 1, 2, 3, 4].map((item) => (
          <View key={item} style={styles.skeletonMetric} />
        ))}
      </View>
      <View style={[styles.skeletonMain, isMobile && styles.stack]}>
        <View style={styles.skeletonAgenda} />
        <View style={styles.skeletonPriorities} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F4F6FA' },
  content: {
    width: '100%',
    maxWidth: 1380,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  stateContainer: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  header: {
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  headerMobile: { minHeight: 0, flexDirection: 'column', alignItems: 'stretch' },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  headerEyebrow: { color: '#2F5FA6', fontSize: 11, fontWeight: '700' },
  headerTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    fontWeight: '700',
  },
  headerTitleMobile: {
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
  },
  headerMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  workshopName: { color: '#15294D', fontSize: 13, fontWeight: '700' },
  metaSeparator: { color: '#9AA5B4', fontSize: 12 },
  todayLabel: { color: '#5A6470', fontSize: 13 },
  headerRight: { alignItems: 'flex-end', gap: spacing.md },
  headerRightMobile: { alignItems: 'stretch' },
  agentIdentity: { alignItems: 'flex-end', gap: 5 },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#EAF5EF',
  },
  sessionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22734F' },
  sessionBadgeText: { color: '#22734F', fontSize: 10, fontWeight: '700' },
  agentName: { color: '#15294D', fontSize: 13, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerActionsMobile: { flexDirection: 'column' },
  headerAction: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#C9D8EA',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  headerActionHovered: { borderColor: '#2F5FA6', backgroundColor: '#F3F7FC' },
  headerActionText: { color: '#2F5FA6', fontSize: 12, fontWeight: '700' },
  partialNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EBCB8C',
    borderRadius: 12,
    backgroundColor: '#FFF9EC',
  },
  partialNoticeText: { flex: 1, color: '#71501A', fontSize: 12, lineHeight: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: {
    flex: 1,
    minWidth: 190,
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  metricCardMobile: { minWidth: '47%' },
  metricInfo: { borderColor: '#D6E2F2' },
  metricWarning: { borderColor: '#EBCB8C' },
  metricDanger: { borderColor: '#E9B8B8' },
  metricSuccess: { borderColor: '#B7D5C0' },
  metricCardHovered: { transform: [{ translateY: -1 }], backgroundColor: '#F9FBFE' },
  metricIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  metricIconInfo: { backgroundColor: '#EDF3FA' },
  metricIconWarning: { backgroundColor: '#FFF4DF' },
  metricIconDanger: { backgroundColor: '#FCECEC' },
  metricIconSuccess: { backgroundColor: '#EAF5EF' },
  metricCopy: { flex: 1, minWidth: 0, gap: 2 },
  metricValue: { fontSize: 23, lineHeight: 27, fontWeight: '700' },
  metricLabel: { color: '#15294D', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  mainGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stack: { flexDirection: 'column' },
  agendaPanel: {
    flex: 1.85,
    minWidth: 0,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  prioritiesPanel: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionHeaderCopy: { flex: 1, minWidth: 0, gap: 3 },
  sectionEyebrow: { color: '#2F5FA6', fontSize: 10, fontWeight: '700' },
  sectionTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: '700',
  },
  sectionMeta: { color: '#5A6470', fontSize: 11, fontWeight: '600' },
  agendaList: { gap: 0 },
  agendaTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F4F6FA',
  },
  tableHeaderText: { color: '#7A8798', fontSize: 9, fontWeight: '700' },
  agendaRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  timeColumn: { width: 50, flexShrink: 0 },
  clientColumn: { flex: 1.25, minWidth: 0 },
  serviceColumn: { flex: 1, minWidth: 0 },
  statusColumn: { width: 105, flexShrink: 0 },
  arrivalColumn: { width: 78, flexShrink: 0 },
  actionColumn: { width: 68, flexShrink: 0, alignItems: 'flex-end' },
  agendaTime: { color: '#15294D', fontSize: 13, fontWeight: '700' },
  agendaCustomer: { color: '#15294D', fontSize: 12, fontWeight: '700' },
  agendaVehicle: { color: '#5A6470', fontSize: 11, lineHeight: 16 },
  agendaService: { color: '#40506A', fontSize: 11, lineHeight: 16 },
  appointmentStatus: { marginTop: 3, color: '#6B7788', fontSize: 9 },
  arrivalText: { color: '#5A6470', fontSize: 10, lineHeight: 15 },
  agendaMobileRow: {
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  agendaMobileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  agendaMobileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 3,
  },
  stateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: '#EDF3FA',
  },
  stateBadgeLate: { backgroundColor: '#FFF4DF' },
  stateBadgeArrived: { backgroundColor: '#EAF5EF' },
  stateBadgeCancelled: { backgroundColor: '#F5F0F0' },
  stateBadgeText: { color: '#2F5FA6', fontSize: 9, fontWeight: '700' },
  stateBadgeTextLate: { color: '#A66512' },
  stateBadgeTextArrived: { color: '#22734F' },
  stateBadgeTextCancelled: { color: '#7B5555' },
  priorityList: { gap: spacing.sm },
  priorityRow: {
    position: 'relative',
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
    padding: 11,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  priorityRowHovered: { borderColor: '#B8C9DF', backgroundColor: '#F9FBFE' },
  priorityRail: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 3 },
  priorityRailDanger: { backgroundColor: '#B42318' },
  priorityRailWarning: { backgroundColor: '#D38A22' },
  priorityRailReady: { backgroundColor: '#22734F' },
  priorityRailNeutral: { backgroundColor: '#2F5FA6' },
  priorityCopy: { flex: 1, minWidth: 0, gap: 2 },
  priorityLabel: { fontSize: 10, fontWeight: '700' },
  priorityCustomer: { color: '#15294D', fontSize: 12, fontWeight: '700' },
  priorityVehicle: { color: '#5A6470', fontSize: 10 },
  prioritySummary: { color: '#5A6470', fontSize: 10, lineHeight: 15 },
  examineText: { color: '#2F5FA6', fontSize: 10, fontWeight: '700' },
  flowPanel: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  flowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  flowItem: { flex: 1, minWidth: 150, gap: 7 },
  flowHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  flowLabel: { color: '#5A6470', fontSize: 11 },
  flowValue: { color: '#15294D', fontSize: 15, fontWeight: '700' },
  flowTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: '#E8ECF2',
  },
  flowFill: { height: '100%', borderRadius: 3, backgroundColor: '#2F5FA6' },
  flowFillReady: { backgroundColor: '#22734F' },
  diagnosticsPanel: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E7F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  diagnosticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  diagnosticsList: { gap: 0 },
  diagnosticRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  diagnosticRowMobile: {
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  diagnosticMobileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  diagnosticUrgencyColumn: { width: 130, flexShrink: 0, gap: 3 },
  diagnosticUrgencyColumnMobile: { flex: 1, minWidth: 0, gap: 3 },
  diagnosticUrgency: { fontSize: 10, fontWeight: '700' },
  diagnosticDate: { color: '#7A8798', fontSize: 9 },
  diagnosticIdentity: { flex: 0.9, minWidth: 0, gap: 3 },
  diagnosticCustomer: { color: '#15294D', fontSize: 12, fontWeight: '700' },
  diagnosticVehicle: { color: '#5A6470', fontSize: 10 },
  diagnosticSummary: { flex: 1.4, minWidth: 0, color: '#40506A', fontSize: 11, lineHeight: 16 },
  diagnosticSummaryMobile: { color: '#40506A', fontSize: 11, lineHeight: 16 },
  openAction: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EDF3FA',
  },
  openActionHovered: { backgroundColor: '#DDE9F6' },
  openActionText: { color: '#2F5FA6', fontSize: 10, fontWeight: '700' },
  emptySection: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D5DCE6',
    borderRadius: 12,
    backgroundColor: '#FAFBFC',
  },
  emptySectionCompact: { minHeight: 80 },
  emptyText: { color: '#5A6470', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  skeletonPage: { flex: 1, gap: spacing.md, padding: spacing.md },
  skeletonHeader: { height: 150, borderRadius: 18, backgroundColor: '#E1E6EE' },
  skeletonMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skeletonMetric: { flex: 1, minWidth: 190, height: 88, borderRadius: 14, backgroundColor: '#E7EBF1' },
  skeletonMain: { flexDirection: 'row', gap: spacing.md },
  skeletonAgenda: { flex: 1.85, height: 430, borderRadius: 16, backgroundColor: '#E1E6EE' },
  skeletonPriorities: { flex: 1, height: 430, borderRadius: 16, backgroundColor: '#E7EBF1' },
  pressed: { opacity: 0.8 },
});
