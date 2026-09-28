import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthlyCalendar } from '@/components/calendar/MonthlyCalendar';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import type {
  AiBookingAvailabilityOption,
  AiBookingPreferredPeriod,
} from '@/core/api/ai-booking.api';
import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import {
  useCrcAlternativeDaySlots,
  useCrcAlternativeSlots,
  useCrcAvailabilityCalendar,
} from '@/features/crc/requests/hooks/useCrcAlternativeSlots';
import {
  CRC_AVAILABILITY_PERIOD_OPTIONS,
  crcCalendarDateToIso,
  crcIsoDateToCalendarDate,
  createCrcRetainedSlot,
  formatCrcAlternativeSlotDate,
  formatCrcAlternativeSlotTime,
  getCrcAlternativeSlotsErrorMessage,
  getCrcCalendarInitialVisibleDate,
  getCrcCalendarUnavailableDates,
  isCrcRetainedSlot,
  type CrcRetainedSlot,
} from '@/features/crc/requests/model/crc-alternative-slots';
import { isCrcAppointmentActionable } from '@/features/crc/requests/model/crc-appointment-actions';
import type { CrcAppointmentViewModel } from '@/features/crc/requests/model/crc-appointment.presenter';

type CrcAlternativeSlotsDrawerProps = {
  appointment: CrcAppointmentViewModel;
};

function ContextLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.contextLine}>
      <Text style={styles.contextLabel}>{label}</Text>
      <Text style={styles.contextValue}>{value}</Text>
    </View>
  );
}

function SlotChoice({
  compact = false,
  option,
  retainedSlot,
  onRetain,
}: {
  compact?: boolean;
  option: AiBookingAvailabilityOption;
  retainedSlot: CrcRetainedSlot | null;
  onRetain: (option: AiBookingAvailabilityOption) => void;
}) {
  const isSelected = isCrcRetainedSlot(option, retainedSlot);

  return (
    <Pressable
      accessibilityLabel={`Retenir le ${formatCrcAlternativeSlotDate(
        option.requested_date
      )} à ${formatCrcAlternativeSlotTime(option.requested_time)}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={() => onRetain(option)}
      style={({ hovered, pressed }) => [
        styles.slotCard,
        compact && styles.slotCardCompact,
        isSelected && styles.slotCardSelected,
        hovered && !isSelected && styles.slotCardHovered,
        pressed && styles.controlPressed,
      ]}
    >
      <View style={styles.slotCopy}>
        <Text style={styles.slotDate}>
          {formatCrcAlternativeSlotDate(option.requested_date)}
        </Text>
        <Text style={styles.slotMetadata}>
          {formatCrcAlternativeSlotTime(option.requested_time)} ·{' '}
          {option.workshop_name}
        </Text>
      </View>
      <View
        style={[
          styles.retainBadge,
          isSelected && styles.retainBadgeSelected,
        ]}
      >
        <Text
          style={[
            styles.retainBadgeText,
            isSelected && styles.retainBadgeTextSelected,
          ]}
        >
          {isSelected ? 'Créneau retenu' : 'Retenir ce créneau'}
        </Text>
      </View>
    </Pressable>
  );
}

export function CrcAlternativeSlotsDrawer({
  appointment,
}: CrcAlternativeSlotsDrawerProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;
  const [visible, setVisible] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<
    string | null
  >(null);
  const [selectedPeriod, setSelectedPeriod] =
    useState<AiBookingPreferredPeriod>('any');
  const [retainedSlot, setRetainedSlot] = useState<CrcRetainedSlot | null>(
    null
  );
  const availabilityQuery = {
    appointmentId: appointment.id,
    vehicleId: appointment.vehicleId,
    serviceTypeId: appointment.serviceTypeId,
    showroomId: appointment.showroomId,
    workshopId: appointment.workshopId,
    workshopType: appointment.workshopType,
    requestedDate: appointment.requestedDate,
    requestedTime: appointment.requestedTime,
  };
  const quickSlotsQuery = useCrcAlternativeSlots(availabilityQuery, visible);
  const calendarQuery = useCrcAvailabilityCalendar(availabilityQuery, visible);
  const daySlotsQuery = useCrcAlternativeDaySlots(
    availabilityQuery,
    selectedCalendarDate,
    selectedPeriod,
    visible
  );
  const calendarMinimumDate = useMemo(
    () =>
      calendarQuery.data
        ? crcIsoDateToCalendarDate(calendarQuery.data.horizon_start)
        : null,
    [calendarQuery.data]
  );
  const calendarMaximumDate = useMemo(
    () =>
      calendarQuery.data
        ? crcIsoDateToCalendarDate(calendarQuery.data.horizon_end)
        : null,
    [calendarQuery.data]
  );
  const calendarInitialVisibleDate = useMemo(
    () =>
      calendarQuery.data
        ? getCrcCalendarInitialVisibleDate(
            appointment.requestedDate,
            calendarQuery.data
          )
        : null,
    [appointment.requestedDate, calendarQuery.data]
  );
  const calendarSelectedDate = useMemo(
    () =>
      selectedCalendarDate
        ? crcIsoDateToCalendarDate(selectedCalendarDate)
        : null,
    [selectedCalendarDate]
  );
  const calendarUnavailableDates = useMemo(
    () =>
      calendarQuery.data
        ? getCrcCalendarUnavailableDates(calendarQuery.data)
        : [],
    [calendarQuery.data]
  );

  if (!isCrcAppointmentActionable(appointment.status)) {
    return null;
  }

  const resetLocalSelection = () => {
    setSelectedCalendarDate(null);
    setSelectedPeriod('any');
    setRetainedSlot(null);
  };

  const openDrawer = () => {
    resetLocalSelection();
    setVisible(true);
  };

  const closeDrawer = () => {
    resetLocalSelection();
    setVisible(false);
  };

  const retainOption = (option: AiBookingAvailabilityOption) => {
    setSelectedCalendarDate(option.requested_date);
    setSelectedPeriod('any');
    setRetainedSlot(createCrcRetainedSlot(option));
  };

  const selectCalendarDate = (date: Date) => {
    setSelectedCalendarDate(crcCalendarDateToIso(date));
    setSelectedPeriod('any');
    setRetainedSlot(null);
  };

  return (
    <View style={styles.triggerSection}>
      <View style={styles.triggerCopy}>
        <Text style={styles.triggerEyebrow}>DISPONIBILITÉS ATELIER</Text>
        <Text style={styles.triggerTitle}>Le créneau demandé ne convient pas ?</Text>
        <Text style={styles.triggerMessage}>
          Consultez les prochaines disponibilités du même atelier sans modifier
          la demande.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={openDrawer}
        style={({ hovered, pressed }) => [
          styles.triggerButton,
          hovered && styles.triggerButtonHovered,
          pressed && styles.controlPressed,
        ]}
      >
        <Text style={styles.triggerButtonText}>Proposer un autre créneau</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={closeDrawer}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fermer le panneau des créneaux"
            accessibilityRole="button"
            onPress={closeDrawer}
            style={styles.backdrop}
          />
          <SafeAreaView
            style={[styles.drawer, isCompact && styles.drawerCompact]}
          >
            <View style={styles.drawerHeader}>
              <View style={styles.drawerHeaderCopy}>
                <Text style={styles.drawerEyebrow}>ALTERNATIVES DISPONIBLES</Text>
                <Text style={styles.drawerTitle}>Proposer un autre créneau</Text>
                <Text style={styles.drawerSubtitle}>
                  Consultation uniquement — aucune modification du rendez-vous.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={closeDrawer}
                style={({ hovered, pressed }) => [
                  styles.closeButton,
                  hovered && styles.closeButtonHovered,
                  pressed && styles.controlPressed,
                ]}
              >
                <Text style={styles.closeButtonText}>Fermer</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.drawerContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.contextCard}>
                <Text style={styles.contextTitle}>Demande actuelle</Text>
                <View
                  style={[
                    styles.contextGrid,
                    isCompact && styles.contextGridCompact,
                  ]}
                >
                  <ContextLine
                    label="Atelier demandé"
                    value={appointment.workshopName}
                  />
                  <ContextLine
                    label="Service demandé"
                    value={appointment.serviceTypeName}
                  />
                  <ContextLine
                    label="Créneau initial"
                    value={appointment.requestedSlot}
                  />
                </View>
              </View>

              <View style={styles.helpBanner}>
                <Text style={styles.helpTitle}>
                  À communiquer au client par téléphone
                </Text>
                <Text style={styles.helpMessage}>
                  Retenir un créneau ici reste une sélection locale et ne réserve
                  aucune place.
                </Text>
              </View>

              <View style={styles.resultsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.resultsTitle}>3 propositions rapides</Text>
                  <Text style={styles.sectionCaption}>
                    Prochains créneaux calculés par le moteur existant.
                  </Text>
                </View>

                {quickSlotsQuery.isLoading ? (
                  <View style={styles.stateContainer}>
                    <LoadingState message="Recherche des disponibilités de l’atelier..." />
                  </View>
                ) : quickSlotsQuery.isError ? (
                  <ErrorState
                    message={getCrcAlternativeSlotsErrorMessage(
                      quickSlotsQuery.error
                    )}
                    onRetry={() => {
                      void quickSlotsQuery.refetch();
                    }}
                    title="Disponibilités indisponibles"
                  />
                ) : (quickSlotsQuery.data?.length ?? 0) === 0 ? (
                  <EmptyState
                    message="Aucune disponibilité différente du créneau actuellement demandé n’a été trouvée pour cet atelier."
                    title="Aucun créneau rapide disponible"
                  />
                ) : (
                  <View style={styles.quickSlotGrid}>
                    {quickSlotsQuery.data?.map((option) => (
                      <SlotChoice
                        key={`${option.workshop_id}:${option.requested_date}:${option.requested_time}`}
                        onRetain={retainOption}
                        option={option}
                        retainedSlot={retainedSlot}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.calendarSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.calendarSectionTitle}>
                    Choisir une autre date
                  </Text>
                  <Text style={styles.sectionCaption}>
                    Horizon sécurisé de 30 jours, calculé en heure de Casablanca.
                  </Text>
                </View>

                {calendarQuery.isLoading ? (
                  <View style={styles.calendarLoadingContainer}>
                    <LoadingState message="Chargement du calendrier des disponibilités..." />
                  </View>
                ) : calendarQuery.isError ? (
                  <ErrorState
                    message={getCrcAlternativeSlotsErrorMessage(
                      calendarQuery.error
                    )}
                    onRetry={() => {
                      void calendarQuery.refetch();
                    }}
                    title="Calendrier indisponible"
                  />
                ) : calendarMinimumDate &&
                  calendarMaximumDate &&
                  calendarQuery.data ? (
                  <View
                    style={[
                      styles.calendarHoursLayout,
                      isCompact && styles.calendarHoursLayoutCompact,
                    ]}
                  >
                    <View style={styles.calendarColumn}>
                      <Text style={styles.fieldLabel}>Date disponible</Text>
                      <MonthlyCalendar
                        accessibilityLabel="Calendrier des disponibilités CRC"
                        disabledDates={calendarUnavailableDates}
                        disableWeekends
                        initialVisibleDate={calendarInitialVisibleDate}
                        maxDate={calendarMaximumDate}
                        minDate={calendarMinimumDate}
                        onSelect={selectCalendarDate}
                        selectedDate={calendarSelectedDate}
                      />
                    </View>

                    <View style={styles.hoursPanel}>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.hoursTitle}>
                          Horaires disponibles
                        </Text>
                        <Text style={styles.sectionCaption}>
                          {selectedCalendarDate
                            ? formatCrcAlternativeSlotDate(
                                selectedCalendarDate
                              )
                            : 'Sélectionnez une date disponible.'}
                        </Text>
                      </View>

                      <Text style={styles.fieldLabel}>Période</Text>
                      <View style={styles.periodRow}>
                        {CRC_AVAILABILITY_PERIOD_OPTIONS.map((period) => {
                          const isSelected = selectedPeriod === period.value;

                          return (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected }}
                              key={period.value}
                              onPress={() => {
                                setSelectedPeriod(period.value);
                                setRetainedSlot(null);
                              }}
                              style={({ hovered, pressed }) => [
                                styles.periodButton,
                                isSelected && styles.periodButtonSelected,
                                hovered &&
                                  !isSelected &&
                                  styles.periodButtonHovered,
                                pressed && styles.controlPressed,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.periodButtonText,
                                  isSelected && styles.periodButtonTextSelected,
                                ]}
                              >
                                {period.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {selectedCalendarDate === null ? (
                        <View style={styles.hoursPlaceholder}>
                          <Text style={styles.hoursPlaceholderText}>
                            Cliquez sur une date disponible pour charger ses
                            horaires.
                          </Text>
                        </View>
                      ) : daySlotsQuery.isLoading ? (
                        <View style={styles.stateContainer}>
                          <LoadingState message="Recherche des horaires disponibles..." />
                        </View>
                      ) : daySlotsQuery.isError ? (
                        <ErrorState
                          message={getCrcAlternativeSlotsErrorMessage(
                            daySlotsQuery.error
                          )}
                          onRetry={() => {
                            void daySlotsQuery.refetch();
                          }}
                          title="Horaires indisponibles"
                        />
                      ) : (daySlotsQuery.data?.length ?? 0) === 0 ? (
                        <EmptyState
                          message="Aucun autre créneau disponible pour cet atelier à cette date."
                          title="Aucun horaire disponible"
                        />
                      ) : (
                        <View style={styles.daySlotGrid}>
                          {daySlotsQuery.data?.map((option) => (
                            <SlotChoice
                              compact
                              key={`${option.workshop_id}:${option.requested_date}:${option.requested_time}`}
                              onRetain={retainOption}
                              option={option}
                              retainedSlot={retainedSlot}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <EmptyState
                    message="Le moteur n’a retourné aucun horizon de calendrier exploitable."
                    title="Calendrier indisponible"
                  />
                )}
              </View>

              {retainedSlot ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={styles.selectedBanner}
                >
                  <Text style={styles.selectedBannerTitle}>
                    Créneau retenu :{' '}
                    {formatCrcAlternativeSlotDate(retainedSlot.requestedDate)} à{' '}
                    {formatCrcAlternativeSlotTime(retainedSlot.requestedTime)} —
                    à communiquer au client par téléphone
                  </Text>
                  <Text style={styles.selectedBannerMessage}>
                    Sélection locale uniquement. Aucune proposition, notification
                    ou réservation n’a été enregistrée.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  triggerSection: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  triggerCopy: {
    minWidth: 260,
    flex: 1,
    gap: spacing.xs,
  },
  triggerEyebrow: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    letterSpacing: 0.8,
  },
  triggerTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  triggerMessage: {
    maxWidth: 620,
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  triggerButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.status.info,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerButtonHovered: {
    backgroundColor: colors.light.background.muted,
  },
  triggerButtonText: {
    color: colors.light.status.info,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  modalRoot: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.light.brand.primary,
    opacity: 0.48,
  },
  drawer: {
    width: 1040,
    maxWidth: '96%',
    height: '100%',
    backgroundColor: colors.light.background.primary,
    borderLeftWidth: 1,
    borderLeftColor: colors.light.border.default,
  },
  drawerCompact: {
    width: '100%',
    maxWidth: '100%',
  },
  drawerHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border.default,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  drawerHeaderCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
  },
  drawerEyebrow: {
    color: colors.light.status.info,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    letterSpacing: 0.8,
  },
  drawerTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.fontWeight.bold,
  },
  drawerSubtitle: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  closeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
  },
  closeButtonHovered: {
    backgroundColor: colors.light.background.muted,
  },
  closeButtonText: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  drawerContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  contextCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    gap: spacing.md,
  },
  contextTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  contextGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  contextGridCompact: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  contextLine: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
  },
  contextLabel: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.xs,
  },
  contextValue: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  helpBanner: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.status.info,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.xs,
  },
  helpTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  helpMessage: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  resultsSection: {
    gap: spacing.md,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  resultsTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  sectionCaption: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  stateContainer: {
    minHeight: 160,
    justifyContent: 'center',
  },
  quickSlotGrid: {
    gap: spacing.sm,
  },
  slotCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  slotCardCompact: {
    padding: spacing.sm,
  },
  slotCardSelected: {
    borderColor: colors.light.status.info,
    backgroundColor: colors.light.background.muted,
  },
  slotCardHovered: {
    borderColor: colors.light.border.strong,
    backgroundColor: colors.light.background.secondary,
  },
  slotCopy: {
    flex: 1,
    minWidth: 150,
    gap: spacing.xs,
  },
  slotDate: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  slotMetadata: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  retainBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.light.border.strong,
    borderRadius: spacing.xs,
    backgroundColor: colors.light.background.primary,
  },
  retainBadgeSelected: {
    borderColor: colors.light.status.info,
    backgroundColor: colors.light.status.info,
  },
  retainBadgeText: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  retainBadgeTextSelected: {
    color: colors.light.text.inverse,
  },
  calendarSection: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.light.border.default,
    gap: spacing.lg,
  },
  calendarSectionTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  calendarLoadingContainer: {
    minHeight: 300,
    justifyContent: 'center',
  },
  calendarHoursLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  calendarHoursLayoutCompact: {
    flexDirection: 'column',
  },
  calendarColumn: {
    width: 430,
    maxWidth: '100%',
    gap: spacing.sm,
  },
  hoursPanel: {
    minWidth: 0,
    minHeight: 420,
    flex: 1,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.md,
  },
  hoursTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  fieldLabel: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  periodButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodButtonSelected: {
    borderColor: colors.light.brand.primary,
    backgroundColor: colors.light.brand.primary,
  },
  periodButtonHovered: {
    borderColor: colors.light.border.strong,
    backgroundColor: colors.light.background.muted,
  },
  periodButtonText: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  periodButtonTextSelected: {
    color: colors.light.text.inverse,
  },
  hoursPlaceholder: {
    minHeight: 180,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursPlaceholderText: {
    maxWidth: 360,
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  daySlotGrid: {
    gap: spacing.sm,
  },
  selectedBanner: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.status.success,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.xs,
  },
  selectedBannerTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  selectedBannerMessage: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  controlPressed: {
    opacity: 0.8,
  },
});
