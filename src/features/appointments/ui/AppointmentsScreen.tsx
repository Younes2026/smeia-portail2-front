import { useRouter } from 'expo-router';
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

import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { useServiceTypes } from '@/core/api/use-dictionaries';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { SecureManualBookingJourney } from '@/features/ai-diagnostic/ui/AiDiagnosticScreen';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import { useAuthStore } from '@/store/auth.store';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

export function AppointmentsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const [showClassicJourney, setShowClassicJourney] = useState(false);
  const vehiclesQuery = useVehicles();
  const serviceTypesQuery = useServiceTypes();
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const clientName = getDisplayName(
    customer?.firstName ?? user?.firstName,
    customer?.lastName ?? user?.lastName,
    customer?.email ?? user?.email
  );

  if (showClassicJourney && vehiclesQuery.isLoading) {
    return (
      <ClientPortalLayout activeRoute="/appointments">
        <View style={styles.stateContainer}>
          <LoadingState message="Chargement de vos véhicules..." />
        </View>
      </ClientPortalLayout>
    );
  }

  if (showClassicJourney && vehiclesQuery.isError) {
    return (
      <ClientPortalLayout activeRoute="/appointments">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Erreur de chargement"
            message="Impossible de charger vos véhicules pour préparer le rendez-vous."
            onRetry={() => {
              vehiclesQuery.refetch();
            }}
          />
        </View>
      </ClientPortalLayout>
    );
  }

  if (showClassicJourney) {
    return (
      <ClientPortalLayout activeRoute="/appointments">
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.manualJourneyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <SecureManualBookingJourney
            contacts={{
              name: clientName,
              email: customer?.email ?? user?.email ?? null,
              phone: customer?.phone ?? null,
              address: customer?.address ?? null,
            }}
            isNarrow={isNarrow}
            isServiceTypesError={serviceTypesQuery.isError}
            isServiceTypesLoading={serviceTypesQuery.isLoading}
            onChangeJourney={() => {
              setShowClassicJourney(false);
            }}
            serviceTypes={serviceTypesQuery.data ?? []}
            variant="classic"
            vehicles={vehiclesQuery.data ?? []}
          />
        </ScrollView>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout activeRoute="/appointments">
      <AppointmentJourneyChooser
        compact={isNarrow}
        onClassic={() => {
          setShowClassicJourney(true);
        }}
        onGuided={() => {
          router.push({
            pathname: '/ai-diagnostic',
            params: { mode: 'booking', source: 'appointments' },
          });
        }}
      />
    </ClientPortalLayout>
  );
}

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'client SMEIA';
}

function AppointmentJourneyChooser({
  compact,
  onClassic,
  onGuided,
}: {
  compact: boolean;
  onClassic: () => void;
  onGuided: () => void;
}) {
  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={styles.journeyChooserContent}
      showsVerticalScrollIndicator
    >
      <View style={styles.journeyChooserHero}>
        <Text style={styles.eyebrow}>RENDEZ-VOUS SMEIA</Text>
        <Text style={styles.title}>
          Comment souhaitez-vous prendre rendez-vous ?
        </Text>
        <Text style={styles.subtitle}>
          Choisissez le parcours qui correspond le mieux à votre besoin.
        </Text>
      </View>

      <View style={[styles.journeyCards, compact && styles.journeyCardsCompact]}>
        <JourneyCard
          buttonLabel="Continuer avec le parcours classique"
          description="Je connais déjà mon besoin et souhaite choisir mon site SMEIA."
          icon={{
            ios: 'list.bullet.clipboard',
            android: 'fact_check',
            web: 'fact_check',
          }}
          title="Parcours classique"
          onPress={onClassic}
        />
        <JourneyCard
          accent
          buttonLabel="Prendre rendez-vous avec l’Assistant IA"
          description="Je souhaite être orienté ou préparer ma demande avec l’Assistant IA."
          icon={{
            ios: 'sparkles',
            android: 'auto_awesome',
            web: 'auto_awesome',
          }}
          title="Réservation guidée"
          onPress={onGuided}
        />
      </View>
    </ScrollView>
  );
}

function JourneyCard({
  accent = false,
  buttonLabel,
  description,
  icon,
  title,
  onPress,
}: {
  accent?: boolean;
  buttonLabel: string;
  description: string;
  icon: SymbolName;
  title: string;
  onPress: () => void;
}) {
  return (
    <View style={[styles.journeyCard, accent && styles.journeyCardAccent]}>
      <View
        style={[
          styles.journeyCardIcon,
          accent && styles.journeyCardIconAccent,
        ]}
      >
        <SymbolView
          name={icon}
          size={26}
          tintColor={accent ? '#FFFFFF' : '#2F5FA6'}
        />
      </View>
      <Text style={styles.journeyCardTitle}>{title}</Text>
      <Text style={styles.journeyCardDescription}>{description}</Text>
      <Pressable
        accessibilityLabel={buttonLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ hovered, pressed }) => [
          styles.journeyCardAction,
          accent && styles.journeyCardActionAccent,
          hovered && styles.primaryActionHovered,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.primaryActionText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stateContainer: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  contentScroll: { flex: 1, backgroundColor: '#F4F6FA' },
  manualJourneyContent: {
    width: '100%',
    maxWidth: 1320,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  journeyChooserContent: {
    width: '100%',
    maxWidth: 1120,
    minHeight: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  journeyChooserHero: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: 24,
    backgroundColor: '#0B1220',
  },
  journeyCards: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  journeyCardsCompact: { flexDirection: 'column' },
  journeyCard: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  journeyCardAccent: {
    borderColor: '#82B1E8',
    backgroundColor: '#F4F8FD',
  },
  journeyCardIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#EAF2FC',
  },
  journeyCardIconAccent: { backgroundColor: '#2F5FA6' },
  journeyCardTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  journeyCardDescription: {
    flex: 1,
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  journeyCardAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: '#355A88',
  },
  journeyCardActionAccent: { backgroundColor: '#2F5FA6' },
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
  primaryActionHovered: { backgroundColor: '#244B86' },
  primaryActionText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  pressed: { opacity: 0.84 },
});
