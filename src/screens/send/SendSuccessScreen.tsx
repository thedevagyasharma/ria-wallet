import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Copy } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { getCurrency, formatAmount } from '../../data/currencies';
import PrimaryButton from '../../components/PrimaryButton';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type StepStatus = 'done' | 'active' | 'pending';

// ─── Tracking step definitions ────────────────────────────────────────────────

type Step = { label: string; sub: string; status: StepStatus };

function buildSteps(eta: string, firstName: string, receivedFormatted: string, receiveCurrency: string): Step[] {
  const isInstant = eta === 'Instantly';
  return [
    {
      label: 'Transfer initiated',
      sub: 'Confirmed — funds reserved',
      status: 'done',
    },
    {
      label: 'Processing transfer',
      sub: isInstant ? 'Completed' : 'In progress',
      status: isInstant ? 'done' : 'active',
    },
    {
      label: `${firstName} receives funds`,
      sub: isInstant ? 'Delivered' : `Est. ${eta.toLowerCase()}`,
      status: isInstant ? 'done' : 'pending',
    },
  ];
}

// ─── Step icon components ─────────────────────────────────────────────────────

function DoneIcon() {
  return (
    <View style={stepStyles.done}>
      <Check size={14} color='#fff' strokeWidth={2.5} />
    </View>
  );
}

function ActiveIcon() {
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
    <View style={stepStyles.activeWrap}>
      <Animated.View style={[stepStyles.activeRing, ringStyle]} />
      <View style={stepStyles.activeDot} />
    </View>
  );
}

function PendingIcon() {
  return <View style={stepStyles.pending} />;
}

const stepStyles = StyleSheet.create({
  done: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  activeRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
  },

  pending: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
  },
});

// ─── Single step row ──────────────────────────────────────────────────────────

function StepRow({ step, isLast }: { step: Step; isLast: boolean }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIconCol}>
        {step.status === 'done'    && <DoneIcon />}
        {step.status === 'active'  && <ActiveIcon />}
        {step.status === 'pending' && <PendingIcon />}
        {!isLast && (
          <View style={[
            styles.stepConnector,
            step.status === 'done' && styles.stepConnectorDone,
          ]} />
        )}
      </View>
      <View style={styles.stepBody}>
        <Text style={[
          styles.stepLabel,
          step.status === 'pending' && styles.stepLabelMuted,
        ]}>
          {step.label}
        </Text>
        <Text style={[
          styles.stepSub,
          step.status === 'done'   && styles.stepSubDone,
          step.status === 'active' && styles.stepSubActive,
        ]}>
          {step.sub}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SendSuccessScreen({ route }: RootStackProps<'SendSuccess'>) {
  const navigation = useNavigation<Nav>();
  const { recipientName, amount, currency, receivedAmount, receiveCurrency, eta, txRef } = route.params;

  const recipientCurrency = getCurrency(receiveCurrency);
  const firstName = recipientName.split(' ')[0];
  const isInstant = eta === 'Instantly';

  const receivedFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(receivedAmount);

  const steps = buildSteps(eta, firstName, receivedFormatted, receiveCurrency);

  // Ref copy feedback
  const [copied, setCopied] = useState(false);
  const handleCopyRef = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Entrance animations
  const headerOpacity = useSharedValue(0);
  const headerY      = useSharedValue(12);
  const cardOpacity  = useSharedValue(0);
  const cardY        = useSharedValue(16);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    headerOpacity.value = withTiming(1, { duration: 350 });
    headerY.value       = withSpring(0, { damping: 18, stiffness: 140 });
    cardOpacity.value   = withDelay(180, withTiming(1, { duration: 400 }));
    cardY.value         = withDelay(180, withSpring(0, { damping: 18, stiffness: 120 }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  const statusLabel = isInstant ? 'DELIVERED' : 'IN PROGRESS';
  const statusColor = isInstant ? colors.success : colors.brand;
  const statusBg    = isInstant ? colors.successSubtle : colors.brandSubtle;
  const statusBorder = isInstant ? colors.success : colors.brand;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View style={[styles.topSection, headerStyle]}>
          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          {/* Received amount */}
          <View style={styles.receivedAmountRow}>
            <Text style={styles.receivedSymbol}>{recipientCurrency.symbol}</Text>
            <Text style={styles.receivedAmount}>{receivedFormatted}</Text>
            <Text style={styles.receivedCode}>{receiveCurrency}</Text>
          </View>
          <Text style={styles.receivedLabel}>{firstName} receives</Text>

          {/* Ref number */}
          <Pressable onPress={handleCopyRef} style={styles.refRow}>
            <Text style={styles.refLabel}>Ref</Text>
            <Text style={styles.refValue}>{txRef}</Text>
            <View style={styles.refCopyBtn}>
              {copied
                ? <Check size={12} color={colors.success} strokeWidth={2.5} />
                : <Copy size={12} color={colors.brand} strokeWidth={2} />}
              <Text style={[styles.refCopy, copied && { color: colors.success }]}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* ── Cards ── */}
        <Animated.View style={cardStyle}>
          {/* Amounts summary */}
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You sent</Text>
              <Text style={styles.summaryValue}>{formatAmount(amount, currency)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{firstName} receives</Text>
              <Text style={[styles.summaryValue, styles.summaryValueReceive]}>
                {recipientCurrency.symbol}{receivedFormatted} {receiveCurrency}
              </Text>
            </View>
          </View>

          {/* Tracking steps */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Transfer status</Text>
            <View style={styles.stepsWrap}>
              {steps.map((step, i) => (
                <StepRow key={i} step={step} isLast={i === steps.length - 1} />
              ))}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Footer actions ── */}
      <View style={styles.footer}>
        <PrimaryButton onPress={() => navigation.popToTop()} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Back to wallets</Text>
        </PrimaryButton>

        <View style={styles.secondaryRow}>
          <Pressable
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Share receipt</Text>
          </Pressable>

          <View style={styles.secondaryDivider} />

          <Pressable
            onPress={() => {
              navigation.popToTop();
              navigation.navigate('SendMoney', {});
            }}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Send again</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },

  // ── Top section ──
  topSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.full },
  statusText: { fontSize: typography.xs, fontWeight: typography.bold, letterSpacing: 1 },

  receivedAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: spacing.xs,
  },
  receivedSymbol: {
    fontSize: typography.xl,
    color: colors.textSecondary,
    fontWeight: typography.bold,
    paddingBottom: 4,
  },
  receivedAmount: {
    fontSize: typography.hero,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    letterSpacing: -2,
  },
  receivedCode: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    paddingBottom: 6,
  },
  receivedLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  refLabel: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  refValue: { fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.semibold, flex: 1 },
  refCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refCopy: { fontSize: typography.xs, color: colors.brand, fontWeight: typography.semibold },

  // ── Cards ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle },

  // ── Amounts summary ──
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  summaryLabel: { fontSize: typography.base, color: colors.textSecondary },
  summaryValue: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  summaryValueReceive: { color: colors.success, fontWeight: typography.semibold },

  // ── Tracking steps ──
  stepsWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepIconCol: {
    alignItems: 'center',
    width: 28,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: colors.border,
    marginVertical: 3,
  },
  stepConnectorDone: { backgroundColor: colors.success },
  stepBody: {
    flex: 1,
    paddingBottom: spacing.lg,
    paddingTop: 3,
  },
  stepLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  stepLabelMuted: { color: colors.textMuted },
  stepSub: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  stepSubDone: { color: colors.success },
  stepSubActive: { color: colors.brand },

  // ── Footer ──
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  doneBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },

  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  secondaryBtnText: { fontSize: typography.base, color: colors.textSecondary, fontWeight: typography.medium },
  secondaryDivider: { width: 1, height: 16, backgroundColor: colors.border },
});
