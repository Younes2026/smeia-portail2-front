import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import {
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
import { isDirectusCrcRole } from '@/core/auth/directus-roles';
import { breakpoints } from '@/core/theme/breakpoints';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { useAuthStore } from '@/store/auth.store';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

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

const brandBackgrounds = [
  {
    name: 'BMW',
    source: require('@/assets/login/brands/bmw-bg.png'),
  },
  {
    name: 'MINI',
    source: require('@/assets/login/brands/mini-bg.png'),
  },
  {
    name: 'Jaguar',
    source: require('@/assets/login/brands/jaguar-bg.png'),
  },
  {
    name: 'Land Rover',
    source: require('@/assets/login/brands/land-rover-bg.png'),
  },
  {
    name: 'Mazda',
    source: require('@/assets/login/brands/mazda-bg.png'),
  },
  {
    name: 'Jetour',
    source: require('@/assets/login/brands/jetour-bg.png'),
  },
] as const;

const premiumInfoItems: readonly {
  icon: SymbolName;
  title: string;
  subtitle: string;
}[] = [
  {
    icon: { ios: 'clock', android: 'schedule', web: 'schedule' },
    title: 'Suivi en temps réel',
    subtitle: 'Vos véhicules et réparations',
  },
  {
    icon: { ios: 'shield', android: 'shield', web: 'shield' },
    title: 'Historique sécurisé',
    subtitle: 'Toutes vos interventions',
  },
  {
    icon: { ios: 'car', android: 'directions_car', web: 'directions_car' },
    title: 'Accès multi-marques',
    subtitle: 'BMW, MINI, Jaguar, Land Rover, Mazda, Jetour',
  },
  {
    icon: { ios: 'star', android: 'star', web: 'star' },
    title: 'Service premium',
    subtitle: 'Un accompagnement dédié',
  },
];

type FocusedField = 'email' | 'password' | null;
type WebTextInputFocusReset = Omit<TextStyle, 'boxShadow' | 'outlineStyle'> & {
  boxShadow: 'none';
  outlineStyle: 'none';
  outlineWidth: 0;
};
type WebGlassPanelStyle = ViewStyle & {
  WebkitBackdropFilter: string;
  backdropFilter: string;
};
type WebViewportStyle = {
  height: '100dvh';
  minHeight: '100dvh';
  maxHeight: '100dvh';
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

const webGlassPanelStyle: WebGlassPanelStyle = {
  WebkitBackdropFilter: 'blur(22px)',
  backdropFilter: 'blur(22px)',
};

const glassPanelStyle = Platform.select<ViewStyle | undefined>({
  web: webGlassPanelStyle as unknown as ViewStyle,
  default: undefined,
});

const webViewportStyle: WebViewportStyle = {
  height: '100dvh',
  minHeight: '100dvh',
  maxHeight: '100dvh',
};

const viewportStyle = Platform.select<ViewStyle | undefined>({
  web: webViewportStyle as unknown as ViewStyle,
  default: undefined,
});

export function LoginScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const customer = useAuthStore((state) => state.customer);
  const savAgent = useAuthStore((state) => state.savAgent);
  const technician = useAuthStore((state) => state.technician);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showForgotPasswordHelp, setShowForgotPasswordHelp] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !login.isPending;
  const hasProtectedSession = Boolean(
    accessToken &&
      (customer || savAgent || technician || isDirectusCrcRole(user?.role))
  );
  const isCrcAgent = isDirectusCrcRole(user?.role);
  const panelTiltStyles = [
    styles.galleryPanelTiltOne,
    styles.galleryPanelTiltTwo,
    styles.galleryPanelTiltThree,
    styles.galleryPanelTiltFour,
    styles.galleryPanelTiltFive,
    styles.galleryPanelTiltSix,
  ];

  useEffect(() => {
    if (!hasHydrated || !hasProtectedSession || login.isPending) {
      return;
    }

    if (isCrcAgent) {
      router.replace('/crc/requests' as never);
      return;
    }

    if (savAgent && !customer) {
      router.replace('/sav/dashboard');
      return;
    }

    if (technician && !customer && !savAgent) {
      router.replace('/technician/dashboard' as never);
      return;
    }

    router.replace('/');
  }, [
    customer,
    hasHydrated,
    hasProtectedSession,
    isCrcAgent,
    login.isPending,
    router,
    savAgent,
    technician,
  ]);

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    login.mutate(
      {
        email,
        password,
      },
      {
        onSuccess: (session) => {
          if (isDirectusCrcRole(session.user?.role)) {
            router.replace('/crc/requests' as never);
            return;
          }

          if (session.savAgent && !session.customer) {
            router.replace('/sav/dashboard');
            return;
          }

          if (session.technician && !session.customer && !session.savAgent) {
            router.replace('/technician/dashboard' as never);
            return;
          }

          router.replace('/');
        },
      }
    );
  };

  return (
    <PageContainer padded={false}>
      <View style={[styles.background, viewportStyle]}>
        <View pointerEvents="none" style={styles.backgroundScene}>
          <View
            style={[
              styles.galleryTrack,
              isCompact && styles.galleryTrackCompact,
            ]}
          >
            {brandBackgrounds.map((brand, index) => (
              <View
                key={brand.name}
                style={[
                  styles.galleryPanel,
                  !isCompact && panelTiltStyles[index],
                  isCompact && styles.galleryPanelCompact,
                ]}
              >
                <Image
                  accessibilityLabel={brand.name}
                  contentFit="cover"
                  source={brand.source}
                  style={styles.galleryImage}
                />
                <View style={styles.galleryPanelShade} />
              </View>
            ))}
          </View>
          <View style={styles.backgroundBlueWash} />
          <View style={styles.backgroundOverlay} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isCompact && styles.scrollContentCompact,
          ]}
        >
          <View style={[styles.logoBar, isCompact && styles.logoBarCompact]}>
            {brandLogos.map((logo) => (
              <View
                key={logo.name}
                style={[
                  styles.logoBarTile,
                  isCompact && styles.logoBarTileCompact,
                ]}
              >
                <Image
                  accessibilityLabel={logo.name}
                  contentFit="contain"
                  source={logo.source}
                  style={styles.logoBarImage}
                />
              </View>
            ))}
          </View>

          <View style={[styles.cardShell, isCompact && styles.cardShellCompact]}>
            <View
              style={[
                styles.panel,
                glassPanelStyle,
                isCompact && styles.panelCompact,
              ]}
            >
              <View pointerEvents="none" style={styles.cardGlassSurface} />

              <View style={styles.brandBlock}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>S</Text>
                </View>
                <View style={styles.brandCopy}>
                  <Text style={styles.brandName}>SMEIA</Text>
                  <Text style={styles.brandSubname}>Portail client</Text>
                </View>
              </View>

              <View pointerEvents="none" style={styles.cardAccent} />

              <View style={styles.header}>
                <Text style={styles.title}>Connexion client</Text>
                <Text style={styles.subtitle}>
                  Accédez au suivi de vos véhicules et réparations.
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <View
                    style={[
                      styles.inputShell,
                      focusedField === 'email' && styles.inputFocused,
                    ]}
                  >
                    <SymbolView
                      name={{ ios: 'envelope', android: 'mail', web: 'mail' }}
                      size={17}
                      tintColor="#5E7088"
                    />
                    <TextInput
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onBlur={() => {
                        setFocusedField(null);
                      }}
                      onChangeText={setEmail}
                      onFocus={() => {
                        setFocusedField('email');
                      }}
                      placeholder="email@exemple.com"
                      placeholderTextColor={colors.light.text.secondary}
                      style={[styles.input, textInputFocusReset]}
                      value={email}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View
                    style={[
                      styles.inputShell,
                      focusedField === 'password' && styles.inputFocused,
                    ]}
                  >
                    <SymbolView
                      name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                      size={17}
                      tintColor="#5E7088"
                    />
                    <TextInput
                      onBlur={() => {
                        setFocusedField(null);
                      }}
                      onChangeText={setPassword}
                      onFocus={() => {
                        setFocusedField('password');
                      }}
                      placeholder="Mot de passe"
                      placeholderTextColor={colors.light.text.secondary}
                      secureTextEntry={!isPasswordVisible}
                      style={[styles.input, textInputFocusReset]}
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
                        tintColor="#4D6078"
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

          <View style={[styles.infoStrip, isCompact && styles.infoStripCompact]}>
            {premiumInfoItems.map((item) => (
              <View key={item.title} style={styles.infoItem}>
                <View style={styles.infoIcon}>
                  <SymbolView
                    name={item.icon}
                    size={16}
                    tintColor="#D9E8FF"
                  />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoTitle}>{item.title}</Text>
                  <Text style={styles.infoSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
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
    backgroundColor: '#06111F',
  },

  backgroundScene: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },

  galleryTrack: {
    position: 'absolute',
    top: -28,
    right: -46,
    bottom: -28,
    left: -46,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  galleryTrackCompact: {
    top: 0,
    right: -180,
    bottom: 0,
    left: -180,
    opacity: 0.72,
  },

  galleryPanel: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    marginHorizontal: -8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(194, 215, 246, 0.24)',
    backgroundColor: '#0A1728',
  },

  galleryPanelCompact: {
    marginHorizontal: -16,
  },

  galleryPanelTiltOne: {
    transform: [{ rotateZ: '-5deg' }, { scale: 1.08 }],
  },

  galleryPanelTiltTwo: {
    transform: [{ rotateZ: '3deg' }, { scale: 1.08 }],
  },

  galleryPanelTiltThree: {
    transform: [{ rotateZ: '-2deg' }, { scale: 1.08 }],
  },

  galleryPanelTiltFour: {
    transform: [{ rotateZ: '4deg' }, { scale: 1.08 }],
  },

  galleryPanelTiltFive: {
    transform: [{ rotateZ: '-3deg' }, { scale: 1.08 }],
  },

  galleryPanelTiltSix: {
    transform: [{ rotateZ: '5deg' }, { scale: 1.08 }],
  },

  galleryImage: {
    width: '100%',
    height: '100%',
  },

  galleryPanelShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(1, 10, 24, 0.18)',
  },

  backgroundBlueWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(5, 18, 38, 0.24)',
  },

  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4, 12, 24, 0.18)',
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(5, 16, 34, 0.22) 0%, rgba(5, 13, 26, 0.58) 58%, rgba(3, 10, 20, 0.92) 100%)',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    width: '100%',
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
  },

  scrollContentCompact: {
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  logoBar: {
    maxWidth: 620,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 16,
    backgroundColor: 'rgba(226, 238, 255, 0.16)',
    shadowColor: '#020814',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.18,
    shadowRadius: 28,
  },

  logoBarCompact: {
    width: '100%',
    maxWidth: 360,
    gap: 5,
    padding: 6,
    borderRadius: 16,
  },

  logoBarTile: {
    width: 72,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
  },

  logoBarTileCompact: {
    width: 44,
    height: 30,
    borderRadius: 10,
  },

  logoBarImage: {
    width: '90%',
    height: '82%',
  },

  cardShell: {
    width: '100%',
    maxWidth: 372,
    alignSelf: 'center',
  },

  cardShellCompact: {
    maxWidth: 420,
  },

  panel: {
    width: '100%',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 30,
    backgroundColor: 'rgba(245, 248, 252, 0.56)',
    gap: 9,
    overflow: 'hidden',
    shadowColor: '#F4FAFF',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.42,
    shadowRadius: 52,
    elevation: 12,
  },

  panelCompact: {
    padding: 16,
    borderRadius: 28,
  },

  cardGlassSurface: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    experimental_backgroundImage:
      'linear-gradient(145deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.3) 45%, rgba(58, 130, 255, 0.1) 100%)',
  },

  brandBlock: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },

  brandMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.44)',
    backgroundColor: 'rgba(7, 24, 50, 0.94)',
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },

  brandMarkText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  brandCopy: {
    minWidth: 0,
  },

  brandName: {
    color: '#061832',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },

  brandSubname: {
    color: '#263B56',
    fontSize: typography.fontSize.sm,
  },

  cardAccent: {
    width: 48,
    height: 2,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#3A82FF',
    shadowColor: '#3A82FF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.52,
    shadowRadius: 10,
  },

  header: {
    gap: 2,
    alignItems: 'center',
  },

  title: {
    color: '#031832',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },

  subtitle: {
    color: '#233A59',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },

  form: {
    gap: 9,
  },

  field: {
    gap: 3,
  },

  label: {
    color: '#061832',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  inputShell: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    shadowColor: '#071832',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },

  input: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: '#031832',
    fontSize: typography.fontSize.sm,
  },

  inputFocused: {
    borderColor: '#3A82FF',
    shadowColor: '#3A82FF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },

  passwordToggle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  passwordToggleHovered: {
    backgroundColor: 'rgba(238, 244, 251, 0.46)',
  },

  passwordTogglePressed: {
    opacity: 0.72,
  },

  errorBox: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9B8B8',
    borderRadius: 14,
    backgroundColor: '#FFF5F5',
  },

  errorText: {
    color: '#8F2D24',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },

  button: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1D65E5',
    experimental_backgroundImage:
      'linear-gradient(135deg, #4B92FF 0%, #1D65E5 50%, #0E3E96 100%)',
    shadowColor: '#2F7BFF',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.34,
    shadowRadius: 22,
  },

  buttonHovered: {
    backgroundColor: '#1557C8',
  },

  buttonPressed: {
    opacity: 0.86,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  forgotPasswordBlock: {
    alignItems: 'center',
    gap: 4,
  },

  forgotPasswordLink: {
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },

  forgotPasswordLinkHovered: {
    backgroundColor: 'rgba(238, 244, 251, 0.42)',
  },

  forgotPasswordText: {
    color: '#004FC4',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  forgotPasswordHelp: {
    width: '100%',
    padding: 10,
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
    color: '#344B66',
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    textAlign: 'center',
  },

  infoStrip: {
    width: '100%',
    maxWidth: 760,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },

  infoStripCompact: {
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  infoItem: {
    flex: 1,
    minWidth: 150,
    maxWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    backgroundColor: 'rgba(5, 16, 34, 0.36)',
  },

  infoIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(217, 232, 255, 0.12)',
  },

  infoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  infoSubtitle: {
    color: '#C4D1E4',
    fontSize: 10,
    lineHeight: 13,
  },
});
