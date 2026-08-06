import { Link, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, PropsWithChildren } from 'react';
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

type SymbolName = ComponentProps<typeof SymbolView>['name'];

export type ClientPortalRoute =
  | '/'
  | '/ai-diagnostic'
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
  icon: SymbolName;
  label: string;
  shortLabel: string;
}> = [
  {
    href: '/',
    icon: { ios: 'square.grid.2x2', android: 'dashboard', web: 'dashboard' },
    label: 'Tableau de bord',
    shortLabel: 'Accueil',
  },
  {
    href: '/repairs',
    icon: { ios: 'wrench', android: 'build', web: 'build' },
    label: 'Mes réparations',
    shortLabel: 'Réparations',
  },
  {
    href: '/appointments',
    icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
    label: 'Prendre rendez-vous',
    shortLabel: 'Rendez-vous',
  },
  {
    href: '/ai-diagnostic',
    icon: { ios: 'sparkles', android: 'smart_toy', web: 'smart_toy' },
    label: 'Assistant IA',
    shortLabel: 'Assistant IA',
  },
  {
    href: '/vehicles',
    icon: { ios: 'car', android: 'directions_car', web: 'directions_car' },
    label: 'Mes véhicules',
    shortLabel: 'Véhicules',
  },
  {
    href: '/history',
    icon: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
    label: 'Historique',
    shortLabel: 'Historique',
  },
  {
    href: '/profile',
    icon: { ios: 'person', android: 'person', web: 'person' },
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
                      <SymbolView
                        name={item.icon}
                        size={17}
                        tintColor={isActive ? '#2F5FA6' : '#66758A'}
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
              <SymbolView
                name={{
                  ios: 'rectangle.portrait.and.arrow.right',
                  android: 'logout',
                  web: 'logout',
                }}
                size={16}
                tintColor="#2F5FA6"
              />
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
    backgroundColor: '#F4F6FA',
    experimental_backgroundImage:
      'linear-gradient(135deg, #F7F9FC 0%, #F3F6FA 46%, #EEF1F7 100%)',
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
    backgroundColor: '#DCE8F7',
    opacity: 0.58,
  },

  shapeBottom: {
    width: 620,
    height: 620,
    left: -260,
    bottom: -300,
    backgroundColor: '#E8EDF5',
    opacity: 0.74,
  },

  shell: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },

  shellCompact: {
    flexDirection: 'column',
    gap: spacing.md,
    padding: spacing.md,
  },

  sidebar: {
    width: 252,
    alignSelf: 'stretch',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    gap: 10,
    shadowColor: '#15294D',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 28,
  },

  sidebarCompact: {
    width: '100%',
    padding: 12,
    gap: 10,
  },

  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  brandMark: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#15294D',
    shadowColor: '#15294D',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },

  brandMarkText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  brandCopy: {
    flex: 1,
  },

  brandName: {
    color: '#15294D',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: typography.fontWeight.bold,
  },

  brandSubname: {
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },

  profileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 16,
    backgroundColor: '#FBFCFE',
  },

  avatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E9F1FF',
  },

  avatarText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  profileCopy: {
    flex: 1,
    minWidth: 0,
  },

  profileLabel: {
    color: '#6B7788',
    fontSize: typography.fontSize.xs,
  },

  profileName: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  navList: {
    gap: 2,
  },

  navListCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  navItem: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },

  navItemCompact: {
    flexGrow: 1,
    minWidth: 124,
  },

  navItemActive: {
    backgroundColor: '#EDF4FF',
  },

  navItemHovered: {
    backgroundColor: '#F7FAFF',
  },

  navIndicator: {
    width: 3,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },

  navIndicatorActive: {
    backgroundColor: '#2F5FA6',
  },

  navItemText: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  navItemTextActive: {
    color: '#2F5FA6',
    fontWeight: typography.fontWeight.bold,
  },

  logoutButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  logoutButtonCompact: {
    alignSelf: 'flex-start',
    marginTop: 0,
  },

  logoutButtonHovered: {
    borderColor: '#BFD2EC',
    backgroundColor: '#F7FAFF',
  },

  logoutButtonText: {
    color: '#2F5FA6',
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
