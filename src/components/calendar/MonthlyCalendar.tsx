import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const DAYS_IN_GRID = 42;
const DEFAULT_LOCALE = 'fr-FR';

export type MonthlyCalendarProps = {
  initialVisibleDate?: Date | null;
  selectedDate?: Date | null;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  disableWeekends?: boolean;
  locale?: string;
  testID?: string;
  accessibilityLabel?: string;
  onSelect: (date: Date) => void;
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMondayBasedDayIndex(date: Date): number {
  const dayIndex = date.getDay();

  return dayIndex === 0 ? 6 : dayIndex - 1;
}

function isSameDate(firstDate: Date, secondDate: Date): boolean {
  return getDateKey(firstDate) === getDateKey(secondDate);
}

function isBeforeDay(firstDate: Date, secondDate: Date): boolean {
  return normalizeDate(firstDate).getTime() < normalizeDate(secondDate).getTime();
}

function isAfterDay(firstDate: Date, secondDate: Date): boolean {
  return normalizeDate(firstDate).getTime() > normalizeDate(secondDate).getTime();
}

function isWeekend(date: Date): boolean {
  const dayIndex = date.getDay();

  return dayIndex === 0 || dayIndex === 6;
}

function capitalizeFirstLetter(value: string): string {
  return value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1);
}

function formatMonthTitle(date: Date, locale: string): string {
  return capitalizeFirstLetter(
    new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    }).format(date)
  );
}

function formatAccessibilityDate(date: Date, locale: string): string {
  return capitalizeFirstLetter(
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  );
}

function getCalendarDays(monthDate: Date): CalendarDay[] {
  const monthStart = getCalendarMonth(monthDate);
  const startOffset = getMondayBasedDayIndex(monthStart);
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    monthStart.getDate() - startOffset
  );

  return Array.from({ length: DAYS_IN_GRID }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );

    return {
      date,
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

function getEffectiveMinDate(minDate?: Date): Date {
  const today = normalizeDate(new Date());

  if (!minDate) {
    return today;
  }

  const normalizedMinDate = normalizeDate(minDate);

  return isAfterDay(normalizedMinDate, today) ? normalizedMinDate : today;
}

function canNavigateToMonth(
  monthDate: Date,
  boundaryDate: Date | undefined,
  direction: 'previous' | 'next'
): boolean {
  if (!boundaryDate) {
    return true;
  }

  const targetMonth = getCalendarMonth(monthDate);
  const boundaryMonth = getCalendarMonth(boundaryDate);

  if (direction === 'previous') {
    return !isBeforeDay(targetMonth, boundaryMonth);
  }

  return !isAfterDay(targetMonth, boundaryMonth);
}

export function MonthlyCalendar({
  initialVisibleDate = null,
  selectedDate = null,
  minDate,
  maxDate,
  disabledDates = [],
  disableWeekends = true,
  locale = DEFAULT_LOCALE,
  testID,
  accessibilityLabel = 'Calendrier mensuel',
  onSelect,
}: MonthlyCalendarProps) {
  const effectiveMinDate = useMemo(() => getEffectiveMinDate(minDate), [minDate]);
  const normalizedMaxDate = useMemo(
    () => (maxDate ? normalizeDate(maxDate) : undefined),
    [maxDate]
  );
  const selectedMonth = getCalendarMonth(
    selectedDate ?? initialVisibleDate ?? effectiveMinDate
  );
  const [visibleMonth, setVisibleMonth] = useState(selectedMonth);
  const today = useMemo(() => normalizeDate(new Date()), []);
  const disabledDateKeys = useMemo(
    () => new Set(disabledDates.map((date) => getDateKey(date))),
    [disabledDates]
  );
  const calendarDays = useMemo(
    () => getCalendarDays(visibleMonth),
    [visibleMonth]
  );
  const canGoToPreviousMonth = canNavigateToMonth(
    addMonths(visibleMonth, -1),
    effectiveMinDate,
    'previous'
  );
  const canGoToNextMonth = canNavigateToMonth(
    addMonths(visibleMonth, 1),
    normalizedMaxDate,
    'next'
  );

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(getCalendarMonth(selectedDate));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate && initialVisibleDate) {
      setVisibleMonth(getCalendarMonth(initialVisibleDate));
    }
  }, [initialVisibleDate, selectedDate]);

  const handlePreviousMonth = () => {
    if (!canGoToPreviousMonth) {
      return;
    }

    setVisibleMonth((month) => addMonths(month, -1));
  };

  const handleNextMonth = () => {
    if (!canGoToNextMonth) {
      return;
    }

    setVisibleMonth((month) => addMonths(month, 1));
  };

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
      testID={testID}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Mois précédent"
          accessibilityRole="button"
          disabled={!canGoToPreviousMonth}
          onPress={handlePreviousMonth}
          style={({ hovered, pressed }) => [
            styles.navigationButton,
            hovered && canGoToPreviousMonth && styles.navigationButtonHovered,
            pressed && canGoToPreviousMonth && styles.pressed,
            !canGoToPreviousMonth && styles.disabled,
          ]}
        >
          <Text style={styles.navigationButtonText}>‹</Text>
        </Pressable>

        <Text style={styles.monthTitle}>
          {formatMonthTitle(visibleMonth, locale)}
        </Text>

        <Pressable
          accessibilityLabel="Mois suivant"
          accessibilityRole="button"
          disabled={!canGoToNextMonth}
          onPress={handleNextMonth}
          style={({ hovered, pressed }) => [
            styles.navigationButton,
            hovered && canGoToNextMonth && styles.navigationButtonHovered,
            pressed && canGoToNextMonth && styles.pressed,
            !canGoToNextMonth && styles.disabled,
          ]}
        >
          <Text style={styles.navigationButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekHeader}>
        {WEEK_DAYS.map((weekDay) => (
          <Text key={weekDay} style={styles.weekDay}>
            {weekDay}
          </Text>
        ))}
      </View>

      <View style={styles.dayGrid}>
        {calendarDays.map(({ date, isCurrentMonth }) => {
          const isSelected = Boolean(
            selectedDate && isSameDate(date, selectedDate)
          );
          const isToday = isSameDate(date, today);
          const isDisabled =
            !isCurrentMonth ||
            isBeforeDay(date, effectiveMinDate) ||
            (normalizedMaxDate ? isAfterDay(date, normalizedMaxDate) : false) ||
            (disableWeekends && isWeekend(date)) ||
            disabledDateKeys.has(getDateKey(date));
          const availabilityText = isDisabled
            ? 'non disponible'
            : isSelected
              ? 'sélectionné'
              : 'disponible';

          return (
            <Pressable
              key={getDateKey(date)}
              accessibilityLabel={`${formatAccessibilityDate(
                date,
                locale
              )}, ${availabilityText}`}
              accessibilityRole="button"
              disabled={isDisabled}
              onPress={() => {
                onSelect(normalizeDate(date));
              }}
              style={({ hovered, pressed }) => [
                styles.dayCell,
                !isCurrentMonth && styles.outsideMonthDay,
                isToday && !isDisabled && styles.todayCell,
                isSelected && styles.selectedDayCell,
                hovered && !isDisabled && !isSelected && styles.dayCellHovered,
                pressed && !isDisabled && styles.pressed,
                isDisabled && styles.disabledDayCell,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  !isCurrentMonth && styles.outsideMonthText,
                  isDisabled && styles.disabledDayText,
                  isSelected && styles.selectedDayText,
                ]}
              >
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: colors.light.background.primary,
    gap: spacing.md,
    shadowColor: '#15294D',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },

  header: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  monthTitle: {
    flex: 1,
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },

  navigationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8E2F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  navigationButtonHovered: {
    borderColor: '#BFD2EC',
    backgroundColor: '#F7FAFF',
  },

  navigationButtonText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.xl,
  },

  weekHeader: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  weekDay: {
    flex: 1,
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },

  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },

  dayCell: {
    width: '13%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  dayCellHovered: {
    borderColor: '#CFE0F5',
    backgroundColor: '#F7FAFF',
  },

  todayCell: {
    borderColor: '#2F5FA6',
  },

  selectedDayCell: {
    borderColor: '#2F5FA6',
    backgroundColor: '#2F5FA6',
    shadowColor: '#2F5FA6',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },

  disabledDayCell: {
    backgroundColor: '#F5F7FA',
  },

  outsideMonthDay: {
    opacity: 0.28,
  },

  dayText: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  selectedDayText: {
    color: colors.light.text.inverse,
    fontWeight: typography.fontWeight.bold,
  },

  disabledDayText: {
    color: '#A7B1C2',
  },

  outsideMonthText: {
    color: '#A7B1C2',
  },

  pressed: {
    opacity: 0.84,
  },

  disabled: {
    opacity: 0.46,
  },
});
