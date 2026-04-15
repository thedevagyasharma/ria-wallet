import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Copy } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { getCurrency, formatAmount } from '../../data/currencies';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import SecondaryButton from '../../components/SecondaryButton';
import { StepRow } from '../../components/TransferSteps';
import type { Step } from '../../components/TransferSteps';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Tracking step definitions ────────────────────────────────────────────────

function buildSteps(eta: string, firstName: string): Step[] {
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

// ─── Presentational content (no navigation deps) ─────────────────────────────

export type SendSuccessParams = RootStackParamList['SendSuccess'];

export function SendSuccessContent({
  params,
  onBack,
  onSendAgain,
  animated = true,
}: {
  params: SendSuccessParams;
  onBack?: () => void;
  onSendAgain?: () => void;
  animated?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const slideY = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }));

  const handleBack = () => {
    slideY.value = withTiming(screenHeight, { duration: 320, easing: Easing.in(Easing.cubic) },
      (done) => { if (done && onBack) runOnJS(onBack)(); });
  };

  const { recipientName, amount, currency, receivedAmount, receiveCurrency, eta, txRef } = params;

  const recipientCurrency = getCurrency(receiveCurrency);
  const firstName = recipientName.split(' ')[0];
  const isInstant = eta === 'Instantly';

  const receivedFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(receivedAmount);

  const steps = buildSteps(eta, firstName);

  const [copied, setCopied] = useState(false);
  const handleCopyRef = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Entrance animations — skip when rendered as static background
  const headerY = useSharedValue(animated ? 16 : 0);
  const cardY   = useSharedValue(animated ? 20 : 0);

  useEffect(() => {
    if (!animated) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    headerY.value = withSpring(0, { damping: 18, stiffness: 140 });
    cardY.value   = withDelay(70, withSpring(0, { damping: 18, stiffness: 120 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerY.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
  }));

  const statusLabel = isInstant ? 'DELIVERED' : 'IN PROGRESS';
  const statusColor = isInstant ? colors.success : colors.brand;
  const statusBg    = isInstant ? colors.successSubtle : colors.brandSubtle;
  const statusBorder = isInstant ? colors.success : colors.brand;

  return (
    <Animated.View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }, slideStyle]}>
      <LinearGradient
        colors={[colors.brandSubtle, colors.bg]}
        locations={[0, 0.42]}
        style={StyleSheet.absoluteFill}
      />
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
        <View style={styles.secondaryRow}>
          <Pressable
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Share receipt</Text>
          </Pressable>

          <View style={styles.secondaryDivider} />

          <Pressable
            onPress={onSendAgain}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Send again</Text>
          </Pressable>
        </View>

        <SecondaryButton onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back to wallets</Text>
        </SecondaryButton>
      </View>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SendSuccessScreen({ route }: RootStackProps<'SendSuccess'>) {
  const navigation = useNavigation<Nav>();
  return (
    <SendSuccessContent
      params={route.params}
      animated={false}
      onBack={() => navigation.popToTop()}
      onSendAgain={() => {
        navigation.popToTop();
        navigation.navigate('SendMoney', {});
      }}
    />
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
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  secondaryBtnText: { fontSize: typography.base, color: colors.textSecondary, fontWeight: typography.medium },
  secondaryDivider: { width: 1, height: 16, backgroundColor: colors.border },

  backBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
});
