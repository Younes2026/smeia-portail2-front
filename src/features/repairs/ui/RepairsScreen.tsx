import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
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

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useClientRepairPresentation } from '@/features/repairs/hooks/useClientRepairPresentation';
import { useRepairs } from '@/features/repairs/hooks/useRepairs';
import type { ClientRepairViewModel } from '@/features/repairs/model/client-repair.presenter';
import { getBrandLogo } from '@/features/vehicles/model/brand-logo';
import { useAuthStore } from '@/store/auth.store';

function normalizeSearchValue(value: string): string {
  return value
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'Client SMEIA';
}

function matchesSearch(
  repair: ClientRepairViewModel,
  normalizedQuery: string
): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return [
    repair.vehicleLabel,
    repair.brandName,
    repair.registrationLabel,
    repair.statusLabel,
    repair.serviceLabel,
    repair.workshopLabel,
    repair.referenceLabel,
  ].some(
    (value) =>
      value !== null &&
      normalizeSearchValue(value).includes(normalizedQuery)
  );
}

export function RepairsScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const [searchQuery, setSearchQuery] = useState('');
  const repairsQuery = useRepairs();
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const repairs = repairsQuery.data ?? [];
  const repairPresentation = useClientRepairPresentation(repairs);
  const presentedRepairs = repairPresentation.data;
  const isLoading = repairsQuery.isLoading || repairPresentation.isLoading;
  const clientName = getDisplayName(
    customer?.firstName ?? user?.firstName,
    customer?.lastName ?? user?.lastName,
    customer?.email ?? user?.email
  );
  const normalizedQuery = normalizeSearchValue(searchQuery.trim());
  const filteredRepairs = useMemo(
    () =>
      presentedRepairs.filter((repair) =>
        matchesSearch(repair, normalizedQuery)
      ),
    [normalizedQuery, presentedRepairs]
  );

  return (
    <ClientPortalLayout activeRoute="/repairs">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
          <View style={[styles.header, isNarrow && styles.headerNarrow]}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{clientName}</Text>
              <Text style={styles.title}>Mes réparations</Text>
              <Text style={styles.subtitle}>
                Consultez les dossiers atelier associés à vos véhicules et
                suivez leurs informations essentielles.
              </Text>
            </View>

            <View style={styles.totalBadge}>
              <Text style={styles.totalValue}>{repairs.length}</Text>
              <Text style={styles.totalLabel}>
                {repairs.length > 1 ? 'dossiers' : 'dossier'}
              </Text>
            </View>
          </View>

          <View style={[styles.toolbar, isNarrow && styles.toolbarNarrow]}>
            <View style={styles.searchField}>
              <Text style={styles.searchLabel}>Rechercher une réparation</Text>
              <TextInput
                accessibilityLabel="Rechercher dans les réparations"
                autoCapitalize="none"
                onChangeText={setSearchQuery}
                placeholder="Véhicule, marque, immatriculation, statut, atelier..."
                placeholderTextColor={colors.light.text.muted}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            <View style={styles.resultCount}>
              <Text style={styles.resultCountValue}>
                {filteredRepairs.length}
              </Text>
              <Text style={styles.resultCountLabel}>
                {normalizedQuery ? 'résultat(s)' : 'réparation(s)'}
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.statePanel}>
              <LoadingState message="Chargement des réparations..." />
            </View>
          ) : null}

          {repairsQuery.isError ? (
            <View style={styles.statePanel}>
              <ErrorState
                title="Impossible de charger vos réparations."
                message="Veuillez réessayer dans quelques instants."
                onRetry={() => {
                  repairsQuery.refetch();
                }}
              />
            </View>
          ) : null}

          {!isLoading &&
          !repairsQuery.isError &&
          repairs.length === 0 ? (
            <View style={styles.statePanel}>
              <EmptyState
                title="Aucune réparation trouvée."
                message="Aucun dossier atelier n'est lié à votre compte client."
              />
            </View>
          ) : null}

          {!isLoading &&
          !repairsQuery.isError &&
          repairs.length > 0 &&
          filteredRepairs.length === 0 ? (
            <View style={styles.noResultPanel}>
              <Text style={styles.noResultTitle}>
                Aucune réparation ne correspond à votre recherche.
              </Text>
              <Text style={styles.noResultText}>
                Modifiez votre recherche pour afficher d'autres dossiers.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSearchQuery('');
                }}
                style={({ hovered, pressed }) => [
                  styles.clearButton,
                  hovered && styles.clearButtonHovered,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.clearButtonText}>Effacer la recherche</Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading &&
          !repairsQuery.isError &&
          filteredRepairs.length > 0 ? (
            <View style={styles.repairGrid}>
              {filteredRepairs.map((repair) => (
                <RepairCard key={repair.id} repair={repair} />
              ))}
            </View>
          ) : null}
      </ScrollView>
    </ClientPortalLayout>
  );
}

type RepairCardProps = {
  repair: ClientRepairViewModel;
};

function RepairCard({ repair }: RepairCardProps) {
  const router = useRouter();
  const brandLogo = getBrandLogo(repair.brandName);

  const openDetails = () => {
    router.push({
      pathname: '/repairs/[id]',
      params: {
        id: String(repair.id),
      },
    });
  };

  return (
    <View style={styles.repairCard}>
      <View style={styles.cardHeader}>
        <View style={styles.documentBlock}>
          <Text style={styles.cardKicker}>Référence atelier</Text>
          <Text numberOfLines={2} style={styles.documentNumber}>
            {repair.referenceLabel}
          </Text>
          <Text style={styles.entryDate}>Entrée le {repair.entryDateLabel}</Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{repair.statusLabel}</Text>
        </View>
      </View>

      <View style={styles.vehicleBlock}>
        <View
          style={[
            styles.brandLogoFrame,
            brandLogo &&
              'needsLightSurface' in brandLogo &&
              brandLogo.needsLightSurface &&
              styles.brandLogoFrameLight,
          ]}
        >
          {brandLogo ? (
            <Image
              accessibilityLabel={`Logo ${brandLogo.name}`}
              contentFit="contain"
              source={brandLogo.source}
              style={styles.brandLogo}
            />
          ) : (
            <SymbolView
              name={{
                ios: 'car',
                android: 'directions_car',
                web: 'directions_car',
              }}
              size={28}
              tintColor="#8FB7E8"
            />
          )}
        </View>
        <View style={styles.vehicleCopy}>
          <Text style={styles.vehicleEyebrow}>Véhicule</Text>
          <Text numberOfLines={2} style={styles.vehicleModel}>
            {repair.vehicleLabel}
          </Text>
        </View>
      </View>

      <View style={styles.detailGrid}>
        <RepairDetail label="Prestation" value={repair.serviceLabel} />
        <RepairDetail label="Atelier" value={repair.workshopLabel} />
        <RepairDetail label="Réception" value={repair.entryDateLabel} />
      </View>

      <Pressable
        accessibilityRole="link"
        onPress={openDetails}
        style={({ hovered, pressed }) => [
          styles.detailsButton,
          hovered && styles.detailsButtonHovered,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.detailsButtonText}>Consulter le suivi</Text>
        <SymbolView
          name={{
            ios: 'arrow.right',
            android: 'arrow_forward',
            web: 'arrow_forward',
          }}
          size={16}
          tintColor="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}

type RepairDetailProps = {
  label: string;
  value: string;
};

function RepairDetail({ label, value }: RepairDetailProps) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },

  content: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },

  headerNarrow: {
    alignItems: 'flex-start',
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
    maxWidth: 760,
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  totalBadge: {
    minWidth: 104,
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
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  toolbarNarrow: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },

  searchField: {
    flex: 1,
    gap: spacing.sm,
  },

  searchLabel: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  searchInput: {
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D5DFEC',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    color: '#071832',
    fontSize: typography.fontSize.md,
  },

  resultCount: {
    minWidth: 112,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: '#071832',
  },

  resultCountValue: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  resultCountLabel: {
    color: '#C9D8EA',
    fontSize: typography.fontSize.xs,
  },

  statePanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  noResultPanel: {
    alignItems: 'center',
    padding: spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },

  noResultTitle: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  noResultText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
  },

  clearButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#C8D5E6',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  clearButtonHovered: {
    backgroundColor: '#F4F8FD',
  },

  clearButtonText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  repairGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: spacing.md,
  },

  repairCard: {
    flexGrow: 1,
    flexBasis: 380,
    minWidth: 300,
    maxWidth: 600,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  documentBlock: {
    flex: 1,
    gap: spacing.xs,
  },

  cardKicker: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  documentNumber: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  entryDate: {
    color: '#657386',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },

  statusBadge: {
    maxWidth: 180,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 999,
    backgroundColor: '#EDF5FD',
  },

  statusText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },

  vehicleBlock: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: '#0B1220',
  },

  brandLogoFrame: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: '#26344C',
    borderRadius: 14,
    backgroundColor: '#172238',
  },

  brandLogoFrameLight: {
    borderColor: '#D7E0EC',
    backgroundColor: '#FFFFFF',
  },

  brandLogo: {
    width: '100%',
    height: '100%',
  },

  vehicleCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },

  vehicleEyebrow: {
    color: '#8FB7E8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  vehicleModel: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  detailItem: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },

  detailLabel: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
  },

  detailValue: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  detailsButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: '#0F4C9A',
  },

  detailsButtonHovered: {
    backgroundColor: '#0B3E82',
  },

  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  pressed: {
    opacity: 0.86,
  },

});
