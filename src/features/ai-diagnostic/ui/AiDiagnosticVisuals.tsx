import { useEffect, useRef, useState } from 'react';
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

  const coreSize = Math.round(size * 0.34);
  const middleSize = Math.round(size * 0.62);
  const innerRingSize = Math.round(size * 0.78);

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
      <View
        style={[
          styles.orbOuterRing,
          {
            borderRadius: size / 2,
            height: size,
            width: size,
          },
        ]}
      />
      <View
        style={[
          styles.orbInnerRing,
          {
            borderRadius: innerRingSize / 2,
            height: innerRingSize,
            width: innerRingSize,
          },
        ]}
      />
      <View
        style={[
          styles.orbMiddle,
          {
            borderRadius: middleSize / 2,
            height: middleSize,
            width: middleSize,
          },
        ]}
      />
      <View
        style={[
          styles.orbCore,
          {
            borderRadius: coreSize / 2,
            height: coreSize,
            width: coreSize,
          },
        ]}
      >
        <View style={styles.orbCoreGlint} />
      </View>
      <View style={[styles.orbLine, styles.orbLineTop]} />
      <View style={[styles.orbLine, styles.orbLineBottom]} />
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
    backgroundColor: 'rgba(57, 190, 225, 0.17)',
    shadowColor: '#45C7E8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 30,
  },
  orbOuterRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(157, 226, 244, 0.38)',
  },
  orbInnerRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(137, 211, 236, 0.36)',
    backgroundColor: 'rgba(32, 116, 177, 0.18)',
  },
  orbMiddle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(204, 241, 249, 0.52)',
    backgroundColor: 'rgba(21, 91, 152, 0.56)',
  },
  orbCore: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(234, 251, 255, 0.9)',
    backgroundColor: '#74D7ED',
    shadowColor: '#B7F2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
  },
  orbCoreGlint: {
    width: '46%',
    height: '46%',
    marginTop: '14%',
    marginLeft: '16%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
  },
  orbLine: {
    position: 'absolute',
    width: '22%',
    height: 1,
    backgroundColor: 'rgba(185, 235, 248, 0.62)',
  },
  orbLineTop: {
    top: '27%',
    right: '2%',
    transform: [{ rotate: '-18deg' }],
  },
  orbLineBottom: {
    bottom: '24%',
    left: '1%',
    transform: [{ rotate: '-18deg' }],
  },
  progressCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#DDE6F2',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    gap: spacing.md,
    shadowColor: '#132B4F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
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
    color: '#2D69A8',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.1,
  },
  progressTitle: {
    color: '#0A1C35',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  progressCount: {
    color: '#2D69A8',
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
    borderColor: '#E6EBF2',
    borderRadius: 14,
    backgroundColor: '#F9FBFD',
  },
  stepCardCompact: {
    flexBasis: '46%',
    minWidth: 132,
  },
  stepCardActive: {
    borderColor: '#7AB6DE',
    backgroundColor: '#EDF7FC',
  },
  stepCardCompleted: {
    borderColor: '#C4D9E8',
    backgroundColor: '#F2F8FB',
  },
  stepNumber: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#E9EEF5',
  },
  stepNumberActive: {
    backgroundColor: '#155C9B',
  },
  stepNumberCompleted: {
    backgroundColor: '#2C7DA0',
  },
  stepNumberText: {
    color: '#68778B',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  stepNumberTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    color: '#68778B',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  stepLabelActive: {
    color: '#123B66',
  },
  analysisCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(123, 190, 222, 0.42)',
    borderRadius: 22,
    backgroundColor: '#0B2343',
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
