import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';

type JourneyStepNumber = 1 | 2 | 3 | 4;

const journeySteps: ReadonlyArray<{
  label: string;
  number: JourneyStepNumber;
}> = [
  { number: 1, label: 'Véhicule' },
  { number: 2, label: 'Symptômes' },
  { number: 3, label: 'Analyse IA' },
  { number: 4, label: 'Orientation' },
];

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (isMounted) {
        setReducedMotion(isEnabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

export function IntelligenceOrb({
  active = false,
  size = 168,
}: {
  active?: boolean;
  size?: number;
}) {
  const reducedMotion = useReducedMotion();
  const breathingScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active || reducedMotion) {
      breathingScale.stopAnimation();
      breathingScale.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breathingScale, {
          duration: 1800,
          toValue: 1.035,
          useNativeDriver: true,
        }),
        Animated.timing(breathingScale, {
          duration: 1800,
          toValue: 1,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [active, breathingScale, reducedMotion]);

  return (
    <Animated.View
      accessible={false}
      style={[
        styles.orbFrame,
        { height: size, width: size },
        { transform: [{ scale: breathingScale }] },
      ]}
    >
      <View style={[styles.orbHalo, { borderRadius: size / 2 }]} />
      <Image
        accessible={false}
        contentFit="contain"
        source={require('@/assets/ai/smeia-ai-orb.png')}
        style={styles.orbAsset}
      />
    </Animated.View>
  );
}

export function AiJourneyProgress({
  compact,
  currentStep,
  isAnalyzing,
}: {
  compact: boolean;
  currentStep: JourneyStepNumber;
  isAnalyzing: boolean;
}) {
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <View style={styles.progressTitleGroup}>
          <Text style={styles.progressEyebrow}>PARCOURS GUIDÉ</Text>
          <Text style={styles.progressTitle}>
            {isAnalyzing
              ? 'Analyse sécurisée en cours'
              : 'Votre orientation en quatre temps'}
          </Text>
        </View>
        <Text style={styles.progressCount}>{currentStep}/4</Text>
      </View>

      <View style={[styles.stepList, compact && styles.stepListCompact]}>
        {journeySteps.map((step) => {
          const completed = step.number < currentStep;
          const active = step.number === currentStep;

          return (
            <View
              key={step.number}
              accessibilityLabel={`Étape ${step.number} sur 4 : ${step.label}`}
              style={[
                styles.stepCard,
                compact && styles.stepCardCompact,
                active && styles.stepCardActive,
                completed && styles.stepCardCompleted,
              ]}
            >
              <View
                style={[
                  styles.stepNumber,
                  active && styles.stepNumberActive,
                  completed && styles.stepNumberCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumberText,
                    (active || completed) && styles.stepNumberTextActive,
                  ]}
                >
                  {completed ? '✓' : step.number}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  (active || completed) && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function SecureAnalysisVisual() {
  return (
    <View style={styles.analysisCard}>
      <IntelligenceOrb active size={132} />
      <View style={styles.analysisCopy}>
        <Text style={styles.analysisEyebrow}>SMEIA INTELLIGENCE STUDIO</Text>
        <Text style={styles.analysisTitle}>Analyse sécurisée en cours</Text>
        <Text style={styles.analysisText}>
          L’assistant prépare une première orientation automobile à partir des
          informations transmises.
        </Text>
      </View>
      <View style={styles.skeletonList}>
        <View style={[styles.skeleton, styles.skeletonWide]} />
        <View style={[styles.skeleton, styles.skeletonMedium]} />
        <View style={[styles.skeleton, styles.skeletonShort]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orbFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbHalo: {
    position: 'absolute',
    top: '9%',
    right: '9%',
    bottom: '9%',
    left: '9%',
    backgroundColor: 'rgba(57, 190, 225, 0.12)',
    shadowColor: '#45C7E8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
  },
  orbAsset: {
    width: '100%',
    height: '100%',
  },
  progressCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 188, 225, 0.24)',
    borderRadius: 20,
    backgroundColor: 'rgba(4, 19, 36, 0.86)',
    experimental_backgroundImage:
      'linear-gradient(145deg, rgba(7, 31, 55, 0.9) 0%, rgba(3, 16, 31, 0.92) 100%)',
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressTitleGroup: {
    flex: 1,
    gap: 2,
  },
  progressEyebrow: {
    color: '#65D4F1',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.1,
  },
  progressTitle: {
    color: '#F1F8FD',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  progressCount: {
    color: '#72D9F2',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  stepList: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepListCompact: {
    flexWrap: 'wrap',
  },
  stepCard: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(85, 143, 177, 0.2)',
    borderRadius: 14,
    backgroundColor: 'rgba(3, 16, 31, 0.66)',
  },
  stepCardCompact: {
    flexBasis: '46%',
    minWidth: 132,
  },
  stepCardActive: {
    borderColor: '#34BDE9',
    backgroundColor: 'rgba(10, 70, 108, 0.68)',
    shadowColor: '#2EC3EF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  stepCardCompleted: {
    borderColor: 'rgba(65, 164, 204, 0.4)',
    backgroundColor: 'rgba(8, 48, 76, 0.64)',
  },
  stepNumber: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(61, 87, 113, 0.54)',
  },
  stepNumberActive: {
    backgroundColor: '#168BD0',
  },
  stepNumberCompleted: {
    backgroundColor: '#247EAA',
  },
  stepNumberText: {
    color: '#A1B4C7',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  stepNumberTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    color: '#8499AE',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  stepLabelActive: {
    color: '#E5F8FF',
  },
  analysisCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(123, 190, 222, 0.42)',
    borderRadius: 22,
    backgroundColor: 'rgba(4, 25, 45, 0.86)',
    experimental_backgroundImage:
      'linear-gradient(145deg, rgba(8, 40, 69, 0.92) 0%, rgba(3, 18, 34, 0.94) 100%)',
    gap: spacing.md,
    overflow: 'hidden',
  },
  analysisCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  analysisEyebrow: {
    color: '#7FD3E8',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  analysisTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  analysisText: {
    maxWidth: 420,
    color: '#C5D8EC',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  skeletonList: {
    width: '100%',
    gap: spacing.sm,
  },
  skeleton: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(180, 218, 236, 0.16)',
  },
  skeletonWide: {
    width: '92%',
  },
  skeletonMedium: {
    width: '72%',
  },
  skeletonShort: {
    width: '48%',
  },
});
