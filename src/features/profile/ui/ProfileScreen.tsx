import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ClientPortalLayout } from '@/components/layout/ClientPortalLayout';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useAuthStore } from '@/store/auth.store';

function formatValue(value?: string | null): string {
  return value?.trim() || 'Non renseigné';
}

export function ProfileScreen() {
  const customer = useAuthStore((state) => state.customer);
  const user = useAuthStore((state) => state.user);
  const displayName =
    `${customer?.firstName ?? user?.firstName ?? ''} ${
      customer?.lastName ?? user?.lastName ?? ''
    }`.trim() ||
    customer?.email ||
    user?.email ||
    'Client SMEIA';

  return (
    <ClientPortalLayout activeRoute="/profile">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Profil</Text>
          <Text style={styles.title}>Mon compte client</Text>
          <Text style={styles.subtitle}>
            Consultez les informations rattachées à votre espace SMEIA.
          </Text>
        </View>

        <View style={styles.profileGrid}>
          <View style={styles.identityCard}>
            <Text style={styles.cardKicker}>Identité client</Text>
            <Text style={styles.customerName}>{displayName}</Text>
            <Text style={styles.customerReference}>
              Référence client {customer?.id ?? 'non renseignée'}
            </Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.cardKicker}>Coordonnées</Text>
            <DetailLine
              label="Adresse e-mail"
              value={formatValue(customer?.email ?? user?.email)}
            />
            <DetailLine label="Téléphone" value={formatValue(customer?.phone)} />
            <DetailLine label="Adresse" value={formatValue(customer?.address)} />
          </View>
        </View>

        <View style={styles.infoPanel}>
          <Text style={styles.infoTitle}>Mise à jour de vos informations</Text>
          <Text style={styles.infoText}>
            Pour modifier une donnée administrative, contactez votre conseiller
            SMEIA afin de conserver un dossier client exact et sécurisé.
          </Text>
        </View>
      </ScrollView>
    </ClientPortalLayout>
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
  scroll: {
    flex: 1,
  },

  content: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.sm,
    paddingBottom: spacing.xl,
  },

  header: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
    color: '#526174',
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },

  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },

  identityCard: {
    flexGrow: 1,
    flexBasis: 340,
    minHeight: 240,
    justifyContent: 'flex-end',
    padding: spacing.xl,
    borderRadius: 24,
    backgroundColor: '#071832',
    gap: spacing.sm,
  },

  detailCard: {
    flexGrow: 1,
    flexBasis: 440,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },

  cardKicker: {
    color: '#8FB7E8',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  customerName: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },

  customerReference: {
    color: '#C8D5E6',
    fontSize: typography.fontSize.sm,
  },

  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
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

  infoPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#C9D8EA',
    borderRadius: 20,
    backgroundColor: '#F3F7FC',
    gap: spacing.sm,
  },

  infoTitle: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  infoText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
});
