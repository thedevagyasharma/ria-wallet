import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  LayoutAnimation,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  interpolateColor,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Check, X, Zap, Pen } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import SecondaryButton from '../../components/SecondaryButton';
import FlatButton from '../../components/FlatButton';
import FlagIcon from '../../components/FlagIcon';
import Avatar from '../../components/Avatar';
import { CHIP_SIZES } from '../../components/Chip';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import { getRate, getFee, getFeeTierLabel, getETA } from '../../data/exchangeRates';
import type { RootStackParamList } from '../../navigation/types';
import type { Transaction } from '../../stores/types';
import { usePendingTransferStore } from '../../stores/usePendingTransferStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = 'idle' | 'processing' | 'success' | 'viewTransfer' | 'failed' | 'retryReady';
type Outcome = 'success' | 'failure';

const CHIP_MD = CHIP_SIZES.md;
const SLOT_H = 26;
const CHIP_SLOT = 18;

// ─── Breakdown row ────────────────────────────────────────────────────────────

function Row({ label, subtitle, value, flagCode, bold, struck }: {
  label: string; subtitle?: string; value: string; flagCode?: string; bold?: boolean; struck?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <View>
        <Text style={[rowStyles.label, bold && rowStyles.boldLabel, struck && rowStyles.struckLabel]}>{label}</Text>
        {subtitle && <Text style={rowStyles.subtitle}>{subtitle}</Text>}
      </View>
      {flagCode ? (
        <View style={rowStyles.valueWithFlag}>
          <FlagIcon code={flagCode} size={14} />
          <Text style={[rowStyles.value, bold && rowStyles.boldValue, struck && rowStyles.struckValue]}>{value}</Text>
        </View>
      ) : (
        <Text style={[rowStyles.value, bold && rowStyles.boldValue, struck && rowStyles.struckValue]}>{value}</Text>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  label: { fontSize: typography.base, color: colors.textSecondary },
  value: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  boldLabel: { color: colors.textPrimary, fontWeight: typography.semibold },
  boldValue: { fontSize: typography.lg, fontWeight: typography.bold, letterSpacing: -0.5 },
  struckLabel: { color: colors.textMuted },
  struckValue: { color: colors.textMuted, textDecorationLine: 'line-through' as const },
  valueWithFlag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subtitle: { fontSize: typography.xs, color: colors.textMuted, marginTop: 2 },
});

// ─── Segmented control (prototype settings) ───────────────────────────────────

function SegControl<T extends string>({
  options, value, onChange, label,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={segStyles.row}>
      <Text style={segStyles.label}>{label}</Text>
      <View style={segStyles.track}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => { Haptics.selectionAsync(); onChange(opt.value); }}
            style={[segStyles.seg, value === opt.value && segStyles.segActive]}
          >
            <Text style={[segStyles.segText, value === opt.value && segStyles.segTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  label: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },
  track: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  seg: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  segActive: { backgroundColor: colors.textPrimary },
  segText: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.semibold },
  segTextActive: { color: colors.bg },
});

// ─── Morphing confirm button ──────────────────────────────────────────────────

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function MorphButton({
  phase, onConfirm, onViewTransfer, onRetry, total, currency,
}: {
  phase: Phase; onConfirm: () => void; onViewTransfer: () => void; onRetry: () => void;
  total: number; currency: string;
}) {
  const [display, setDisplay] = useState<Phase>('idle');

  const [brandR, brandG, brandB] = hexRgb('#f97316');
  const bgR = useSharedValue(brandR);
  const bgG = useSharedValue(brandG);
  const bgB = useSharedValue(brandB);
  const iconY = useSharedValue(0);
  const textY = useSharedValue(0);

  function snapBg(hex: string) {
    const [r, g, b] = hexRgb(hex);
    bgR.value = r; bgG.value = g; bgB.value = b;
  }
  function animateBg(hex: string, dur: number) {
    const [r, g, b] = hexRgb(hex);
    const cfg = { duration: dur, easing: Easing.out(Easing.cubic) };
    bgR.value = withTiming(r, cfg);
    bgG.value = withTiming(g, cfg);
    bgB.value = withTiming(b, cfg);
  }

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgb(${Math.round(bgR.value)},${Math.round(bgG.value)},${Math.round(bgB.value)})`,
  }));
  const iconAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateY: iconY.value }] }));
  const textAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateY: textY.value }] }));

  useEffect(() => {
    if (phase === 'idle') {
      setDisplay('idle');
      snapBg('#f97316');
      iconY.value = 0; textY.value = 0;
      return;
    }
    if (phase === 'processing') {
      setDisplay('processing');
      snapBg(colors.surfaceHigh);
      iconY.value = 0; textY.value = 0;
      return;
    }
    const targetBg =
      phase === 'success'     ? colors.successSubtle :
      phase === 'failed'      ? colors.failedSubtle  :
      /* viewTransfer / retryReady */ '#f97316';
    animateBg(targetBg, (phase === 'viewTransfer' || phase === 'retryReady') ? 350 : 450);
    iconY.value = withTiming(-SLOT_H, { duration: 110, easing: Easing.in(Easing.quad) });
    textY.value = withDelay(50,
      withTiming(-SLOT_H, { duration: 110, easing: Easing.in(Easing.quad) }, (done) => {
        if (!done) return;
        runOnJS(setDisplay)(phase);
        iconY.value = SLOT_H;
        textY.value = SLOT_H;
        iconY.value = withTiming(0, { duration: 190, easing: Easing.out(Easing.cubic) });
        textY.value = withDelay(40, withTiming(0, { duration: 190, easing: Easing.out(Easing.cubic) }));
      }),
    );
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const isInteractive = phase === 'idle' || phase === 'viewTransfer' || phase === 'retryReady';
  const hasIcon = display === 'processing' || display === 'success' || display === 'failed';

  return (
    <Animated.View style={[morphStyles.outer, bgStyle]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.00)']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        onPress={phase === 'idle' ? onConfirm : phase === 'viewTransfer' ? onViewTransfer : phase === 'retryReady' ? onRetry : undefined}
        style={({ pressed }) => [morphStyles.pressable, pressed && isInteractive && morphStyles.pressablePressed]}
      >
        {display === 'idle' ? (
          <View style={morphStyles.spread}>
            <Text style={morphStyles.textAction}>Confirm and send</Text>
            <Text style={morphStyles.textActionMuted}>{formatAmount(total, currency)}</Text>
          </View>
        ) : display === 'viewTransfer' || display === 'retryReady' ? (
          <View style={morphStyles.slotRow}>
            <View style={[morphStyles.textClip, { flex: 1 }]}>
              <Animated.View style={textAnimStyle}>
                <Text style={[morphStyles.textAction, { textAlign: 'center' as const }]}>
                  {display === 'viewTransfer' ? 'View details' : 'Try again'}
                </Text>
              </Animated.View>
            </View>
          </View>
        ) : (
          <View style={morphStyles.slotRow}>
            {hasIcon && (
              <View style={morphStyles.iconClip}>
                <Animated.View style={iconAnimStyle}>
                  {display === 'processing' && <ActivityIndicator size="small" color={colors.textSecondary} />}
                  {display === 'success'    && <Check size={17} color={colors.success} strokeWidth={2.5} />}
                  {display === 'failed'     && <X     size={17} color={colors.failed}  strokeWidth={2.5} />}
                </Animated.View>
              </View>
            )}
            <View style={morphStyles.textClip}>
              <Animated.View style={textAnimStyle}>
                {display === 'processing' && <Text style={morphStyles.textProcessing}>Processing…</Text>}
                {display === 'success'    && <Text style={morphStyles.textSuccess}>Transfer sent</Text>}
                {display === 'failed'     && <Text style={morphStyles.textFailed}>Transfer failed</Text>}
              </Animated.View>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const morphStyles = StyleSheet.create({
  outer: {
    borderRadius: 999, overflow: 'hidden',
    shadowColor: '#441306', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  pressable: { paddingVertical: 13, paddingHorizontal: spacing.xl },
  pressablePressed: { transform: [{ scale: 0.98 }] },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: SLOT_H },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  iconClip: { width: 22, height: SLOT_H, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  textClip: { height: SLOT_H, overflow: 'hidden', justifyContent: 'center' },
  textAction:      { fontSize: typography.md, color: '#441306',             fontWeight: typography.bold },
  textActionMuted: { fontSize: typography.md, color: 'rgba(68,19,6,0.60)', fontWeight: typography.semibold },
  textProcessing:  { fontSize: typography.md, color: colors.textSecondary, fontWeight: typography.semibold },
  textSuccess:     { fontSize: typography.md, color: colors.success,        fontWeight: typography.bold },
  textFailed:      { fontSize: typography.md, color: colors.failed,         fontWeight: typography.bold },
});

// ─── Confirm hero ─────────────────────────────────────────────────────────────

type ChipState = 'eta' | 'success' | 'failed';

function chipStateForPhase(phase: Phase): ChipState {
  if (phase === 'success' || phase === 'viewTransfer') return 'success';
  if (phase === 'failed'  || phase === 'retryReady')   return 'failed';
  return 'eta';
}

function successLabel(eta: string): string {
  return eta === 'Instant' ? 'COMPLETE' : 'SUBMITTED';
}

function chipText(state: ChipState, eta: string): string {
  if (state === 'eta')     return eta;
  if (state === 'success') return successLabel(eta);
  return 'FAILED';
}

const CHIP_COLOR_MAP: Record<ChipState, [string, string, string]> = {
  eta:     [colors.brandSubtle,   colors.brand,   colors.brand],
  success: [colors.successSubtle, colors.success, colors.success],
  failed:  [colors.failedSubtle,  colors.failed,  colors.failed],
};

function ConfirmHero({ phase, label, amount, currencyCode, eta }: {
  phase: Phase; label: string; amount: string; currencyCode: string; eta: string;
}) {
  const [displayState, setDisplayState] = useState<ChipState>('eta');

  const swapDisplay = useCallback((next: ChipState) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.scaleX));
    setDisplayState(next);
  }, []);

  const colorProgress = useSharedValue(0);
  const contentY = useSharedValue(0);

  useEffect(() => {
    const next = chipStateForPhase(phase);
    if (next === displayState) return;
    const nextIdx = next === 'eta' ? 0 : next === 'success' ? 1 : 2;
    colorProgress.value = withTiming(nextIdx, { duration: 280, easing: Easing.out(Easing.cubic) });
    contentY.value = withTiming(-CHIP_SLOT, { duration: 110, easing: Easing.in(Easing.quad) }, (done) => {
      if (!done) return;
      runOnJS(swapDisplay)(next);
      contentY.value = CHIP_SLOT;
      contentY.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const bgColors   = [CHIP_COLOR_MAP.eta[0], CHIP_COLOR_MAP.success[0], CHIP_COLOR_MAP.failed[0]];
  const bordColors = [CHIP_COLOR_MAP.eta[1], CHIP_COLOR_MAP.success[1], CHIP_COLOR_MAP.failed[1]];

  const chipAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(colorProgress.value, [0, 1, 2], bgColors),
    borderColor:     interpolateColor(colorProgress.value, [0, 1, 2], bordColors),
  }));
  const contentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: contentY.value }],
  }));

  const textColor = CHIP_COLOR_MAP[displayState][2];

  return (
    <View style={styles.confirmHero}>
      <Animated.View style={[styles.heroChip, chipAnimStyle]}>
        <View style={styles.heroChipClip}>
          <Animated.View style={[styles.heroChipContent, contentAnimStyle]}>
            {displayState === 'eta' && <Zap size={11} color={textColor} strokeWidth={2.5} />}
            <Text style={[styles.heroChipText, { color: textColor }]}>
              {chipText(displayState, eta)}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
      <Text style={styles.confirmHeroLabel}>{label}</Text>
      <View style={styles.confirmHeroAmountRow}>
        <Text style={styles.confirmHeroAmount}>{amount}</Text>
        <Text style={styles.confirmHeroAmountCode}>{currencyCode}</Text>
      </View>
      {(phase === 'failed' || phase === 'retryReady') && (
        <Text style={styles.failureSub}>No funds were deducted from your wallet.</Text>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ConfirmTransferScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { wallets, deductBalance, addTransaction } = useWalletStore();

  const { pending, clear } = usePendingTransferStore();
  const contact      = pending?.contact ?? null;
  const sendWalletId = pending?.sendWalletId ?? wallets[0]?.id ?? '';
  const sendAmount   = pending?.sendAmount   ?? 0;
  const receiveCurrency = pending?.receiveCurrency ?? 'USD';

  const sendWallet  = wallets.find((w) => w.id === sendWalletId) ?? wallets[0];
  const sendCurrency = getCurrency(sendWallet.currency);
  const rate         = getRate(sendWallet.currency, receiveCurrency);
  const fee          = getFee(sendAmount, sendWallet.currency);
  const total        = sendAmount + fee;
  const eta          = contact ? getETA(sendWallet.currency, receiveCurrency) : 'Instant';
  const converted    = sendAmount * rate;
  const convertedFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(converted);

  const [phase, setPhase] = useState<Phase>('idle');
  const [protoOutcome, setProtoOutcome] = useState<Outcome>('success');
  const [protoDelay, setProtoDelay]     = useState(1000);
  const successParamsRef = useRef<{ txId: string } | null>(null);

  // Block hardware back while processing
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'processing') return true;
      if (phase === 'success' || phase === 'viewTransfer' || phase === 'failed' || phase === 'retryReady') {
        handleCloseToWallets();
        return true;
      }
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoBack = useCallback(() => {
    if (phase !== 'idle') return;
    navigation.goBack();
  }, [phase, navigation]);

  const handleViewTransfer = useCallback(() => {
    if (!successParamsRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clear();
    navigation.replace('TransactionDetail', { ...successParamsRef.current, mode: 'receipt' });
  }, [navigation, clear]);

  const handleCloseToWallets = useCallback(() => {
    clear();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  }, [navigation, clear]);

  const handleConfirm = useCallback(() => {
    if (!contact) return;
    if (total > sendWallet.balance) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const capturedOutcome = protoOutcome;
    const txRef = `RIA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    if (capturedOutcome === 'success') {
      const tx: Transaction = {
        id: `tx-${Date.now()}`,
        walletId: sendWalletId,
        type: 'send',
        recipientName: contact.name,
        amount: -total,
        currency: sendWallet.currency,
        date: new Date(),
        status: 'completed',
        ref: txRef,
        fee,
        rate,
        receivedAmount: converted,
        receiveCurrency,
        eta,
      };
      deductBalance(sendWalletId, total);
      addTransaction(tx);
      successParamsRef.current = { txId: tx.id };
    }
    setPhase('processing');
    setTimeout(() => {
      if (capturedOutcome === 'success') {
        setPhase('success');
        setTimeout(() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setPhase('viewTransfer');
        }, 2000);
      } else {
        setPhase('failed');
        setTimeout(() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setPhase('retryReady');
        }, 2000);
      }
    }, protoDelay);
  }, [contact, total, sendWallet, protoOutcome, protoDelay, sendWalletId, deductBalance, addTransaction, converted, receiveCurrency, eta, fee, rate]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={phase === 'viewTransfer' || phase === 'retryReady' ? handleCloseToWallets : handleGoBack}
          style={styles.backBtn}
          disabled={phase === 'processing' || phase === 'success' || phase === 'failed'}
        >
          {phase === 'viewTransfer' || phase === 'retryReady' ? (
            <X size={22} color={colors.textPrimary} strokeWidth={2} />
          ) : (
            <ChevronLeft size={24} color={phase === 'idle' ? colors.textPrimary : 'transparent'} strokeWidth={2} />
          )}
        </Pressable>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Text style={styles.title}>Confirm transfer</Text>
        </View>
        <SecondaryButton
          onPress={handleGoBack}
          disabled={phase !== 'idle'}
          style={[styles.editHeaderBtn, phase !== 'idle' && { opacity: 0 }]}
        >
          <Pen size={11} color={colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.editHeaderBtnText}>Edit</Text>
        </SecondaryButton>
      </View>

      {/* Scrollable breakdown */}
      <ScrollView
        contentContainerStyle={styles.confirmScroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={phase === 'idle' || phase === 'failed'}
      >
        <ConfirmHero
          phase={phase}
          label={`${contact?.name.split(' ')[0]} receives`}
          amount={`${getCurrency(receiveCurrency).symbol}${convertedFormatted}`}
          currencyCode={receiveCurrency}
          eta={eta}
        />

        {/* Recipient */}
        <View style={styles.confirmSection}>
          <Text style={styles.confirmSectionLabel}>Recipient</Text>
          <View style={styles.recipientRow}>
            {contact && <Avatar name={contact.name} size="lg" />}
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmRecipientName}>{contact?.name}</Text>
              <Text style={styles.confirmRecipientPhone}>{contact?.phone}</Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.confirmSection, { borderBottomWidth: 0, marginBottom: 0 }]}>
          <Text style={styles.confirmSectionLabel}>Details</Text>
          <Row label="From wallet" value={sendCurrency.code} flagCode={sendCurrency.flag} />
          <View style={styles.confirmDivider} />
          <Row label="You send" value={formatAmount(sendAmount, sendWallet.currency)} />
          <View style={styles.confirmDivider} />
          <Row label="Transfer fee" subtitle={getFeeTierLabel(sendAmount, sendWallet.currency)} value={formatAmount(fee, sendWallet.currency)} />
          <View style={styles.confirmDivider} />
          <Row label="Total deducted" value={formatAmount(total, sendWallet.currency)} bold struck={phase === 'failed' || phase === 'retryReady'} />
          <View style={styles.confirmDivider} />
          <View style={styles.rateFootnote}>
            <Text style={styles.rateFootnoteText}>1 {sendCurrency.code} = {rate.toFixed(4)} {receiveCurrency}</Text>
          </View>
        </View>

        {/* Prototype settings */}
        {phase === 'idle' && (
          <View style={styles.protoWrap}>
            <Text style={styles.protoTitle}>⚙  Prototype</Text>
            <SegControl<Outcome>
              label="Outcome"
              value={protoOutcome}
              onChange={setProtoOutcome}
              options={[{ label: 'Success', value: 'success' }, { label: 'Failure', value: 'failure' }]}
            />
            <SegControl<string>
              label="Delay"
              value={String(protoDelay)}
              onChange={(v) => setProtoDelay(Number(v))}
              options={[{ label: '0.5s', value: '500' }, { label: '1s', value: '1000' }, { label: '2s', value: '2000' }, { label: '3s', value: '3000' }]}
            />
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.confirmFooter, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
        <MorphButton
          phase={phase}
          onConfirm={handleConfirm}
          onViewTransfer={handleViewTransfer}
          onRetry={() => setPhase('idle')}
          total={total}
          currency={sendWallet.currency}
        />
        {(phase === 'viewTransfer' || phase === 'retryReady') && (
          <Animated.View entering={FadeIn.duration(300).delay(200)}>
            <FlatButton
              onPress={handleCloseToWallets}
              label={phase === 'viewTransfer' ? 'Done' : 'Close'}
              style={styles.exitBtn}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },
  editHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  editHeaderBtnText: { fontSize: 11, color: colors.textPrimary, fontWeight: typography.semibold },

  confirmScroll: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  confirmHero: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl, gap: spacing.xs },
  confirmHeroLabel: { fontSize: typography.sm, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, fontWeight: typography.semibold },
  confirmHeroAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  confirmHeroAmount: { fontSize: typography.hero, color: colors.textPrimary, fontWeight: typography.bold, letterSpacing: -2 },
  confirmHeroAmountCode: { fontSize: typography.lg, color: colors.textSecondary, fontWeight: typography.semibold, paddingBottom: 6 },
  heroChip: { borderRadius: radius.full, paddingHorizontal: CHIP_MD.paddingHorizontal, paddingVertical: CHIP_MD.paddingVertical, borderWidth: 1, marginBottom: spacing.sm, overflow: 'hidden', alignItems: 'center' },
  heroChipClip: { height: CHIP_SLOT, overflow: 'hidden', justifyContent: 'center' },
  heroChipContent: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heroChipText: { fontSize: CHIP_MD.fontSize, fontWeight: CHIP_MD.fontWeight },

  confirmSection: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, marginBottom: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  confirmSectionLabel: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.lg },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  confirmRecipientName: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },
  confirmRecipientPhone: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  confirmDivider: { height: 1, backgroundColor: colors.borderSubtle },
  rateFootnote: { paddingVertical: spacing.sm, alignItems: 'center' },
  rateFootnoteText: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.medium },

  protoWrap: { marginTop: spacing.xxl, paddingTop: spacing.lg, paddingHorizontal: spacing.xl, borderTopWidth: 1, borderTopColor: colors.borderSubtle, gap: spacing.sm },
  protoTitle: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },

  confirmFooter: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  exitBtn: { alignSelf: 'center' as const, marginTop: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  failureSub: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center' },
});
