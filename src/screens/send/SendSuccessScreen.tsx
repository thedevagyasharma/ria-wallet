import React, { useEffect } from 'react';
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

import { colors, typography, spacing } from '../../theme';
import { getCurrency } from '../../data/currencies';
import { useWalletStore } from '../../stores/useWalletStore';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import SecondaryButton from '../../components/SecondaryButton';
import {
  StatusBadge,
  RefCopyRow,
  TxSummaryCard,
  TxTimeline,
  getTxRef,
  shouldShowTimeline,
} from '../../components/TransactionView';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export type SendSuccessParams = RootStackParamList['SendSuccess'];

// ─── Presentational content (no navigation deps) ─────────────────────────────

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

  const tx = useWalletStore((s) => s.transactions.find((t) => t.id === params.txId));

  // Entrance animations — skip when rendered as static background
  const headerY = useSharedValue(animated ? 16 : 0);
  const cardY   = useSharedValue(animated ? 20 : 0);

  useEffect(() => {
    if (!animated || !tx) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    headerY.value = withSpring(0, { damping: 18, stiffness: 140 });
    cardY.value   = withDelay(70, withSpring(0, { damping: 18, stiffness: 120 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const headerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: headerY.value }] }));
  const cardStyle   = useAnimatedStyle(() => ({ transform: [{ translateY: cardY.value }] }));

  const handleBack = () => {
    slideY.value = withTiming(screenHeight, { duration: 320, easing: Easing.in(Easing.cubic) },
      (done) => { if (done && onBack) runOnJS(onBack)(); });
  };

  if (!tx) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Transfer not found.</Text>
        </View>
      </View>
    );
  }

  const firstName = tx.recipientName.split(' ')[0];
  const isInstant = tx.eta === 'Instantly' || !tx.eta;
  const receiveCurrency = tx.receiveCurrency ?? tx.currency;
  const receivedAmount  = tx.receivedAmount ?? Math.abs(tx.amount);
  const receiveSymbol   = getCurrency(receiveCurrency).symbol;

  const receivedFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(receivedAmount);

  // SendSuccess is a post-send moment — timeline reflects inflight state
  // via ETA, not the stored tx.status (which is always 'completed' on reach).
  const timelineStatus = isInstant ? 'completed' : 'pending';

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
        {/* ── Hero ── */}
        <Animated.View style={[styles.topSection, headerStyle]}>
          <StatusBadge variant={isInstant ? 'completed' : 'inProgress'} />

          <View style={styles.receivedAmountRow}>
            <Text style={styles.receivedSymbol}>{receiveSymbol}</Text>
            <Text style={styles.receivedAmount}>{receivedFormatted}</Text>
            <Text style={styles.receivedCode}>{receiveCurrency}</Text>
          </View>
          <Text style={styles.receivedLabel}>{firstName} receives</Text>

          <View style={styles.refWrap}>
            <RefCopyRow refValue={getTxRef(tx)} />
          </View>
        </Animated.View>

        {/* ── Sections ── */}
        <Animated.View style={cardStyle}>
          <TxSummaryCard tx={tx} />
          {shouldShowTimeline(tx) && (
            <View style={styles.timelineCard}>
              <Text style={styles.cardTitle}>Transfer status</Text>
              <TxTimeline status={timelineStatus} firstName={firstName} />
            </View>
          )}
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

          <Pressable onPress={onSendAgain} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Send again</Text>
          </Pressable>

          <View style={styles.secondaryDivider} />

          <Pressable
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Get help</Text>
          </Pressable>
        </View>

        <SecondaryButton onPress={handleBack} label="Back to wallets" style={styles.backBtn} />
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
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl },

  // ── Top section ──
  topSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },

  receivedAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: spacing.sm,
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

  refWrap: { alignSelf: 'stretch', marginTop: spacing.md },

  // ── Timeline card wrapper (matches TxSummaryCard shell) ──
  timelineCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingBottom: spacing.sm,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.xs,
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

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: typography.base, color: colors.textMuted },
});
