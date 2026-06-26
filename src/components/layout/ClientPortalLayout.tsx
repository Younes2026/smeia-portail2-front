import { Link, useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { PageContainer } from '@/components/layout/PageContainer';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useLogout } from '@/features/auth/hooks/useLogout';
import type { AuthCustomer, AuthUser } from '@/store/auth.store';
import { useAuthStore } from '@/store/auth.store';

export type ClientPortalRoute =
  | '/'
  | '/appointments'
  | '/history'
  | '/profile'
  | '/repairs'
  | '/vehicles';

type ClientPortalLayoutProps = PropsWithChildren<{
  activeRoute: ClientPortalRoute;
}>;

const navigationItems: ReadonlyArray<{
  href: ClientPortalRoute;
  label: string;
  shortLabel: string;
}> = [
  {
    href: '/',
    label: 'Tableau de bord',
    shortLabel: 'Accueil',
  },
  {
    href: '/repairs',
    label: 'Mes réparations',
    shortLabel: 'Réparations',
  },
  {
    href: '/appointments',
    label: 'Prendre rendez-vous',
    shortLabel: 'Rendez-vous',
  },
  {
    href: '/vehicles',
    label: 'Mes véhicules',
    shortLabel: 'Véhicules',
  },
  {
    href: '/history',
    label: 'Historique',
    shortLabel: 'Historique',
  },
  {
    href: '/profile',
    label: 'Profil',
    shortLabel: 'Profil',
  },
];

function getDisplayName(
  customer: AuthCustomer | null,
  user: AuthUser | null
): string {
  const customerName = `${customer?.firstName ?? ''} ${
    customer?.lastName ?? ''
  }`.trim();
  const userName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  return customerName || userName || customer?.email || user?.email || 'Client SMEIA';
}

function getInitials(name: string): string {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'SC';
}

export function ClientPortalLayout({
  activeRoute,
  children,
}: ClientPortalLayoutProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.desktop;
  const router = useRouter();
  const customer = useAuthStore((state) => state.customer);
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const clientName = getDisplayName(customer, user);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        router.replace('/login');
      },
    });
  };

  return (
    <PageContainer padded={false}>
      <View style={styles.page}>
        <View
          pointerEvents="none"
          style={[styles.backgroundShape, styles.shapeTop]}
        />
        <View
          pointerEvents="none"
          style={[styles.backgroundShape, styles.shapeBottom]}
        />

        <View style={[styles.shell, isCompact && styles.shellCompact]}>
          <View style={[styles.sidebar, isCompact && styles.sidebarCompact]}>
            <View style={styles.brandBlock}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>S</Text>
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>SMEIA</Text>
                <Text style={styles.brandSubname}>Portail client</Text>
              </View>
            </View>

            <View style={styles.profileBlock}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(clientName)}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileLabel}>Compte client</Text>
                <Text numberOfLines={2} style={styles.profileName}>
                  {clientName}
                </Text>
              </View>
            </View>

            <View style={[styles.navList, isCompact && styles.navListCompact]}>
              {navigationItems.map((item) => {
                const isActive = item.href === activeRoute;

                return (
                  <Link key={item.href} href={item.href} asChild>
                    <Pressable
                      accessibilityRole="link"
                      style={({ hovered, pressed }) => [
                        styles.navItem,
                        isCompact && styles.navItemCompact,
                        isActive && styles.navItemActive,
                        hovered && !isActive && styles.navItemHovered,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.navIndicator,
                          isActive && styles.navIndicatorActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.navItemText,
                          isActive && styles.navItemTextActive,
                        ]}
                      >
                        {isCompact ? item.shortLabel : item.label}
                      </Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={logout.isPending}
              onPress={handleLogout}
              style={({ hovered, pressed }) => [
                styles.logoutButton,
                isCompact && styles.logoutButtonCompact,
                hovered && !logout.isPending && styles.logoutButtonHovered,
                pressed && !logout.isPending && styles.pressed,
                logout.isPending && styles.disabled,
              ]}
            >
              <Text style={styles.logoutButtonText}>
                {logout.isPending ? 'Déconnexion...' : 'Déconnexion'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.contentArea}>{children}</View>
        </View>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F4F7FB',
    experimental_backgroundImage:
      'linear-gradient(135deg, #F8FAFC 0%, #EEF3F8 48%, #E7EEF7 100%)',
  },

  backgroundShape: {
    position: 'absolute',
    borderRadius: 999,
  },

  shapeTop: {
    width: 520,
    height: 520,
    top: -220,
    right: -140,
    backgroundColor: '#D6E2F2',
    opacity: 0.72,
  },

  shapeBottom: {
    width: 620,
    height: 620,
    left: -260,
    bottom: -300,
    backgroundColor: '#E3E8F0',
    opacity: 0.86,
  },

  shell: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
  },

  shellCompact: {
    flexDirection: 'column',
    gap: spacing.md,
    padding: spacing.md,
  },

  sidebar: {
    width: 280,
    alignSelf: 'stretch',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.26)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },

  sidebarCompact: {
    width: '100%',
    padding: spacing.md,
    gap: spacing.md,
  },

  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  brandMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#071832',
  },

  brandMarkText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  brandCopy: {
    flex: 1,
  },

  brandName: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  brandSubname: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
  },

  profileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E5EBF3',
    borderRadius: 18,
    backgroundColor: '#F3F6FA',
  },

  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#DDE8F6',
  },

  avatarText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  profileCopy: {
    flex: 1,
    minWidth: 0,
  },

  profileLabel: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
  },

  profileName: {
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  navList: {
    gap: spacing.xs,
  },

  navListCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  navItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
  },

  navItemCompact: {
    flexGrow: 1,
    minWidth: 124,
  },

  navItemActive: {
    backgroundColor: '#E7F0FB',
  },

  navItemHovered: {
    backgroundColor: '#F3F6FA',
  },

  navIndicator: {
    width: 3,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },

  navIndicatorActive: {
    backgroundColor: '#1E5AA8',
  },

  navItemText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  navItemTextActive: {
    color: '#0F4C9A',
    fontWeight: typography.fontWeight.bold,
  },

  logoutButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D7DFEA',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  logoutButtonCompact: {
    alignSelf: 'flex-start',
    marginTop: 0,
  },

  logoutButtonHovered: {
    borderColor: '#B8C9DF',
    backgroundColor: '#F8FAFC',
  },

  logoutButtonText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  contentArea: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },

  pressed: {
    opacity: 0.84,
  },

  disabled: {
    opacity: 0.5,
  },
});
