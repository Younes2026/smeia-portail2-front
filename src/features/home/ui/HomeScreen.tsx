import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PageContainer } from '@/components/layout/PageContainer';
import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useLogout } from '@/features/auth/hooks/useLogout';
import type { AuthCustomer, AuthUser } from '@/store/auth.store';
import { useAuthStore } from '@/store/auth.store';

const quickLinks = [
  {
    href: './repairs',
    label: 'Reparations',
    description: 'Consulter la liste Directus via TanStack Query.',
  },
  {
    href: './dictionaries-test',
    label: 'Dictionnaires',
    description: 'Verifier brands, statuses, services, ateliers et showrooms.',
  },
] as const;

function getDisplayName(
  customer: AuthCustomer | null,
  user: AuthUser | null
): string {
  const customerName = `${customer?.firstName ?? ''} ${
    customer?.lastName ?? ''
  }`.trim();
  const userName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  return customerName || userName || user?.email || 'Client connecte';
}

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const displayName = getDisplayName(customer, user);
  const logout = useLogout();

  return (
    <PageContainer>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SMEIA-PORTAIL2</Text>
        <Text style={styles.title}>Portail Client</Text>
        <Text style={styles.subtitle}>
          Base frontend Expo, Directus et TanStack Query structuree pour les
          modules metier du portail.
        </Text>
      </View>

      <View
        style={[
          styles.authPanel,
          !isAuthenticated && styles.authPanelPublic,
          isCompact && styles.authPanelCompact,
        ]}
      >
        <View style={styles.authCopy}>
          <Text style={styles.authTitle}>
            {isAuthenticated ? 'Espace client' : 'Connexion client'}
          </Text>
          <Text style={styles.authStatus}>
            {isAuthenticated
              ? `Connecte : ${displayName}`
              : 'Connectez-vous pour consulter vos reparations.'}
          </Text>
        </View>

        {isAuthenticated ? (
          <View style={[styles.authActions, isCompact && styles.authActionsCompact]}>
            <Link href="/repairs" asChild>
              <Pressable
                accessibilityRole="link"
                style={({ hovered, pressed }) => [
                  styles.authButton,
                  hovered && styles.authButtonHovered,
                  pressed && styles.authButtonPressed,
                ]}
              >
                <Text style={styles.authButtonText}>Voir mes reparations</Text>
              </Pressable>
            </Link>

            <Pressable
              accessibilityRole="button"
              disabled={logout.isPending}
              onPress={() => {
                logout.mutate();
              }}
              style={({ hovered, pressed }) => [
                styles.secondaryButton,
                hovered && !logout.isPending && styles.secondaryButtonHovered,
                pressed && !logout.isPending && styles.authButtonPressed,
                logout.isPending && styles.authButtonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {logout.isPending ? 'Deconnexion...' : 'Deconnexion'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Link href="/login" asChild>
            <Pressable style={styles.loginButton}>
              <Text style={styles.loginButtonText}>Se connecter</Text>
            </Pressable>
          </Link>
        )}
      </View>

      <View style={[styles.summaryGrid, isCompact && styles.summaryGridCompact]}>
        <View style={styles.summaryPanel}>
          <Text style={styles.summaryValue}>24h</Text>
          <Text style={styles.summaryLabel}>cache dictionnaires</Text>
        </View>

        <View style={styles.summaryPanel}>
          <Text style={styles.summaryValue}>FSD</Text>
          <Text style={styles.summaryLabel}>routes minces, features isolees</Text>
        </View>

        <View style={styles.summaryPanel}>
          <Text style={styles.summaryValue}>Web</Text>
          <Text style={styles.summaryLabel}>focus-to-refresh actif</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acces rapides</Text>

        <View style={[styles.linkGrid, isCompact && styles.linkGridCompact]}>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} asChild>
              <Pressable
                accessibilityRole="link"
                style={({ hovered, pressed }) => [
                  styles.linkPanel,
                  hovered && styles.linkPanelHovered,
                  pressed && styles.linkPanelPressed,
                ]}
              >
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkDescription}>{link.description}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  eyebrow: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.secondary,
    letterSpacing: 0,
  },

  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text.primary,
  },

  subtitle: {
    maxWidth: 720,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    color: colors.light.text.secondary,
  },

  authPanel: {
    maxWidth: 720,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
  },

  authPanelPublic: {
    borderWidth: 2,
    borderColor: colors.light.status.info,
    backgroundColor: '#EFF6FF',
  },

  authPanelCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },

  authCopy: {
    gap: spacing.xs,
  },

  authTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  authStatus: {
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },

  authActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  authActionsCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },

  authButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.brand.primary,
  },

  loginButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },

  authButtonHovered: {
    backgroundColor: colors.light.brand.secondary,
  },

  authButtonPressed: {
    opacity: 0.84,
  },

  authButtonDisabled: {
    opacity: 0.5,
  },

  authButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.inverse,
  },

  loginButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },

  secondaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.strong,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
  },

  secondaryButtonHovered: {
    borderColor: colors.light.brand.secondary,
    backgroundColor: colors.light.background.muted,
  },

  secondaryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },

  summaryGridCompact: {
    flexDirection: 'column',
  },

  summaryPanel: {
    flex: 1,
    minWidth: 180,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.xs,
  },

  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text.primary,
  },

  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },

  section: {
    gap: spacing.md,
  },

  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  linkGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  linkGridCompact: {
    flexDirection: 'column',
  },

  linkPanel: {
    flex: 1,
    minWidth: 220,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    gap: spacing.xs,
  },

  linkPanelHovered: {
    borderColor: colors.light.border.strong,
    backgroundColor: colors.light.background.secondary,
  },

  linkPanelPressed: {
    opacity: 0.84,
  },

  linkLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  linkDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    color: colors.light.text.secondary,
  },
});
