import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import type { TextStyle } from 'react-native';
import {
  Animated,
  Easing,
  Platform,
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

const LOGO_TILE_WIDTH = 64;
const LOGO_TILE_GAP = 8;

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

const scrollingBrandLogos = [...brandLogos, ...brandLogos];
const LOGO_LOOP_DISTANCE = brandLogos.length * (LOGO_TILE_WIDTH + LOGO_TILE_GAP);

type FocusedField = 'email' | 'password' | null;
type WebTextInputFocusReset = Omit<TextStyle, 'boxShadow' | 'outlineStyle'> & {
  boxShadow: 'none';
  outlineStyle: 'none';
  outlineWidth: 0;
};

const webTextInputFocusReset: WebTextInputFocusReset = {
  boxShadow: 'none',
  outlineStyle: 'none',
  outlineWidth: 0,
};

const textInputFocusReset = Platform.select<TextStyle | undefined>({
  web: webTextInputFocusReset as unknown as TextStyle,
  default: undefined,
});

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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showForgotPasswordHelp, setShowForgotPasswordHelp] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const marqueeProgress = useRef(new Animated.Value(0)).current;
  const blobProgress = useRef(new Animated.Value(0)).current;
  const secondaryBlobProgress = useRef(new Animated.Value(0)).current;
  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !login.isPending;
  const hasProtectedSession = Boolean(accessToken && customer);
  const logoTranslateX = marqueeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -LOGO_LOOP_DISTANCE],
  });

  useEffect(() => {
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

    blobAnimation.start();
    secondaryBlobAnimation.start();

    return () => {
      blobAnimation.stop();
      secondaryBlobAnimation.stop();
    };
  }, [blobProgress, secondaryBlobProgress]);

  useEffect(() => {
    marqueeProgress.setValue(0);

    const marqueeAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(marqueeProgress, {
          toValue: 1,
          duration: 26000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(marqueeProgress, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      {
        iterations: -1,
        resetBeforeIteration: false,
      }
    );

    marqueeAnimation.start();

    return () => {
      marqueeAnimation.stop();
    };
  }, [marqueeProgress]);

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
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isCompact && styles.scrollContentCompact,
          ]}
        >
          <View style={[styles.cardShell, isCompact && styles.cardShellCompact]}>
            <View pointerEvents="none" style={styles.cardAura} />

            <View style={[styles.panel, isCompact && styles.panelCompact]}>
              <View style={styles.logoPanel}>
                <View style={styles.brandBlock}>
                  <View style={styles.brandMark}>
                    <Text style={styles.brandMarkText}>S</Text>
                  </View>
                  <View style={styles.brandCopy}>
                    <Text style={styles.brandName}>SMEIA</Text>
                    <Text style={styles.brandSubname}>Portail client</Text>
                  </View>
                </View>

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
                    {scrollingBrandLogos.map((logo, index) => (
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
              </View>

              <View style={styles.header}>
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
                      textInputFocusReset,
                      focusedField === 'email' && styles.inputFocused,
                    ]}
                    value={email}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View
                    style={[
                      styles.passwordInputShell,
                      focusedField === 'password' && styles.inputFocused,
                    ]}
                  >
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
                      secureTextEntry={!isPasswordVisible}
                      style={[styles.passwordInput, textInputFocusReset]}
                      value={password}
                    />
                    <Pressable
                      accessibilityLabel={
                        isPasswordVisible
                          ? 'Cacher le mot de passe'
                          : 'Afficher le mot de passe'
                      }
                      accessibilityRole="button"
                      onPress={() => {
                        setIsPasswordVisible((visible) => !visible);
                      }}
                      style={({ hovered, pressed }) => [
                        styles.passwordToggle,
                        hovered && styles.passwordToggleHovered,
                        pressed && styles.passwordTogglePressed,
                      ]}
                    >
                      <SymbolView
                        name={{
                          ios: isPasswordVisible ? 'eye.slash' : 'eye',
                          android: isPasswordVisible
                            ? 'visibility_off'
                            : 'visibility',
                          web: isPasswordVisible
                            ? 'visibility_off'
                            : 'visibility',
                        }}
                        size={18}
                        tintColor="#526174"
                      />
                    </Pressable>
                  </View>
                </View>

                {login.errorMessage ? (
                  <View accessibilityRole="alert" style={styles.errorBox}>
                    <Text style={styles.errorText}>{login.errorMessage}</Text>
                  </View>
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

                <View style={styles.forgotPasswordBlock}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setShowForgotPasswordHelp(true);
                    }}
                    style={({ hovered, pressed }) => [
                      styles.forgotPasswordLink,
                      hovered && styles.forgotPasswordLinkHovered,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.forgotPasswordText}>
                      Mot de passe oublié ?
                    </Text>
                  </Pressable>

                  {showForgotPasswordHelp ? (
                    <View style={styles.forgotPasswordHelp}>
                      <Text style={styles.forgotPasswordHelpText}>
                        Veuillez contacter le service client SMEIA.
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.footerText}>
                  © 2026 SMEIA - Portail Client
                </Text>
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
    minHeight: '100%',
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
    minHeight: '100%',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },

  scrollContentCompact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(130, 145, 166, 0.32)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    gap: spacing.md,
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
    padding: 14,
    borderRadius: 20,
  },

  logoPanel: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120, 137, 162, 0.24)',
  },

  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  brandMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#071832',
  },

  brandMarkText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  brandCopy: {
    minWidth: 0,
  },

  brandName: {
    color: '#071832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  brandSubname: {
    color: '#657386',
    fontSize: typography.fontSize.sm,
  },

  logoViewport: {
    width: '100%',
    maxWidth: 424,
    height: 48,
    overflow: 'hidden',
    justifyContent: 'center',
  },

  logoTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoCapsule: {
    width: LOGO_TILE_WIDTH,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: '#E0E7F0',
    borderRadius: 14,
    marginRight: LOGO_TILE_GAP,
    backgroundColor: '#FFFFFF',
    shadowColor: '#10243F',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },

  logoImage: {
    width: '92%',
    height: '82%',
  },

  header: {
    gap: spacing.xs,
    alignItems: 'center',
  },

  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: typography.fontWeight.bold,
    color: '#071832',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: typography.fontSize.md,
    lineHeight: 22,
    color: '#526174',
    textAlign: 'center',
  },

  form: {
    gap: 14,
  },

  field: {
    gap: spacing.xs,
  },

  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: '#10243F',
  },

  input: {
    minHeight: 50,
    paddingVertical: 13,
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

  passwordInputShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 0,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderWidth: 1,
    borderColor: '#D5DFEC',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },

  passwordInput: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: '#071832',
    fontSize: typography.fontSize.md,
  },

  passwordToggle: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  passwordToggleHovered: {
    backgroundColor: '#EEF4FB',
  },

  passwordTogglePressed: {
    opacity: 0.72,
  },

  errorBox: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9B8B8',
    borderRadius: 14,
    backgroundColor: '#FFF5F5',
  },

  errorText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    color: '#8F2D24',
  },

  button: {
    minHeight: 50,
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

  forgotPasswordBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },

  forgotPasswordLink: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },

  forgotPasswordLinkHovered: {
    backgroundColor: '#EEF4FB',
  },

  forgotPasswordText: {
    color: '#0F4C9A',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },

  forgotPasswordHelp: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#C9D8EA',
    borderRadius: 14,
    backgroundColor: '#F3F7FC',
  },

  forgotPasswordHelpText: {
    color: '#526174',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },

  footerText: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    textAlign: 'center',
  },
});
