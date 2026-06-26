import { useRouter } from 'expo-router';
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
import { useRepairs } from '@/features/repairs/hooks/useRepairs';
import type { RepairListItem } from '@/features/repairs/model/repair.types';
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

function matchesSearch(repair: RepairListItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return [
    repair.vehicleLabel,
    repair.vehicleModel,
    repair.brandName,
    repair.registrationNumber,
    repair.statusName,
    repair.serviceTypeName,
    repair.workshopName,
    repair.documentNumber,
    repair.receptionistName,
  ].some((value) =>
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
  const clientName = getDisplayName(
    customer?.firstName ?? user?.firstName,
    customer?.lastName ?? user?.lastName,
    customer?.email ?? user?.email
  );
  const normalizedQuery = normalizeSearchValue(searchQuery.trim());
  const filteredRepairs = useMemo(
    () =>
      repairs.filter((repair) => matchesSearch(repair, normalizedQuery)),
    [normalizedQuery, repairs]
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

          {repairsQuery.isLoading ? (
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

          {!repairsQuery.isLoading &&
          !repairsQuery.isError &&
          repairs.length === 0 ? (
            <View style={styles.statePanel}>
              <EmptyState
                title="Aucune réparation trouvée."
                message="Aucun dossier atelier n'est lié à votre compte client."
              />
            </View>
          ) : null}

          {!repairsQuery.isLoading &&
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

          {!repairsQuery.isLoading &&
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
  repair: RepairListItem;
};

function RepairCard({ repair }: RepairCardProps) {
  const router = useRouter();

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
          <Text style={styles.cardKicker}>Document</Text>
          <Text style={styles.documentNumber}>{repair.documentNumber}</Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{repair.statusName}</Text>
        </View>
      </View>

      <View style={styles.vehicleBlock}>
        <Text style={styles.brandNameCard}>{repair.brandName}</Text>
        <Text style={styles.vehicleModel}>{repair.vehicleLabel}</Text>
        <Text style={styles.registrationNumber}>
          {repair.registrationNumber}
        </Text>
      </View>

      <View style={styles.detailGrid}>
        <RepairDetail label="Type de service" value={repair.serviceTypeName} />
        <RepairDetail label="Atelier" value={repair.workshopName} />
        <RepairDetail label="Kilométrage d'entrée" value={repair.entryMileage} />
        <RepairDetail
          label="Réceptionniste"
          value={repair.receptionistName}
        />
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
        <Text style={styles.detailsButtonText}>Voir détails</Text>
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
    flexBasis: 430,
    minWidth: 300,
    maxWidth: 700,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.26)',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    gap: spacing.lg,
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
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
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: '#F5F8FC',
    gap: spacing.xs,
  },

  brandNameCard: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  vehicleModel: {
    color: '#071832',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },

  registrationNumber: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  detailItem: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 170,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#E5EBF3',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
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
    alignItems: 'center',
    justifyContent: 'center',
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
