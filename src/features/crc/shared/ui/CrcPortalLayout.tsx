import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useAuthStore } from '@/store/auth.store';

function getAgentName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  return fullName || email || 'Agent CRC';
}

export function CrcPortalLayout({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;
  const user = useAuthStore((state) => state.user);
  const agentName = getAgentName(
    user?.firstName,
    user?.lastName,
    user?.email
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={[styles.header, isCompact && styles.headerCompact]}>
          <View style={styles.brandBlock}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>S</Text>
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>SMEIA</Text>
              <Text style={styles.brandSubname}>Espace CRC</Text>
            </View>
          </View>

          <View style={[styles.identity, isCompact && styles.identityCompact]}>
            <View style={styles.accessBadge}>
              <Text style={styles.accessBadgeText}>ACCÈS CRC</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text numberOfLines={1} style={styles.identityName}>
                {agentName}
              </Text>
              <Text numberOfLines={1} style={styles.identityRole}>
                {user?.role?.name ?? 'Agent CRC'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.light.background.secondary,
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.md,
    backgroundColor: colors.light.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headerCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.md,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: colors.light.text.inverse,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  brandCopy: {
    gap: spacing.xs,
  },
  brandName: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.5,
  },
  brandSubname: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  identityCompact: {
    width: '100%',
    justifyContent: 'space-between',
  },
  accessBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    backgroundColor: colors.light.background.muted,
  },
  accessBadgeText: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    letterSpacing: 0.6,
  },
  identityCopy: {
    maxWidth: 240,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  identityName: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  identityRole: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.xs,
  },
  content: {
    flex: 1,
    paddingTop: spacing.lg,
  },
});
