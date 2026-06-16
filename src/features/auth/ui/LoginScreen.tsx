import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { PageContainer } from '@/components/layout/PageContainer';
import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { useAuthStore } from '@/store/auth.store';

export function LoginScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !login.isPending;

  if (isAuthenticated && !login.isPending) {
    return <Redirect href="/repairs" />;
  }

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    login.mutate({
      email,
      password,
    });
  };

  return (
    <PageContainer padded={false}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          isCompact && styles.scrollContentCompact,
        ]}
      >
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>SMEIA-PORTAIL2</Text>
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>
              Accedez au portail avec votre compte Directus.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="email@exemple.com"
                placeholderTextColor={colors.light.text.muted}
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                onChangeText={setPassword}
                placeholder="Mot de passe"
                placeholderTextColor={colors.light.text.muted}
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {login.errorMessage ? (
              <Text style={styles.errorText}>{login.errorMessage}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={({ hovered, pressed }) => [
                styles.button,
                hovered && canSubmit && styles.buttonHovered,
                pressed && canSubmit && styles.buttonPressed,
                !canSubmit && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.buttonText}>
                {login.isPending ? 'Connexion...' : 'Se connecter'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },

  scrollContentCompact: {
    justifyContent: 'flex-start',
    padding: spacing.lg,
  },

  panel: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.lg,
  },

  header: {
    gap: spacing.sm,
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
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    color: colors.light.text.secondary,
  },

  form: {
    gap: spacing.md,
  },

  field: {
    gap: spacing.sm,
  },

  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  input: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
  },

  errorText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    color: colors.light.status.danger,
  },

  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.brand.primary,
  },

  buttonHovered: {
    backgroundColor: colors.light.brand.secondary,
  },

  buttonPressed: {
    opacity: 0.86,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.inverse,
  },
});
