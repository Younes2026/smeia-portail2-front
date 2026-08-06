import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { breakpoints } from '@/core/theme/breakpoints';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useClientGarage } from '@/features/vehicles/hooks/useClientGarage';
import type {
  GarageTrackingTone,
  GarageVehicleViewModel,
} from '@/features/vehicles/model/client-garage.presenter';
import { getBrandLogo } from '@/features/vehicles/model/brand-logo';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const actionIcons: Record<'appointment' | 'repairs' | 'history', SymbolName> = {
  appointment: {
    ios: 'calendar.badge.plus',
    android: 'event_available',
    web: 'event_available',
  },
  repairs: { ios: 'wrench', android: 'build', web: 'build' },
  history: {
    ios: 'clock.arrow.circlepath',
    android: 'history',
    web: 'history',
  },
};

export function VehiclesScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < breakpoints.tablet;
  const garageQuery = useClientGarage();
  const vehicles = garageQuery.data;
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    if (vehicles.length === 0) {
      setSelectedVehicleId(null);
      return;
    }

    if (!vehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [selectedVehicleId, vehicles]);

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;

  if (garageQuery.isLoading) {
    return (
      <ClientPortalLayout activeRoute="/vehicles">
        <GarageSkeleton isMobile={isMobile} />
      </ClientPortalLayout>
    );
  }

  if (garageQuery.isError) {
    return (
      <ClientPortalLayout activeRoute="/vehicles">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Votre garage est temporairement indisponible"
            message="Nous ne pouvons pas afficher vos véhicules pour le moment."
            onRetry={() => {
              void garageQuery.refetch();
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
        <GarageHeader count={vehicles.length} isMobile={isMobile} />

        {vehicles.length === 0 ? (
          <EmptyGarage />
        ) : selectedVehicle ? (
          <>
            {vehicles.length > 1 ? (
              <VehicleSelector
                onSelect={(vehicleId) => {
                  setDetailVisible(false);
                  setSelectedVehicleId(vehicleId);
                }}
                selectedVehicleId={selectedVehicle.id}
                vehicles={vehicles}
              />
            ) : null}

            <View style={[styles.mainGrid, isMobile && styles.stack]}>
              <VehicleVisual
                onOpenDetail={() => {
                  setDetailVisible(true);
                }}
                vehicle={selectedVehicle}
              />

              <View style={styles.rightColumn}>
                <VehicleInformation vehicle={selectedVehicle} />
                <VehicleTracking vehicle={selectedVehicle} />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <VehicleDetailModal
        isMobile={isMobile}
        onClose={() => {
          setDetailVisible(false);
        }}
        vehicle={selectedVehicle}
        visible={detailVisible}
      />
    </ClientPortalLayout>
  );
}

function GarageHeader({ count, isMobile }: { count: number; isMobile: boolean }) {
  return (
    <View style={[styles.header, isMobile && styles.headerMobile]}>
      <View pointerEvents="none" style={styles.headerPattern}>
        <View style={[styles.headerLine, styles.headerLineFirst]} />
        <View style={[styles.headerLine, styles.headerLineSecond]} />
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.headerEyebrow}>GARAGE CLIENT</Text>
        <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>
          Mon garage SMEIA
        </Text>
        <Text style={styles.headerDescription}>
          Retrouvez les véhicules associés à votre compte et accédez à leur
          suivi SAV.
        </Text>
      </View>
      <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
        <View style={styles.vehicleCountBadge}>
          <SymbolView
            name={{ ios: 'car.2', android: 'directions_car', web: 'directions_car' }}
            size={16}
            tintColor="#C8D9ED"
          />
          <Text style={styles.vehicleCountText}>
            {count} {count === 1 ? 'véhicule' : 'véhicules'}
          </Text>
        </View>
        <Link href="/appointments" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ hovered, pressed }) => [
              styles.headerAction,
              isMobile && styles.fullWidthAction,
              hovered && styles.headerActionHovered,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={actionIcons.appointment}
              size={17}
              tintColor="#15294D"
            />
            <Text style={styles.headerActionText}>Prendre rendez-vous</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function VehicleSelector({
  onSelect,
  selectedVehicleId,
  vehicles,
}: {
  onSelect: (vehicleId: number) => void;
  selectedVehicleId: number;
  vehicles: GarageVehicleViewModel[];
}) {
  return (
    <View style={styles.selectorSection}>
      <Text style={styles.sectionEyebrow}>VOS VÉHICULES</Text>
      <ScrollView
        horizontal
        contentContainerStyle={styles.selectorContent}
        showsHorizontalScrollIndicator={false}
      >
        {vehicles.map((vehicle) => {
          const selected = vehicle.id === selectedVehicleId;
          const logo = getBrandLogo(vehicle.brandName);

          return (
            <Pressable
              accessibilityRole="button"
              key={vehicle.id}
              onPress={() => {
                onSelect(vehicle.id);
              }}
              style={({ hovered, pressed }) => [
                styles.selectorItem,
                selected && styles.selectorItemSelected,
                hovered && !selected && styles.selectorItemHovered,
                pressed && styles.pressed,
              ]}
            >
              <BrandVisual
                compact
                brandName={vehicle.brandName}
                logo={logo}
              />
              <View style={styles.selectorCopy}>
                <Text numberOfLines={1} style={styles.selectorBrand}>
                  {vehicle.brandName ?? 'Votre véhicule'}
                </Text>
                <Text numberOfLines={1} style={styles.selectorRegistration}>
                  {vehicle.registrationLabel}
                </Text>
              </View>
              {selected ? (
                <View style={styles.selectorCheck}>
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={12}
                    tintColor="#FFFFFF"
                  />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function VehicleVisual({
  onOpenDetail,
  vehicle,
}: {
  onOpenDetail: () => void;
  vehicle: GarageVehicleViewModel;
}) {
  const logo = getBrandLogo(vehicle.brandName);

  return (
    <View style={styles.vehicleVisual}>
      <View pointerEvents="none" style={styles.visualPattern}>
        <View style={[styles.visualLine, styles.visualLineOne]} />
        <View style={[styles.visualLine, styles.visualLineTwo]} />
        <View style={[styles.visualLine, styles.visualLineThree]} />
      </View>

      <View style={styles.visualTopRow}>
        <BrandVisual brandName={vehicle.brandName} logo={logo} />
        <TrackingBadge
          label={vehicle.trackingLabel}
          tone={vehicle.trackingTone}
        />
      </View>

      <View style={styles.vehicleIdentity}>
        <Text style={styles.vehicleBrand}>
          {vehicle.brandName ?? 'Votre véhicule'}
        </Text>
        {vehicle.modelName ? (
          <Text style={styles.vehicleModel}>{vehicle.modelName}</Text>
        ) : null}
        <View style={styles.registrationPlate}>
          <Text style={styles.registrationPlateText}>
            {vehicle.registrationLabel}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenDetail}
        style={({ hovered, pressed }) => [
          styles.detailAction,
          hovered && styles.detailActionHovered,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.detailActionText}>Voir la fiche véhicule</Text>
        <SymbolView
          name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
          size={16}
          tintColor="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}

function BrandVisual({
  brandName,
  compact = false,
  logo,
}: {
  brandName: string | null;
  compact?: boolean;
  logo: ReturnType<typeof getBrandLogo>;
}) {
  return (
    <View
      style={[
        compact ? styles.brandVisualCompact : styles.brandVisual,
        logo &&
          'needsLightSurface' in logo &&
          logo.needsLightSurface &&
          styles.brandVisualLight,
      ]}
    >
      {logo ? (
        <Image
          accessibilityLabel={`Logo ${logo.name}`}
          contentFit="contain"
          source={logo.source}
          style={styles.brandLogo}
        />
      ) : (
        <SymbolView
          name={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
          size={compact ? 22 : 42}
          tintColor={compact ? '#2F5FA6' : '#DCE8F6'}
        />
      )}
      {!logo && !compact && brandName ? (
        <Text style={styles.brandFallbackName}>{brandName}</Text>
      ) : null}
    </View>
  );
}

function TrackingBadge({
  label,
  tone,
}: {
  label: string;
  tone: GarageTrackingTone;
}) {
  return (
    <View
      style={[
        styles.trackingBadge,
        tone === 'active' && styles.trackingBadgeActive,
        tone === 'ready' && styles.trackingBadgeReady,
      ]}
    >
      <View
        style={[
          styles.trackingDot,
          tone === 'active' && styles.trackingDotActive,
          tone === 'ready' && styles.trackingDotReady,
        ]}
      />
      <Text style={styles.trackingBadgeText}>{label}</Text>
    </View>
  );
}

function VehicleInformation({ vehicle }: { vehicle: GarageVehicleViewModel }) {
  return (
    <View style={styles.infoPanel}>
      <View style={styles.panelHeading}>
        <Text style={styles.sectionEyebrow}>FICHE AUTOMOBILE</Text>
        <Text style={styles.sectionTitle}>Informations véhicule</Text>
      </View>
      <View style={styles.infoGrid}>
        <InfoMetric
          icon={{ ios: 'gauge.with.dots.needle.67percent', android: 'speed', web: 'speed' }}
          label="Kilométrage"
          value={vehicle.mileageLabel}
        />
        <InfoMetric
          icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
          label="Année"
          value={vehicle.yearLabel}
        />
        {vehicle.maskedVinLabel ? (
          <InfoMetric
            icon={{ ios: 'number', android: 'tag', web: 'tag' }}
            label="VIN masqué"
            value={vehicle.maskedVinLabel}
          />
        ) : null}
        {vehicle.latestVisitLabel ? (
          <InfoMetric
            icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
            label="Dernière visite"
            value={vehicle.latestVisitLabel}
          />
        ) : null}
        {vehicle.nextAppointmentLabel ? (
          <InfoMetric
            icon={actionIcons.appointment}
            label="Prochain rendez-vous"
            value={vehicle.nextAppointmentLabel}
          />
        ) : null}
      </View>
    </View>
  );
}

function InfoMetric({
  icon,
  label,
  value,
}: {
  icon: SymbolName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoMetric}>
      <View style={styles.infoIcon}>
        <SymbolView name={icon} size={18} tintColor="#2F5FA6" />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function VehicleTracking({ vehicle }: { vehicle: GarageVehicleViewModel }) {
  const trackingTitle = vehicle.brandName
    ? `Suivi de votre ${vehicle.brandName}`
    : 'Suivi de votre véhicule';

  return (
    <View style={styles.trackingPanel}>
      <View style={styles.panelHeading}>
        <Text style={styles.sectionEyebrow}>SUIVI SAV</Text>
        <Text style={styles.sectionTitle}>{trackingTitle}</Text>
      </View>

      <View style={styles.trackingList}>
        {vehicle.nextAppointmentLabel ? (
          <TrackingLine
            label="Prochain rendez-vous"
            value={vehicle.nextAppointmentLabel}
          />
        ) : null}
        <TrackingLine
          label="Réparations en cours"
          value={String(vehicle.activeRepairsCount)}
        />
        {vehicle.latestInterventionLabel ? (
          <TrackingLine
            label="Dernière intervention"
            value={vehicle.latestInterventionLabel}
          />
        ) : null}
        {vehicle.recordedMileageLabel ? (
          <TrackingLine
            label="Kilométrage enregistré"
            value={vehicle.recordedMileageLabel}
          />
        ) : null}
      </View>

      <View style={styles.actionGrid}>
        <GarageAction
          href="/appointments"
          icon={actionIcons.appointment}
          label="Prendre rendez-vous"
          primary
        />
        <GarageAction
          href="/repairs"
          icon={actionIcons.repairs}
          label="Voir mes réparations"
        />
        <GarageAction
          href="/history"
          icon={actionIcons.history}
          label="Consulter l’historique"
        />
      </View>
    </View>
  );
}

function TrackingLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.trackingLine}>
      <Text style={styles.trackingLabel}>{label}</Text>
      <Text style={styles.trackingValue}>{value}</Text>
    </View>
  );
}

function GarageAction({
  href,
  icon,
  label,
  primary = false,
}: {
  href: '/appointments' | '/history' | '/repairs';
  icon: SymbolName;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ hovered, pressed }) => [
          styles.garageAction,
          primary && styles.garageActionPrimary,
          hovered && !primary && styles.garageActionHovered,
          hovered && primary && styles.garageActionPrimaryHovered,
          pressed && styles.pressed,
        ]}
      >
        <SymbolView
          name={icon}
          size={17}
          tintColor={primary ? '#FFFFFF' : '#2F5FA6'}
        />
        <Text
          style={[
            styles.garageActionText,
            primary && styles.garageActionTextPrimary,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function VehicleDetailModal({
  isMobile,
  onClose,
  vehicle,
  visible,
}: {
  isMobile: boolean;
  onClose: () => void;
  vehicle: GarageVehicleViewModel | null;
  visible: boolean;
}) {
  if (!vehicle) {
    return null;
  }

  return (
    <Modal
      animationType={isMobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Fermer la fiche véhicule"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.modalBackdrop}
        />
        <View style={[styles.detailDrawer, isMobile && styles.detailDrawerMobile]}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerHeaderCopy}>
              <Text style={styles.sectionEyebrow}>FICHE VÉHICULE</Text>
              <Text style={styles.drawerTitle}>
                {vehicle.brandName ?? 'Votre véhicule'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Fermer"
              accessibilityRole="button"
              onPress={onClose}
              style={({ hovered, pressed }) => [
                styles.closeButton,
                hovered && styles.closeButtonHovered,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={18}
                tintColor="#15294D"
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.drawerContent}
            showsVerticalScrollIndicator
          >
            <DetailLine label="Marque" value={vehicle.brandName ?? 'Votre véhicule'} />
            {vehicle.modelName ? (
              <DetailLine label="Modèle" value={vehicle.modelName} />
            ) : null}
            <DetailLine
              label="Immatriculation"
              value={vehicle.registrationLabel}
            />
            <DetailLine label="Année" value={vehicle.yearLabel} />
            {vehicle.mileageLabel !== 'À compléter' ? (
              <DetailLine label="Kilométrage" value={vehicle.mileageLabel} />
            ) : null}
            {vehicle.fullVinLabel ? (
              <DetailLine label="VIN" value={vehicle.fullVinLabel} />
            ) : null}

            <View style={styles.readOnlyNotice}>
              <SymbolView
                name={{ ios: 'lock', android: 'lock', web: 'lock' }}
                size={16}
                tintColor="#2F5FA6"
              />
              <Text style={styles.readOnlyText}>
                Ces informations sont consultables en lecture seule.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function EmptyGarage() {
  return (
    <View style={styles.emptyPanel}>
      <View style={styles.emptyIcon}>
        <SymbolView
          name={{ ios: 'car', android: 'directions_car', web: 'directions_car' }}
          size={30}
          tintColor="#2F5FA6"
        />
      </View>
      <Text style={styles.emptyTitle}>
        Aucun véhicule n’est encore associé à votre compte SMEIA.
      </Text>
      <Text style={styles.emptyText}>
        Contactez votre conseiller SMEIA pour rattacher un véhicule à votre
        espace.
      </Text>
    </View>
  );
}

function GarageSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <View style={styles.skeletonPage}>
      <View style={styles.skeletonHeader} />
      <View style={[styles.skeletonGrid, isMobile && styles.stack]}>
        <View style={styles.skeletonVisual} />
        <View style={styles.skeletonColumn}>
          <View style={styles.skeletonPanel} />
          <View style={styles.skeletonPanel} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F4F6FA' },
  content: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  stateContainer: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  header: {
    position: 'relative',
    minHeight: 210,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: 20,
    backgroundColor: '#0B1220',
  },
  headerMobile: { minHeight: 0, flexDirection: 'column', alignItems: 'stretch' },
  headerPattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.22,
  },
  headerLine: {
    position: 'absolute',
    right: -40,
    width: 330,
    height: 1,
    backgroundColor: '#6884AA',
    transform: [{ rotate: '-16deg' }],
  },
  headerLineFirst: { top: 62 },
  headerLineSecond: { top: 142 },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.sm },
  headerEyebrow: { color: '#8FB7E8', fontSize: 11, fontWeight: '700' },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    fontWeight: '700',
  },
  headerTitleMobile: {
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
  },
  headerDescription: {
    maxWidth: 650,
    color: '#C8D5E6',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  headerActions: { alignItems: 'flex-end', gap: spacing.md },
  headerActionsMobile: { alignItems: 'stretch' },
  vehicleCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 217, 237, 0.24)',
    borderRadius: 16,
    backgroundColor: 'rgba(47, 95, 166, 0.2)',
  },
  vehicleCountText: { color: '#DCE8F6', fontSize: 12, fontWeight: '700' },
  headerAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  fullWidthAction: { width: '100%' },
  headerActionHovered: { backgroundColor: '#EDF3FA' },
  headerActionText: { color: '#15294D', fontSize: 14, fontWeight: '700' },
  selectorSection: { gap: spacing.sm },
  sectionEyebrow: { color: '#2F5FA6', fontSize: 11, fontWeight: '700' },
  selectorContent: { gap: spacing.sm, paddingBottom: 2 },
  selectorItem: {
    width: 230,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  selectorItemSelected: { borderColor: '#2F5FA6', backgroundColor: '#F3F7FC' },
  selectorItemHovered: { borderColor: '#B8C9DF' },
  selectorCopy: { flex: 1, minWidth: 0, gap: 3 },
  selectorBrand: { color: '#15294D', fontSize: 13, fontWeight: '700' },
  selectorRegistration: { color: '#5A6470', fontSize: 11 },
  selectorCheck: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#2F5FA6',
  },
  mainGrid: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.lg },
  stack: { flexDirection: 'column' },
  vehicleVisual: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    minHeight: 530,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: spacing.xl,
    borderRadius: 20,
    backgroundColor: '#0B1220',
  },
  visualPattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.22,
  },
  visualLine: {
    position: 'absolute',
    left: -80,
    width: 620,
    height: 1,
    backgroundColor: '#6884AA',
    transform: [{ rotate: '-14deg' }],
  },
  visualLineOne: { top: 150 },
  visualLineTwo: { top: 250 },
  visualLineThree: { top: 350 },
  visualTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  brandVisual: {
    width: 150,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(220, 232, 246, 0.24)',
    borderRadius: 18,
    backgroundColor: 'rgba(21, 41, 77, 0.72)',
  },
  brandVisualCompact: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
    borderRadius: 12,
    backgroundColor: '#EDF3FA',
  },
  brandVisualLight: { backgroundColor: '#FFFFFF' },
  brandLogo: { width: '100%', height: '100%' },
  brandFallbackName: {
    marginTop: spacing.sm,
    color: '#DCE8F6',
    fontSize: 11,
    fontWeight: '700',
  },
  trackingBadge: {
    maxWidth: 230,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 232, 246, 0.22)',
    borderRadius: 16,
    backgroundColor: 'rgba(90, 100, 112, 0.28)',
  },
  trackingBadgeActive: { backgroundColor: 'rgba(47, 95, 166, 0.42)' },
  trackingBadgeReady: { backgroundColor: 'rgba(37, 124, 86, 0.38)' },
  trackingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#AEB7C2' },
  trackingDotActive: { backgroundColor: '#8FB7E8' },
  trackingDotReady: { backgroundColor: '#76D0A5' },
  trackingBadgeText: { flexShrink: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  vehicleIdentity: { gap: spacing.sm },
  vehicleBrand: { color: '#8FB7E8', fontSize: 14, fontWeight: '700' },
  vehicleModel: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    fontWeight: '700',
  },
  registrationPlate: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#8FB7E8',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  registrationPlateText: { color: '#0B1220', fontSize: 18, fontWeight: '700' },
  detailAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(220, 232, 246, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  detailActionHovered: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  detailActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  rightColumn: { flex: 1.1, minWidth: 0, gap: spacing.lg },
  infoPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  panelHeading: { gap: spacing.xs },
  sectionTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: '700',
  },
  infoGrid: { gap: 0 },
  infoMetric: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  infoIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#EDF3FA',
  },
  infoCopy: { flex: 1, minWidth: 0, gap: 3 },
  infoLabel: { color: '#6B7788', fontSize: 11 },
  infoValue: { color: '#15294D', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  trackingPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  trackingList: { gap: 0 },
  trackingLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  trackingLabel: { flex: 1, color: '#5A6470', fontSize: 13 },
  trackingValue: {
    flex: 1,
    color: '#15294D',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'right',
  },
  actionGrid: { gap: spacing.sm },
  garageAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#C9D8EA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  garageActionPrimary: { borderColor: '#2F5FA6', backgroundColor: '#2F5FA6' },
  garageActionHovered: { borderColor: '#2F5FA6', backgroundColor: '#F3F7FC' },
  garageActionPrimaryHovered: { backgroundColor: '#244F8C' },
  garageActionText: { color: '#2F5FA6', fontSize: 13, fontWeight: '700' },
  garageActionTextPrimary: { color: '#FFFFFF' },
  modalRoot: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(11, 18, 32, 0.54)',
  },
  detailDrawer: {
    width: 480,
    maxWidth: '92%',
    height: '100%',
    padding: spacing.lg,
    backgroundColor: '#F4F6FA',
    gap: spacing.lg,
  },
  detailDrawerMobile: { width: '100%', maxWidth: '100%' },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  drawerHeaderCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  drawerTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  closeButtonHovered: { borderColor: '#B8C9DF', backgroundColor: '#EDF3FA' },
  drawerContent: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  detailLabel: { color: '#6B7788', fontSize: 13 },
  detailValue: {
    flex: 1,
    color: '#15294D',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: '#EDF3FA',
  },
  readOnlyText: { flex: 1, color: '#5A6470', fontSize: 12, lineHeight: 18 },
  emptyPanel: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C9D8EA',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#EDF3FA',
  },
  emptyTitle: {
    maxWidth: 560,
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    maxWidth: 560,
    color: '#5A6470',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  skeletonPage: { flex: 1, gap: spacing.lg, padding: spacing.md },
  skeletonHeader: { height: 210, borderRadius: 20, backgroundColor: '#E1E6EE' },
  skeletonGrid: { flexDirection: 'row', gap: spacing.lg },
  skeletonVisual: { flex: 1, minHeight: 530, borderRadius: 20, backgroundColor: '#D9E0E9' },
  skeletonColumn: { flex: 1.1, gap: spacing.lg },
  skeletonPanel: { flex: 1, minHeight: 245, borderRadius: 20, backgroundColor: '#E7EBF1' },
  pressed: { opacity: 0.8 },
});
