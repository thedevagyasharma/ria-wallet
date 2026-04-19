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
export type Step = { label: string; sub: string; status: StepStatus; time?: string };

// ─── Icons ────────────────────────────────────────────────────────────────────

export function DoneIcon() {
  return (
    <View style={iconStyles.done}>
      <Check size={10} color="#fff" strokeWidth={3} />
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
      <X size={10} color="#fff" strokeWidth={3} />
    </View>
  );
}

export function PendingIcon() {
  return <View style={iconStyles.pending} />;
}

const ICON_SIZE = 20;

const iconStyles = StyleSheet.create({
  done: {
    width: ICON_SIZE, height: ICON_SIZE, borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  activeWrap: { width: ICON_SIZE, height: ICON_SIZE, alignItems: 'center', justifyContent: 'center' },
  activeRing: {
    position: 'absolute', width: ICON_SIZE, height: ICON_SIZE, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.brand,
  },
  activeDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.brand },
  failed: {
    width: ICON_SIZE, height: ICON_SIZE, borderRadius: radius.full,
    backgroundColor: colors.failed,
    alignItems: 'center', justifyContent: 'center',
  },
  pending: {
    width: ICON_SIZE, height: ICON_SIZE, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.border,
  },
});

// ─── Step row ─────────────────────────────────────────────────────────────────

export function StepRow({ step, isLast, nextStatus }: { step: Step; isLast: boolean; nextStatus?: StepStatus }) {
  const connectorColor =
    nextStatus === 'done'   ? colors.success :
    nextStatus === 'failed' ? colors.failed  :
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
      <View style={[stepStyles.stepBody, isLast && { paddingBottom: 0 }]}>
        <View style={stepStyles.stepTextWrap}>
          <View style={stepStyles.stepLabelRow}>
            <Text style={[stepStyles.stepLabel, step.status === 'pending' && stepStyles.stepLabelMuted]}>
              {step.label}
            </Text>
            {step.time && (
              <Text style={stepStyles.stepTime}>{step.time}</Text>
            )}
          </View>
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
    </View>
  );
}

const stepStyles = StyleSheet.create({
  stepRow: { flexDirection: 'row', gap: spacing.md },
  stepIconCol: { alignItems: 'center', width: ICON_SIZE, paddingTop: 9 },
  stepConnector: { width: 2, flex: 1, minHeight: 20, marginBottom: -9 },
  stepBody: { flex: 1, paddingBottom: spacing.xl },
  stepTextWrap: {},
  stepLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium, flex: 1 },
  stepLabelMuted: { color: colors.textMuted },
  stepTime: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.medium },
  stepSub: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  stepSubDone:   { color: colors.success },
  stepSubActive: { color: colors.brand },
  stepSubFailed: { color: colors.failed },
});
