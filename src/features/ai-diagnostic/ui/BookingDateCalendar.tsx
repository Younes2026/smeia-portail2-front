import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const CALENDAR_DAY_COUNT = 42;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type MonthParts = Pick<DateParts, 'year' | 'month'>;

type CalendarDay = {
  date: DateParts;
  isoDate: string;
  isCurrentMonth: boolean;
};

export type BookingDateCalendarProps = {
  compact: boolean;
  disabled?: boolean;
  minimumDate: string;
  onSelect: (isoDate: string) => void;
  selectedDate: string | null;
};

function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function toIsoDate({ year, month, day }: DateParts): string {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function toUtcDate({ year, month, day }: DateParts): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toMonthParts(date: DateParts): MonthParts {
  return { year: date.year, month: date.month };
}

function getMonthIndex({ year, month }: MonthParts): number {
  return year * 12 + month - 1;
}

function addMonths(month: MonthParts, amount: number): MonthParts {
  const date = new Date(Date.UTC(month.year, month.month - 1 + amount, 1, 12));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

function addDays(date: DateParts, amount: number): DateParts {
  const nextDate = new Date(
    Date.UTC(date.year, date.month - 1, date.day + amount, 12)
  );

  return {
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  };
}

function getMondayBasedDayIndex(date: DateParts): number {
  const dayIndex = toUtcDate(date).getUTCDay();

  return dayIndex === 0 ? 6 : dayIndex - 1;
}

function getCalendarDays(visibleMonth: MonthParts): CalendarDay[] {
  const firstDay = { ...visibleMonth, day: 1 };
  const gridStart = addDays(firstDay, -getMondayBasedDayIndex(firstDay));

  return Array.from({ length: CALENDAR_DAY_COUNT }, (_, index) => {
    const date = addDays(gridStart, index);

    return {
      date,
      isoDate: toIsoDate(date),
      isCurrentMonth:
        date.year === visibleMonth.year && date.month === visibleMonth.month,
    };
  });
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1);
}

function formatMonth(month: MonthParts): string {
  return capitalize(
    new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      timeZone: 'UTC',
      year: 'numeric',
    }).format(toUtcDate({ ...month, day: 1 }))
  );
}

function formatLongDate(date: DateParts): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(toUtcDate(date));
}

function getCalendarWeeks(days: CalendarDay[]): CalendarDay[][] {
  return Array.from({ length: 6 }, (_, weekIndex) =>
    days.slice(weekIndex * 7, weekIndex * 7 + 7)
  );
}

export function BookingDateCalendar({
  compact,
  disabled = false,
  minimumDate,
  onSelect,
  selectedDate,
}: BookingDateCalendarProps) {
  const minimumDateParts = useMemo(
    () => parseIsoDate(minimumDate) ?? { year: 1970, month: 1, day: 1 },
    [minimumDate]
  );
  const selectedDateParts = useMemo(
    () => (selectedDate ? parseIsoDate(selectedDate) : null),
    [selectedDate]
  );
  const [visibleMonth, setVisibleMonth] = useState<MonthParts>(() =>
    toMonthParts(selectedDateParts ?? minimumDateParts)
  );
  const calendarDays = useMemo(
    () => getCalendarDays(visibleMonth),
    [visibleMonth]
  );
  const calendarWeeks = useMemo(
    () => getCalendarWeeks(calendarDays),
    [calendarDays]
  );
  const minimumMonthIndex = getMonthIndex(toMonthParts(minimumDateParts));
  const canGoToPreviousMonth =
    !disabled && getMonthIndex(visibleMonth) > minimumMonthIndex;

  useEffect(() => {
    const nextMonth = toMonthParts(selectedDateParts ?? minimumDateParts);

    setVisibleMonth((currentMonth) =>
      getMonthIndex(currentMonth) < minimumMonthIndex || selectedDateParts
        ? nextMonth
        : currentMonth
    );
  }, [minimumDateParts, minimumMonthIndex, selectedDateParts]);

  const handlePreviousMonth = () => {
    if (!canGoToPreviousMonth) {
      return;
    }

    setVisibleMonth((month) => addMonths(month, -1));
  };

  const handleNextMonth = () => {
    if (disabled) {
      return;
    }

    setVisibleMonth((month) => addMonths(month, 1));
  };

  const handleToday = () => {
    if (disabled) {
      return;
    }

    setVisibleMonth(toMonthParts(minimumDateParts));
    onSelect(minimumDate);
  };

  return (
    <View
      accessibilityLabel="Calendrier de réservation"
      style={[styles.container, compact && styles.containerCompact]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Afficher le mois précédent"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoToPreviousMonth }}
          disabled={!canGoToPreviousMonth}
          onPress={handlePreviousMonth}
          style={({ hovered, pressed }) => [
            styles.navigationButton,
            compact && styles.navigationButtonCompact,
            hovered && canGoToPreviousMonth && styles.navigationButtonHovered,
            pressed && canGoToPreviousMonth && styles.pressed,
            !canGoToPreviousMonth && styles.disabled,
          ]}
        >
          <Text style={styles.navigationButtonText}>‹</Text>
        </Pressable>

        <Text accessibilityRole="header" style={styles.monthTitle}>
          {formatMonth(visibleMonth)}
        </Text>

        <Pressable
          accessibilityLabel="Afficher le mois suivant"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={handleNextMonth}
          style={({ hovered, pressed }) => [
            styles.navigationButton,
            compact && styles.navigationButtonCompact,
            hovered && !disabled && styles.navigationButtonHovered,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Text style={styles.navigationButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={[styles.weekRow, compact && styles.weekRowCompact]}>
        {WEEK_DAYS.map((weekDay) => (
          <Text key={weekDay} style={styles.weekDay}>
            {weekDay}
          </Text>
        ))}
      </View>

      <View style={[styles.dayGrid, compact && styles.dayGridCompact]}>
        {calendarWeeks.map((week, weekIndex) => (
          <View
            key={`${visibleMonth.year}-${visibleMonth.month}:${weekIndex}`}
            style={[styles.weekRow, compact && styles.weekRowCompact]}
          >
            {week.map(({ date, isoDate, isCurrentMonth }) => {
              const isPast = isoDate < minimumDate;
              const isSelected = isoDate === selectedDate;
              const isToday = isoDate === minimumDate;
              const isDayDisabled = disabled || !isCurrentMonth || isPast;

              return (
                <Pressable
                  key={isoDate}
                  accessibilityLabel={
                    isDayDisabled
                      ? `${formatLongDate(date)}, indisponible`
                      : `Sélectionner le ${formatLongDate(date)}`
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: isDayDisabled,
                    selected: isSelected,
                  }}
                  disabled={isDayDisabled}
                  onPress={() => {
                    onSelect(isoDate);
                  }}
                  style={({ hovered, pressed }) => [
                    styles.dayCell,
                    compact && styles.dayCellCompact,
                    !isCurrentMonth && styles.outsideMonthCell,
                    isPast && isCurrentMonth && styles.pastDayCell,
                    isToday && isCurrentMonth && styles.todayCell,
                    isSelected && styles.selectedDayCell,
                    hovered && !isDayDisabled && !isSelected &&
                      styles.dayCellHovered,
                    pressed && !isDayDisabled && styles.pressed,
                    disabled && isCurrentMonth && styles.disabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      compact && styles.dayTextCompact,
                      !isCurrentMonth && styles.outsideMonthText,
                      isPast && isCurrentMonth && styles.pastDayText,
                      isSelected && styles.selectedDayText,
                    ]}
                  >
                    {date.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text accessibilityLiveRegion="polite" style={styles.selectedDateText}>
          {selectedDateParts
            ? `Date sélectionnée : ${formatLongDate(selectedDateParts)}`
            : 'Sélectionnez une date dans le calendrier.'}
        </Text>
        <Pressable
          accessibilityLabel="Sélectionner la date d’aujourd’hui"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={handleToday}
          style={({ hovered, pressed }) => [
            styles.todayAction,
            hovered && !disabled && styles.todayActionHovered,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Text style={styles.todayActionText}>Aujourd’hui</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'flex-start',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(67, 197, 232, 0.38)',
    borderRadius: 20,
    backgroundColor: 'rgba(2, 18, 34, 0.84)',
    gap: spacing.md,
    shadowColor: '#27C6EE',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 3,
  },
  containerCompact: {
    padding: spacing.sm,
    borderRadius: 16,
    gap: spacing.sm,
  },
  header: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  monthTitle: {
    flex: 1,
    color: '#EDF9FE',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  navigationButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(72, 180, 218, 0.42)',
    borderRadius: 13,
    backgroundColor: 'rgba(5, 43, 67, 0.74)',
  },
  navigationButtonCompact: {
    width: 36,
    height: 36,
    borderRadius: 11,
  },
  navigationButtonHovered: {
    borderColor: '#6EDDF7',
    backgroundColor: 'rgba(8, 82, 116, 0.8)',
  },
  navigationButtonText: {
    color: '#AEEBFA',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.xl,
  },
  weekRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 6,
  },
  weekRowCompact: {
    gap: 2,
  },
  weekDay: {
    flex: 1,
    minWidth: 0,
    color: '#79A8BB',
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  dayGrid: {
    gap: 6,
  },
  dayGridCompact: {
    gap: 2,
  },
  dayCell: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(68, 151, 185, 0.18)',
    borderRadius: 12,
    backgroundColor: 'rgba(6, 34, 55, 0.74)',
  },
  dayCellCompact: {
    borderRadius: 8,
  },
  dayCellHovered: {
    borderColor: 'rgba(82, 213, 245, 0.72)',
    backgroundColor: 'rgba(8, 68, 96, 0.82)',
  },
  todayCell: {
    borderColor: 'rgba(95, 210, 238, 0.74)',
  },
  selectedDayCell: {
    borderColor: '#8CE9FC',
    backgroundColor: '#087FB8',
    shadowColor: '#39D0F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 3,
  },
  pastDayCell: {
    backgroundColor: 'rgba(3, 22, 37, 0.5)',
  },
  outsideMonthCell: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    opacity: 0.18,
  },
  dayText: {
    color: '#C9E3EC',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  dayTextCompact: {
    fontSize: typography.fontSize.xs,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  pastDayText: {
    color: '#557182',
  },
  outsideMonthText: {
    color: '#456071',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82, 170, 202, 0.2)',
  },
  selectedDateText: {
    flex: 1,
    minWidth: 190,
    color: '#BFEAF4',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  todayAction: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(75, 190, 224, 0.42)',
    borderRadius: 11,
    backgroundColor: 'rgba(6, 59, 84, 0.62)',
  },
  todayActionHovered: {
    borderColor: '#73DDF5',
    backgroundColor: 'rgba(8, 84, 115, 0.76)',
  },
  todayActionText: {
    color: '#C8F2FB',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  pressed: {
    opacity: 0.84,
  },
  disabled: {
    opacity: 0.4,
  },
});
