import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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

const LOGO_TILE_WIDTH = 86;
const LOGO_TILE_GAP = 10;

const brandLogos = [
  {
    name: 'BMW',
    source: require('@/assets/logos/bmw.png'),
  },
  {
    name: 'MINI',
    source: require('@/assets/logos/mini.png'),
  },
  {
    name: 'Jaguar',
    source: require('@/assets/logos/jaguar.png'),
  },
  {
    name: 'Land Rover',
    source: require('@/assets/logos/land-rover.png'),
  },
  {
    name: 'Mazda',
    source: require('@/assets/logos/mazda.png'),
  },
  {
    name: 'Jetour',
    source: require('@/assets/logos/Jetour.png'),
  },
] as const;

const LOGO_LOOP_DISTANCE = brandLogos.length * (LOGO_TILE_WIDTH + LOGO_TILE_GAP);

type FocusedField = 'email' | 'password' | null;

export function LoginScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const customer = useAuthStore((state) => state.customer);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const marqueeProgress = useRef(new Animated.Value(0)).current;
  const blobProgress = useRef(new Animated.Value(0)).current;
  const secondaryBlobProgress = useRef(new Animated.Value(0)).current;
  const carouselLogos = useMemo(
    () => [...brandLogos, ...brandLogos],
    []
  );
  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !login.isPending;
  const hasProtectedSession = Boolean(accessToken && customer);
  const logoTranslateX = marqueeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -LOGO_LOOP_DISTANCE],
  });

  useEffect(() => {
    marqueeProgress.setValue(0);

    const marqueeAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(marqueeProgress, {
          toValue: 1,
          duration: 28000,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(marqueeProgress, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
      {
        iterations: -1,
        resetBeforeIteration: false,
      }
    );
    const blobAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(blobProgress, {
          toValue: 1,
          duration: 7000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(blobProgress, {
          toValue: 0,
          duration: 7000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const secondaryBlobAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(secondaryBlobProgress, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(secondaryBlobProgress, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    marqueeAnimation.start();
    blobAnimation.start();
    secondaryBlobAnimation.start();

    return () => {
      marqueeAnimation.stop();
      blobAnimation.stop();
      secondaryBlobAnimation.stop();
    };
  }, [blobProgress, marqueeProgress, secondaryBlobProgress]);

  useEffect(() => {
    if (!hasHydrated || !hasProtectedSession || login.isPending) {
      return;
    }

    router.replace('/');
  }, [hasHydrated, hasProtectedSession, login.isPending, router]);

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
      <View style={styles.background}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.softShape,
            styles.softShapeTop,
            {
              transform: [
                {
                  translateY: blobProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 24],
                  }),
                },
                {
                  translateX: blobProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -18],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.softShape,
            styles.softShapeBottom,
            {
              transform: [
                {
                  translateY: secondaryBlobProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                  }),
                },
                {
                  translateX: secondaryBlobProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 24],
                  }),
                },
              ],
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[styles.accentLine, styles.accentLineTop]}
        />
        <View
          pointerEvents="none"
          style={[styles.accentLine, styles.accentLineBottom]}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isCompact && styles.scrollContentCompact,
          ]}
        >
          <View style={[styles.cardShell, isCompact && styles.cardShellCompact]}>
            <View pointerEvents="none" style={styles.cardAura} />

            <View style={[styles.panel, isCompact && styles.panelCompact]}>
              <View style={styles.logoViewport}>
                <Animated.View
                  style={[
                    styles.logoTrack,
                    {
                      transform: [
                        {
                          translateX: logoTranslateX,
                        },
                      ],
                    },
                  ]}
                >
                  {carouselLogos.map((logo, index) => (
                    <View
                      key={`${logo.name}-${index}`}
                      style={styles.logoCapsule}
                    >
                      <Image
                        accessibilityLabel={logo.name}
                        contentFit="contain"
                        source={logo.source}
                        style={styles.logoImage}
                      />
                    </View>
                  ))}
                </Animated.View>
              </View>

              <View style={styles.header}>
                <Text style={styles.eyebrow}>SMEIA-PORTAIL2</Text>
                <Text style={styles.title}>Connexion client</Text>
                <Text style={styles.subtitle}>
                  Accédez au suivi de vos véhicules et réparations.
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    onBlur={() => {
                      setFocusedField(null);
                    }}
                    onFocus={() => {
                      setFocusedField('email');
                    }}
                    placeholder="email@exemple.com"
                    placeholderTextColor={colors.light.text.muted}
                    style={[
                      styles.input,
                      focusedField === 'email' && styles.inputFocused,
                    ]}
                    value={email}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <TextInput
                    onChangeText={setPassword}
                    onBlur={() => {
                      setFocusedField(null);
                    }}
                    onFocus={() => {
                      setFocusedField('password');
                    }}
                    placeholder="Mot de passe"
                    placeholderTextColor={colors.light.text.muted}
                    secureTextEntry
                    style={[
                      styles.input,
                      focusedField === 'password' && styles.inputFocused,
                    ]}
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
          </View>
        </ScrollView>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F4F7FB',
    experimental_backgroundImage:
      'linear-gradient(135deg, #F8FAFC 0%, #EEF3F8 46%, #E8EEF7 100%)',
  },

  softShape: {
    position: 'absolute',
    borderRadius: 999,
  },

  softShapeTop: {
    width: 460,
    height: 460,
    top: -190,
    right: -130,
    backgroundColor: '#C9D7EA',
    opacity: 0.52,
  },

  softShapeBottom: {
    width: 560,
    height: 560,
    bottom: -280,
    left: -210,
    backgroundColor: '#D7DEE9',
    opacity: 0.64,
  },

  accentLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#7898C9',
    transform: [{ rotateZ: '-18deg' }],
  },

  accentLineTop: {
    width: 420,
    top: 118,
    right: -80,
    opacity: 0.32,
  },

  accentLineBottom: {
    width: 340,
    right: 96,
    bottom: 96,
    opacity: 0.42,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },

  scrollContentCompact: {
    justifyContent: 'flex-start',
    padding: spacing.lg,
  },

  cardShell: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },

  cardShellCompact: {
    maxWidth: 520,
  },

  cardAura: {
    position: 'absolute',
    width: '86%',
    height: 160,
    top: 52,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#8FB7E8',
    opacity: 0.22,
    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.28,
    shadowRadius: 80,
  },

  panel: {
    width: '100%',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.32)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    gap: spacing.xl,
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 22,
    },
    shadowOpacity: 0.18,
    shadowRadius: 46,
    elevation: 10,
  },

  panelCompact: {
    padding: spacing.lg,
    borderRadius: 20,
  },

  logoViewport: {
    height: 64,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120, 137, 162, 0.24)',
  },

  logoTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoCapsule: {
    width: LOGO_TILE_WIDTH,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(210, 219, 232, 0.96)',
    borderRadius: 999,
    marginRight: LOGO_TILE_GAP,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#10243F',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },

  logoImage: {
    width: '100%',
    height: '100%',
  },

  header: {
    gap: spacing.sm,
    alignItems: 'center',
  },

  eyebrow: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: '#1E5AA8',
    letterSpacing: 0,
  },

  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: '#071832',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    color: '#526174',
    textAlign: 'center',
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
    color: '#10243F',
  },

  input: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D5DFEC',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    color: '#071832',
    fontSize: typography.fontSize.md,
  },

  inputFocused: {
    borderColor: '#1F5EA8',
    shadowColor: '#1F5EA8',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },

  errorText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    color: '#B42318',
  },

  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#0F4C9A',
    experimental_backgroundImage:
      'linear-gradient(135deg, #1557AD 0%, #0F4C9A 48%, #092F63 100%)',
    shadowColor: '#0F4C9A',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },

  buttonHovered: {
    backgroundColor: '#0B3E82',
  },

  buttonPressed: {
    opacity: 0.86,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
});
