import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  useBrands,
  useServiceTypes,
  useShowrooms,
  useStatuses,
  useWorkshops,
} from '@/core/api/use-dictionaries';
import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';

type DisplayItem = {
  id: number;
  name: string;
  meta?: string;
};

type DictionarySection = {
  title: string;
  items: DisplayItem[];
};

export function DictionariesTestScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;

  const brands = useBrands();
  const statuses = useStatuses();
  const serviceTypes = useServiceTypes();
  const workshops = useWorkshops();
  const showrooms = useShowrooms();

  const sections: DictionarySection[] = [
    {
      title: 'Brands',
      items: brands.data ?? [],
    },
    {
      title: 'Statuses',
      items: statuses.data ?? [],
    },
    {
      title: 'Service types',
      items: serviceTypes.data ?? [],
    },
    {
      title: 'Workshops',
      items:
        workshops.data?.map((workshop) => ({
          id: workshop.id,
          name: workshop.name,
          meta: [
            workshop.workshop_type,
            workshop.opening_time && workshop.closing_time
              ? `${workshop.opening_time} - ${workshop.closing_time}`
              : null,
            workshop.showroom_id ? `showroom ${workshop.showroom_id}` : null,
          ]
            .filter((value): value is string => Boolean(value))
            .join(' | '),
        })) ?? [],
    },
    {
      title: 'Showrooms',
      items: showrooms.data ?? [],
    },
  ];

  const queries = [brands, statuses, serviceTypes, workshops, showrooms];
  const isLoading = queries.some((query) => query.isLoading);
  const hasError = queries.some((query) => query.isError);
  const isEmpty = sections.every((section) => section.items.length === 0);

  const refetchAll = () => {
    void Promise.all(queries.map((query) => query.refetch()));
  };

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Chargement des dictionnaires..." />
      </PageContainer>
    );
  }

  if (hasError) {
    return (
      <PageContainer>
        <ErrorState
          title="Erreur de chargement"
          message="Impossible de charger les dictionnaires Directus."
          onRetry={refetchAll}
        />
      </PageContainer>
    );
  }

  if (isEmpty) {
    return (
      <PageContainer>
        <EmptyState
          title="Aucun dictionnaire trouve"
          message="Les referentiels Directus sont vides pour le moment."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DIRECTUS</Text>
        <Text style={styles.title}>Test dictionnaires</Text>
        <Text style={styles.subtitle}>
          Verification des referentiels partages charges via TanStack Query.
        </Text>
      </View>

      <View style={[styles.grid, isCompact && styles.gridCompact]}>
        {sections.map((section) => (
          <DictionaryPanel key={section.title} section={section} />
        ))}
      </View>
    </PageContainer>
  );
}

type DictionaryPanelProps = {
  section: DictionarySection;
};

function DictionaryPanel({ section }: DictionaryPanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{section.title}</Text>
        <Text style={styles.panelCount}>{section.items.length}</Text>
      </View>

      {section.items.length > 0 ? (
        <View style={styles.itemList}>
          {section.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.meta ? <Text style={styles.itemMeta}>{item.meta}</Text> : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.panelEmpty}>
          <Text style={styles.panelEmptyText}>Aucune donnee</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  eyebrow: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.secondary,
    letterSpacing: 0,
  },

  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text.primary,
  },

  subtitle: {
    maxWidth: 720,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    color: colors.light.text.secondary,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  gridCompact: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },

  panel: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 280,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.md,
  },

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  panelTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  panelCount: {
    minWidth: 32,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },

  itemList: {
    gap: spacing.sm,
  },

  itemRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border.default,
    gap: spacing.xs,
  },

  itemName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  itemMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.light.text.secondary,
  },

  panelEmpty: {
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.light.border.strong,
    borderRadius: spacing.sm,
    alignItems: 'center',
  },

  panelEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.text.secondary,
  },
});
