import { Link } from 'expo-router';
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
import { PageContainer } from '@/components/layout/PageContainer';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useVehicles } from '@/features/vehicles/hooks/useVehicles';
import type { VehicleListItem } from '@/features/vehicles/model/vehicle.types';
import { useAuthStore } from '@/store/auth.store';

const navigationItems = [
  {
    href: '/repairs',
    label: 'Tableau de bord',
  },
  {
    href: '/repairs',
    label: 'Mes réparations',
  },
  {
    href: '/appointments',
    label: 'Prendre rendez-vous',
  },
  {
    href: '/vehicles',
    label: 'Mes véhicules',
  },
  {
    href: '/repairs',
    label: 'Historique',
  },
  {
    href: '/repairs',
    label: 'Profil',
  },
] as const;

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'client SMEIA';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function VehiclesScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.desktop;
  const isNarrow = width < breakpoints.tablet;
  const { data, isLoading, isError, refetch } = useVehicles();
  const vehicles = data ?? [];
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const logout = useLogout();
  const clientName = getDisplayName(
    customer?.firstName ?? user?.firstName,
    customer?.lastName ?? user?.lastName,
    customer?.email ?? user?.email
  );

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Chargement de vos véhicules..." />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Erreur de chargement"
          message="Impossible de charger vos véhicules depuis Directus."
          onRetry={() => {
            refetch();
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer padded={false}>
      <View style={styles.page}>
        <View pointerEvents="none" style={[styles.backgroundShape, styles.shapeTop]} />
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
              <View>
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
                <Text style={styles.profileName}>{clientName}</Text>
              </View>
            </View>

            <View style={[styles.navList, isCompact && styles.navListCompact]}>
              {navigationItems.map((item) => {
                const isActive = item.href === '/vehicles';

                return (
                  <Link key={item.label} href={item.href} asChild>
                    <Pressable
                      accessibilityRole="link"
                      style={({ hovered, pressed }) => [
                        styles.navItem,
                        isActive && styles.navItemActive,
                        hovered && styles.navItemHovered,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.navItemText,
                          isActive && styles.navItemTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={logout.isPending}
              onPress={() => {
                logout.mutate();
              }}
              style={({ hovered, pressed }) => [
                styles.logoutButton,
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

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
          >
            <View style={[styles.header, isNarrow && styles.headerNarrow]}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Mes véhicules</Text>
                <Text style={styles.title}>Garage client SMEIA</Text>
                <Text style={styles.subtitle}>
                  Retrouvez les véhicules associés à votre compte client,
                  filtrés par votre identité Directus.
                </Text>
              </View>

              <Link href="/repairs" asChild>
                <Pressable
                  accessibilityRole="link"
                  style={({ hovered, pressed }) => [
                    styles.primaryAction,
                    hovered && styles.primaryActionHovered,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryActionText}>Retour tableau de bord</Text>
                </Pressable>
              </Link>
            </View>

            <View style={[styles.summaryGrid, isNarrow && styles.stack]}>
              <SummaryCard
                label="Véhicules enregistrés"
                value={String(vehicles.length)}
                detail="Liés à votre fiche client"
              />
              <SummaryCard
                label="Client"
                value={clientName}
                detail={customer?.email ?? user?.email ?? 'Compte SMEIA'}
              />
              <SummaryCard
                label="Accès"
                value="Sécurisé"
                detail="Filtrage par customer_id"
              />
            </View>

            {vehicles.length > 0 ? (
              <View style={styles.vehicleGrid}>
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>Aucun véhicule trouvé</Text>
                <Text style={styles.emptyText}>
                  Aucun véhicule n'est actuellement lié à votre compte client.
                  Si vous pensez qu'il s'agit d'une erreur, contactez votre
                  conseiller SMEIA.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </PageContainer>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  detail: string;
};

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryDetail}>{detail}</Text>
    </View>
  );
}

type VehicleCardProps = {
  vehicle: VehicleListItem;
};

function VehicleCard({ vehicle }: VehicleCardProps) {
  return (
    <Link
      href={{
        pathname: '/vehicles/[id]',
        params: {
          id: String(vehicle.id),
        },
      }}
      asChild
    >
      <Pressable
        accessibilityRole="link"
        style={({ hovered, pressed }) => [
          styles.vehicleCard,
          hovered && styles.cardHovered,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.vehicleCardHeader}>
          <View>
            <Text style={styles.vehicleBrand}>{vehicle.brandName}</Text>
            <Text style={styles.vehicleModel}>{vehicle.model}</Text>
          </View>
          <View style={styles.registrationBadge}>
            <Text style={styles.registrationText}>
              {vehicle.registrationNumber}
            </Text>
          </View>
        </View>

        <View style={styles.vehicleDetails}>
          <VehicleDetail label="Année" value={vehicle.year} />
          <VehicleDetail label="Kilométrage" value={vehicle.mileage} />
          <VehicleDetail label="VIN" value={vehicle.vin} />
        </View>
      </Pressable>
    </Link>
  );
}

type VehicleDetailProps = {
  label: string;
  value: string;
};

function VehicleDetail({ label, value }: VehicleDetailProps) {
  return (
    <View style={styles.vehicleDetail}>
      <Text style={styles.vehicleDetailLabel}>{label}</Text>
      <Text style={styles.vehicleDetailValue}>{value}</Text>
    </View>
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
    padding: spacing.lg,
    gap: spacing.lg,
  },

  shellCompact: {
    flexDirection: 'column',
  },

  sidebar: {
    width: 280,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.26)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
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
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
  },

  navItemActive: {
    backgroundColor: '#E7F0FB',
  },

  navItemHovered: {
    backgroundColor: '#F1F5FA',
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
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D7DFEA',
    borderRadius: 14,
    marginTop: 'auto',
    backgroundColor: '#FFFFFF',
  },

  logoutButtonHovered: {
    borderColor: '#C8D5E6',
    backgroundColor: '#F8FAFC',
  },

  logoutButtonText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  disabled: {
    opacity: 0.5,
  },

  contentScroll: {
    flex: 1,
  },

  content: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
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
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
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

  pressed: {
    opacity: 0.86,
  },

  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  stack: {
    flexDirection: 'column',
  },

  summaryCard: {
    flex: 1,
    minHeight: 126,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },

  summaryLabel: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  summaryValue: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  summaryDetail: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  vehicleCard: {
    width: '100%',
    minWidth: 280,
    maxWidth: 420,
    flexGrow: 1,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },

  cardHovered: {
    borderColor: '#B8C9DF',
    transform: [{ translateY: -1 }],
  },

  vehicleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  vehicleBrand: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  vehicleModel: {
    color: '#071832',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
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

  vehicleDetails: {
    gap: spacing.sm,
  },

  vehicleDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  vehicleDetailLabel: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
  },

  vehicleDetailValue: {
    flex: 1,
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'right',
  },

  emptyPanel: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
});
