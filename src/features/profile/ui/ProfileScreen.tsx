import { useRouter } from 'expo-router';
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

import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useLogout } from '@/features/auth/hooks/useLogout';
import {
  presentProfile,
  type ProfileFieldState,
  type ProfilePresentation,
} from '@/features/profile/model/profile.presenter';
import { useAuthStore } from '@/store/auth.store';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const contactIcons: Record<'email' | 'phone' | 'address', SymbolName> = {
  email: { ios: 'envelope', android: 'mail', web: 'mail' },
  phone: { ios: 'phone', android: 'call', web: 'call' },
  address: {
    ios: 'mappin.and.ellipse',
    android: 'location_on',
    web: 'location_on',
  },
};

function formatMissingInformation(items: string[]): string {
  if (items.length === 0) {
    return 'Vos informations essentielles sont renseignées.';
  }

  const labels = items.map((item, index) =>
    index === 0 ? `${item[0].toLocaleUpperCase('fr-FR')}${item.slice(1)}` : item
  );
  const joined =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`;

  return `${joined} à compléter.`;
}

export function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < breakpoints.tablet;
  const router = useRouter();
  const customer = useAuthStore((state) => state.customer);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const logout = useLogout();
  const profile = presentProfile({ customer, user });

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        router.replace('/login');
      },
    });
  };

  if (!hasHydrated) {
    return <LoadingState message="Chargement de votre profil..." />;
  }

  return (
    <ClientPortalLayout activeRoute="/profile">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <Text style={styles.eyebrow}>ESPACE PERSONNEL</Text>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>
            Mon profil SMEIA
          </Text>
          <Text style={styles.subtitle}>
            Consultez vos informations client et les coordonnées associées à
            votre compte.
          </Text>
        </View>

        {customer ? (
          <ProfileContent
            isMobile={isMobile}
            logoutPending={logout.isPending}
            onLogout={handleLogout}
            profile={profile}
          />
        ) : (
          <View style={styles.unavailableState}>
            <EmptyState
              title="Profil client indisponible"
              message="Vos informations client ne sont pas disponibles dans cette session. Reconnectez-vous pour accéder à votre espace personnel."
            />
          </View>
        )}
      </ScrollView>
    </ClientPortalLayout>
  );
}

function ProfileContent({
  isMobile,
  logoutPending,
  onLogout,
  profile,
}: {
  isMobile: boolean;
  logoutPending: boolean;
  onLogout: () => void;
  profile: ProfilePresentation;
}) {
  return (
    <>
      <View style={[styles.profileGrid, isMobile && styles.stack]}>
        <IdentityCard profile={profile} />
        <ContactDetails profile={profile} />
      </View>

      <ProfileQuality profile={profile} />

      <View style={[styles.bottomGrid, isMobile && styles.stack]}>
        <View style={styles.updatePanel}>
          <View style={styles.sectionIcon}>
            <SymbolView
              name={{ ios: 'person.crop.circle.badge.questionmark', android: 'support_agent', web: 'support_agent' }}
              size={21}
              tintColor="#2F5FA6"
            />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Mettre à jour mes informations</Text>
            <Text style={styles.sectionText}>
              Pour modifier une information administrative, contactez votre
              conseiller SMEIA afin de garantir l’exactitude et la sécurité de
              votre dossier.
            </Text>
          </View>
        </View>

        <View style={styles.securityPanel}>
          <View style={styles.securityHeader}>
            <View style={styles.securityIcon}>
              <SymbolView
                name={{ ios: 'lock.shield', android: 'verified_user', web: 'verified_user' }}
                size={20}
                tintColor="#2F5FA6"
              />
            </View>
            <View style={styles.securityHeaderCopy}>
              <Text style={styles.sectionTitle}>Sécurité du compte</Text>
              <Text style={styles.securityState}>Session client sécurisée</Text>
            </View>
          </View>

          {profile.authenticationEmailLabel ? (
            <View style={styles.authenticationRow}>
              <Text style={styles.authenticationLabel}>Compte connecté</Text>
              <Text style={styles.authenticationValue}>
                {profile.authenticationEmailLabel}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={logoutPending}
            onPress={onLogout}
            style={({ hovered, pressed }) => [
              styles.logoutButton,
              hovered && !logoutPending && styles.logoutButtonHovered,
              pressed && !logoutPending && styles.buttonPressed,
              logoutPending && styles.buttonDisabled,
            ]}
          >
            <SymbolView
              name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
              size={17}
              tintColor="#2F5FA6"
            />
            <Text style={styles.logoutButtonText}>
              {logoutPending ? 'Déconnexion...' : 'Déconnexion'}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

function IdentityCard({ profile }: { profile: ProfilePresentation }) {
  return (
    <View style={styles.identityCard}>
      <View pointerEvents="none" style={styles.identityPattern}>
        <View style={[styles.patternLine, styles.patternLineTop]} />
        <View style={[styles.patternLine, styles.patternLineMiddle]} />
        <View style={[styles.patternLine, styles.patternLineBottom]} />
        <View style={styles.patternVertical} />
      </View>

      <View style={styles.identityTopRow}>
        <View style={styles.initialsBlock}>
          <Text style={styles.initials}>{profile.initials}</Text>
        </View>
        <View style={styles.secureBadge}>
          <SymbolView
            name={{ ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' }}
            size={14}
            tintColor="#BFD8F5"
          />
          <Text style={styles.secureBadgeText}>Espace sécurisé</Text>
        </View>
      </View>

      <View style={styles.identityCopy}>
        <Text style={styles.identityLabel}>Client SMEIA</Text>
        <Text style={styles.customerName}>{profile.displayName}</Text>
        <Text style={styles.customerReference}>{profile.customerReference}</Text>
      </View>
    </View>
  );
}

function ContactDetails({ profile }: { profile: ProfilePresentation }) {
  return (
    <View style={styles.contactPanel}>
      <View style={styles.panelHeading}>
        <Text style={styles.panelEyebrow}>INFORMATIONS CLIENT</Text>
        <Text style={styles.panelTitle}>Mes coordonnées</Text>
      </View>

      <View style={styles.contactList}>
        <ContactLine
          icon={contactIcons.email}
          label="Adresse e-mail"
          state={profile.emailState}
          value={profile.emailLabel}
        />
        <ContactLine
          icon={contactIcons.phone}
          label="Téléphone"
          state={profile.phoneState}
          value={profile.phoneLabel}
        />
        <ContactLine
          icon={contactIcons.address}
          label="Adresse"
          state={profile.addressState}
          value={profile.addressLabel}
        />
      </View>
    </View>
  );
}

function ContactLine({
  icon,
  label,
  state,
  value,
}: {
  icon: SymbolName;
  label: string;
  state: ProfileFieldState;
  value: string;
}) {
  return (
    <View style={styles.contactLine}>
      <View style={styles.contactIcon}>
        <SymbolView name={icon} size={19} tintColor="#2F5FA6" />
      </View>
      <View style={styles.contactCopy}>
        <View style={styles.contactLabelRow}>
          <Text style={styles.contactLabel}>{label}</Text>
          {state !== 'complete' ? <FieldBadge state={state} /> : null}
        </View>
        <Text style={[styles.contactValue, state !== 'complete' && styles.contactValueMuted]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function FieldBadge({ state }: { state: Exclude<ProfileFieldState, 'complete'> }) {
  const isWarning = state === 'verify';

  return (
    <View style={[styles.fieldBadge, isWarning && styles.fieldBadgeWarning]}>
      <Text style={[styles.fieldBadgeText, isWarning && styles.fieldBadgeTextWarning]}>
        {isWarning ? 'À vérifier' : 'À compléter'}
      </Text>
    </View>
  );
}

function ProfileQuality({ profile }: { profile: ProfilePresentation }) {
  return (
    <View style={styles.qualityPanel}>
      <View style={styles.qualityHeading}>
        <View style={styles.qualityTitleGroup}>
          <Text style={styles.panelEyebrow}>QUALITÉ DU DOSSIER</Text>
          <Text style={styles.panelTitle}>Qualité de vos informations</Text>
        </View>
        <Text style={styles.completionValue}>{profile.profileCompletion} %</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${profile.profileCompletion}%` },
          ]}
        />
      </View>

      <View style={styles.qualityCopy}>
        <Text style={styles.completionText}>
          Votre profil est complété à {profile.profileCompletion} %.
        </Text>
        <Text style={styles.missingText}>
          {formatMissingInformation(profile.missingInformation)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  content: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  headerMobile: {
    paddingHorizontal: 0,
    paddingTop: spacing.sm,
  },
  eyebrow: {
    color: '#2F5FA6',
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
  },
  title: {
    color: '#15294D',
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  titleMobile: {
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
  },
  subtitle: {
    maxWidth: 700,
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  profileGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  stack: {
    flexDirection: 'column',
  },
  identityCard: {
    position: 'relative',
    flex: 0.9,
    minWidth: 0,
    minHeight: 330,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: spacing.xl,
    borderRadius: 20,
    backgroundColor: '#0B1220',
  },
  identityPattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.24,
  },
  patternLine: {
    position: 'absolute',
    right: -28,
    width: 220,
    height: 1,
    backgroundColor: '#6884AA',
    transform: [{ rotate: '-18deg' }],
  },
  patternLineTop: { top: 42 },
  patternLineMiddle: { top: 108 },
  patternLineBottom: { top: 174 },
  patternVertical: {
    position: 'absolute',
    top: -24,
    right: 64,
    width: 1,
    height: 230,
    backgroundColor: '#6884AA',
    transform: [{ rotate: '18deg' }],
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  initialsBlock: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(191, 216, 245, 0.32)',
    borderRadius: 18,
    backgroundColor: '#15294D',
  },
  initials: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: typography.fontWeight.bold,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(191, 216, 245, 0.24)',
    borderRadius: 16,
    backgroundColor: 'rgba(47, 95, 166, 0.2)',
  },
  secureBadgeText: {
    color: '#D6E5F7',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  identityCopy: {
    gap: spacing.sm,
  },
  identityLabel: {
    color: '#8FB7E8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  customerName: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  customerReference: {
    color: '#C8D5E6',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  contactPanel: {
    flex: 1.1,
    minWidth: 0,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.lg,
  },
  panelHeading: {
    gap: spacing.xs,
  },
  panelEyebrow: {
    color: '#2F5FA6',
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
  },
  panelTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.fontWeight.bold,
  },
  contactList: {
    gap: 0,
  },
  contactLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  contactIcon: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EDF3FA',
  },
  contactCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  contactLabelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  contactLabel: {
    color: '#6B7788',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  contactValue: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  contactValueMuted: {
    color: '#5A6470',
  },
  fieldBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#EDF3FA',
  },
  fieldBadgeWarning: {
    backgroundColor: '#FFF4DF',
  },
  fieldBadgeText: {
    color: '#2F5FA6',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  fieldBadgeTextWarning: {
    color: '#9A6200',
  },
  qualityPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  qualityHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  qualityTitleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  completionValue: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.fontWeight.bold,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: '#E9EDF3',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2F5FA6',
  },
  qualityCopy: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  completionText: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  missingText: {
    flexShrink: 1,
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  bottomGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  updatePanel: {
    flex: 1.15,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#C9D8EA',
    borderRadius: 20,
    backgroundColor: '#F3F7FC',
  },
  sectionIcon: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    fontWeight: typography.fontWeight.bold,
  },
  sectionText: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  securityPanel: {
    flex: 0.85,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  securityIcon: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EDF3FA',
  },
  securityHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  securityState: {
    color: '#2F7A58',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  authenticationRow: {
    gap: 4,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F6',
  },
  authenticationLabel: {
    color: '#6B7788',
    fontSize: typography.fontSize.xs,
  },
  authenticationValue: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  logoutButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#C9D8EA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  logoutButtonHovered: {
    borderColor: '#2F5FA6',
    backgroundColor: '#F3F7FC',
  },
  logoutButtonText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  unavailableState: {
    paddingVertical: spacing.xl,
  },
});
