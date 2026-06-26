import { Link, useLocalSearchParams } from 'expo-router';
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
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useVehicleDetail } from '@/features/vehicles/hooks/useVehicles';
import type {
  VehicleListItem,
  VehicleRepairListItem,
} from '@/features/vehicles/model/vehicle.types';

function parseVehicleId(value: string | string[] | undefined): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return null;
  }

  const vehicleId = Number.parseInt(rawValue, 10);

  return Number.isNaN(vehicleId) ? null : vehicleId;
}

export function VehicleDetailScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoints.tablet;
  const params = useLocalSearchParams();
  const vehicleId = parseVehicleId(params.id);
  const { data, isLoading, isError, refetch } = useVehicleDetail(vehicleId);
  const vehicle = data?.vehicle ?? null;
  const repairs = data?.repairs ?? [];

  if (isLoading) {
    return (
      <ClientPortalLayout activeRoute="/vehicles">
        <View style={styles.stateContainer}>
          <LoadingState message="Chargement du véhicule..." />
        </View>
      </ClientPortalLayout>
    );
  }

  if (isError) {
    return (
      <ClientPortalLayout activeRoute="/vehicles">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Erreur de chargement"
            message="Impossible de charger le détail du véhicule."
            onRetry={() => {
              refetch();
            }}
          />
        </View>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout activeRoute="/vehicles">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
          <View style={[styles.header, isNarrow && styles.headerNarrow]}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Détail véhicule</Text>
              <Text style={styles.title}>
                {vehicle ? `${vehicle.brandName} ${vehicle.model}` : 'Véhicule introuvable'}
              </Text>
              <Text style={styles.subtitle}>
                Consultation sécurisée des informations véhicule et des
                réparations associées.
              </Text>
            </View>

            <Link href="/vehicles" asChild>
              <Pressable
                accessibilityRole="link"
                style={({ hovered, pressed }) => [
                  styles.secondaryAction,
                  hovered && styles.secondaryActionHovered,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryActionText}>Retour aux véhicules</Text>
              </Pressable>
            </Link>
          </View>

          {vehicle ? (
            <>
              <View style={[styles.mainGrid, isNarrow && styles.stack]}>
                <VehicleOverview vehicle={vehicle} />

                <View style={styles.panel}>
                  <Text style={styles.sectionKicker}>Identité véhicule</Text>
                  <Text style={styles.sectionTitle}>Informations techniques</Text>
                  <View style={styles.detailGrid}>
                    <DetailLine label="Marque" value={vehicle.brandName} />
                    <DetailLine label="Modèle" value={vehicle.model} />
                    <DetailLine
                      label="Immatriculation"
                      value={vehicle.registrationNumber}
                    />
                    <DetailLine label="Année" value={vehicle.year} />
                    <DetailLine label="Kilométrage" value={vehicle.mileage} />
                    <DetailLine label="VIN" value={vehicle.vin} />
                  </View>
                </View>
              </View>

              <View style={styles.panel}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionKicker}>Historique atelier</Text>
                    <Text style={styles.sectionTitle}>Réparations liées</Text>
                  </View>
                  <Text style={styles.sectionMeta}>
                    {repairs.length} dossier(s)
                  </Text>
                </View>

                {repairs.length > 0 ? (
                  <View style={styles.repairGrid}>
                    {repairs.map((repair) => (
                      <RepairCard key={repair.id} repair={repair} />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyPanel}>
                    <Text style={styles.emptyTitle}>Aucune réparation liée</Text>
                    <Text style={styles.emptyText}>
                      Aucun dossier atelier n'est actuellement associé à ce
                      véhicule.
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>Véhicule introuvable</Text>
              <Text style={styles.emptyText}>
                Ce véhicule n'existe pas ou n'est pas lié à votre profil client.
              </Text>
            </View>
          )}
      </ScrollView>
    </ClientPortalLayout>
  );
}

type VehicleOverviewProps = {
  vehicle: VehicleListItem;
};

function VehicleOverview({ vehicle }: VehicleOverviewProps) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroKicker}>{vehicle.brandName}</Text>
      <Text style={styles.heroTitle}>{vehicle.model}</Text>
      <View style={styles.registrationBadge}>
        <Text style={styles.registrationText}>{vehicle.registrationNumber}</Text>
      </View>
      <Text style={styles.heroMeta}>
        {vehicle.year} · {vehicle.mileage}
      </Text>
    </View>
  );
}

type RepairCardProps = {
  repair: VehicleRepairListItem;
};

function RepairCard({ repair }: RepairCardProps) {
  return (
    <View style={styles.repairCard}>
      <View style={styles.repairHeader}>
        <Text style={styles.repairDocument}>{repair.documentNumber}</Text>
        <Text style={styles.repairStatus}>{repair.statusName}</Text>
      </View>
      <DetailLine label="Service" value={repair.serviceTypeName} />
      <DetailLine label="Atelier" value={repair.workshopName} />
      <DetailLine label="Date d'entrée" value={repair.entryDate} />
      <DetailLine label="Coût final" value={repair.finalCost} />
    </View>
  );
}

type DetailLineProps = {
  label: string;
  value: string;
};

function DetailLine({ label, value }: DetailLineProps) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  },

  content: {
    gap: spacing.lg,
    padding: spacing.sm,
    paddingBottom: spacing.xl,
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
    maxWidth: 760,
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  secondaryAction: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#C8D5E6',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  secondaryActionHovered: {
    backgroundColor: '#F4F8FD',
  },

  secondaryActionText: {
    color: '#10243F',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  pressed: {
    opacity: 0.86,
  },

  mainGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'stretch',
  },

  stack: {
    flexDirection: 'column',
  },

  heroCard: {
    flex: 1,
    minHeight: 260,
    justifyContent: 'flex-end',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 28,
    backgroundColor: '#071832',
    gap: spacing.sm,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.16,
    shadowRadius: 34,
  },

  heroKicker: {
    color: '#8FB7E8',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },

  heroMeta: {
    color: '#D6E2F2',
    fontSize: typography.fontSize.md,
  },

  registrationBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#8FB7E8',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  registrationText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  panel: {
    flex: 1,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: spacing.lg,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  sectionKicker: {
    color: '#1E5AA8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  sectionTitle: {
    color: '#071832',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  sectionMeta: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  detailGrid: {
    gap: spacing.sm,
  },

  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  detailLabel: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
  },

  detailValue: {
    flex: 1,
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'right',
  },

  repairGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  repairCard: {
    minWidth: 280,
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E8F1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },

  repairHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  repairDocument: {
    color: '#071832',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  repairStatus: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
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
