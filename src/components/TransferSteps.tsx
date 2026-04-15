/**
 * Shared transfer tracking timeline — used by SendSuccessScreen and
 * TransactionDetailScreen so both render the exact same step UI.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepStatus = 'done' | 'active' | 'failed' | 'pending';
export type Step = { label: string; sub: string; status: StepStatus };

// ─── Icons ────────────────────────────────────────────────────────────────────

export function DoneIcon() {
  return (
    <View style={iconStyles.done}>
      <Check size={14} color="#fff" strokeWidth={2.5} />
    </View>
  );
}

export function ActiveIcon() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={iconStyles.activeWrap}>
      <Animated.View style={[iconStyles.activeRing, ringStyle]} />
      <View style={iconStyles.activeDot} />
    </View>
  );
}

export function FailedIcon() {
  return (
    <View style={iconStyles.failed}>
      <X size={14} color="#fff" strokeWidth={2.5} />
    </View>
  );
}

export function PendingIcon() {
  return <View style={iconStyles.pending} />;
}

const iconStyles = StyleSheet.create({
  done: {
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  activeWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  activeRing: {
    position: 'absolute', width: 28, height: 28, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.brand,
  },
  activeDot: { width: 12, height: 12, borderRadius: radius.full, backgroundColor: colors.brand },
  failed: {
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: colors.failed,
    alignItems: 'center', justifyContent: 'center',
  },
  pending: {
    width: 28, height: 28, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.border,
  },
});

// ─── Step row ─────────────────────────────────────────────────────────────────

export function StepRow({ step, isLast }: { step: Step; isLast: boolean }) {
  const connectorColor =
    step.status === 'done'   ? colors.success :
    step.status === 'failed' ? colors.failed  :
    colors.border;

  return (
    <View style={stepStyles.stepRow}>
      <View style={stepStyles.stepIconCol}>
        {step.status === 'done'    && <DoneIcon />}
        {step.status === 'active'  && <ActiveIcon />}
        {step.status === 'failed'  && <FailedIcon />}
        {step.status === 'pending' && <PendingIcon />}
        {!isLast && <View style={[stepStyles.stepConnector, { backgroundColor: connectorColor }]} />}
      </View>
      <View style={stepStyles.stepBody}>
        <Text style={[stepStyles.stepLabel, step.status === 'pending' && stepStyles.stepLabelMuted]}>
          {step.label}
        </Text>
        <Text style={[
          stepStyles.stepSub,
          step.status === 'done'   && stepStyles.stepSubDone,
          step.status === 'active' && stepStyles.stepSubActive,
          step.status === 'failed' && stepStyles.stepSubFailed,
        ]}>
          {step.sub}
        </Text>
      </View>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  stepRow: { flexDirection: 'row', gap: spacing.md },
  stepIconCol: { alignItems: 'center', width: 28 },
  stepConnector: { width: 2, flex: 1, minHeight: 20, marginVertical: 3 },
  stepBody: { flex: 1, paddingBottom: spacing.lg, paddingTop: 3 },
  stepLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  stepLabelMuted: { color: colors.textMuted },
  stepSub: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  stepSubDone:   { color: colors.success },
  stepSubActive: { color: colors.brand },
  stepSubFailed: { color: colors.failed },
});
