import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Zap, Pen, Check, X } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import { MOCK_CONTACTS } from '../../data/mockData';
import { getRate, getFee, getETA } from '../../data/exchangeRates';
import FlagIcon from '../../components/FlagIcon';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Transaction } from '../../stores/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = 'idle' | 'processing' | 'success' | 'viewTransfer' | 'failed';
type Outcome = 'success' | 'failure';
type TrackingParams = RootStackParamList['SendSuccess'];

// ─── Segmented control ────────────────────────────────────────────────────────

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

// ─── Confirmation breakdown row ───────────────────────────────────────────────

function Row({ label, value, flagCode }: { label: string; value: string; flagCode?: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      {flagCode ? (
        <View style={rowStyles.valueWithFlag}>
          <FlagIcon code={flagCode} size={14} />
          <Text style={rowStyles.value}>{value}</Text>
        </View>
      ) : (
        <Text style={rowStyles.value}>{value}</Text>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  label: { fontSize: typography.base, color: colors.textSecondary },
  value: { fontSize: typography.base, color: colors.textPrimary },
  valueWithFlag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

// ─── Morphing button ──────────────────────────────────────────────────────────
// States and their bg / text colors:
//   idle        → brand orange   dark text
//   processing  → grey (snap)    muted text + spinner
//   success     → successSubtle  green text + check
//   viewTransfer→ brand orange   dark text
//   failed      → failedSubtle   red text + X
//
// Content transitions: slot-machine flip (exit up, enter from below)
// Icon exits first, text 50ms staggered
// Background: RGB-component animation to avoid interpolateColor multi-stop bleed

const SLOT_H = 26; // clip height in px — must fit font at typography.md

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function MorphButton({
  phase,
  onConfirm,
  onViewTransfer,
  total,
  currency,
}: {
  phase: Phase;
  onConfirm: () => void;
  onViewTransfer: () => void;
  total: number;
  currency: string;
}) {
  const [display, setDisplay] = useState<Phase>('idle');

  // Background as animated RGB components — avoids multi-stop bleed
  const [brandR, brandG, brandB] = hexRgb('#f97316');
  const bgR = useSharedValue(brandR);
  const bgG = useSharedValue(brandG);
  const bgB = useSharedValue(brandB);

  // Slot animation Y offsets
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

    // Animated transitions: success / failed / viewTransfer
    const targetBg =
      phase === 'success'      ? colors.successSubtle :
      phase === 'failed'       ? colors.failedSubtle  :
      /* viewTransfer */         '#f97316';

    animateBg(targetBg, phase === 'viewTransfer' ? 350 : 450);

    // Slot exit: icon first, text 50ms later
    // On text exit complete: swap content, snap both to bottom, animate back in
    iconY.value = withTiming(-SLOT_H, { duration: 110, easing: Easing.in(Easing.quad) });
    textY.value = withDelay(
      50,
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

  const isInteractive = phase === 'idle' || phase === 'viewTransfer';
  const hasIcon = display === 'processing' || display === 'success' || display === 'failed';

  return (
    <Animated.View style={[morphStyles.outer, bgStyle]}>
      {/* Gloss — visible on orange bg, imperceptible on light bgs */}
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.00)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        onPress={phase === 'idle' ? onConfirm : phase === 'viewTransfer' ? onViewTransfer : undefined}
        style={({ pressed }) => [
          morphStyles.pressable,
          pressed && isInteractive && morphStyles.pressablePressed,
        ]}
      >
        {display === 'idle' ? (
          // Spread layout — no slot clipping needed, changes are instant
          <View style={morphStyles.spread}>
            <Text style={morphStyles.textAction}>Confirm and send</Text>
            <Text style={morphStyles.textActionMuted}>{formatAmount(total, currency)}</Text>
          </View>
        ) : display === 'viewTransfer' ? (
          // Full-width centered single text
          <View style={morphStyles.slotRow}>
            <View style={[morphStyles.textClip, { flex: 1 }]}>
              <Animated.View style={textAnimStyle}>
                <Text style={[morphStyles.textAction, { textAlign: 'center' as const }]}>View transfer</Text>
              </Animated.View>
            </View>
          </View>
        ) : (
          // Centered icon + text with individual slot clips
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
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#441306',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  pressable: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  pressablePressed: { transform: [{ scale: 0.98 }] },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  iconClip: { width: 22, height: SLOT_H, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  textClip: { height: SLOT_H, overflow: 'hidden', justifyContent: 'center' },
  textAction:      { fontSize: typography.md, color: '#441306',              fontWeight: typography.bold },
  textActionMuted: { fontSize: typography.md, color: 'rgba(68,19,6,0.60)',   fontWeight: typography.semibold },
  textProcessing:  { fontSize: typography.md, color: colors.textSecondary,   fontWeight: typography.semibold },
  textSuccess:     { fontSize: typography.md, color: colors.success,         fontWeight: typography.bold },
  textFailed:      { fontSize: typography.md, color: colors.failed,          fontWeight: typography.bold },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ConfirmationScreen({ route }: RootStackProps<'Confirmation'>) {
  const navigation = useNavigation<Nav>();
  const { walletId, contactId, amount, receiveCurrency } = route.params;
  const { wallets, deductBalance, addTransaction } = useWalletStore();

  const wallet   = wallets.find((w) => w.id === walletId)!;
  const currency = getCurrency(wallet.currency);
  const contact  = MOCK_CONTACTS.find((c) => c.id === contactId)!;
  const recipientCurrency = getCurrency(receiveCurrency);

  const rate      = getRate(wallet.currency, receiveCurrency);
  const fee       = getFee(amount, wallet.currency);
  const converted = amount * rate;
  const total     = amount + fee;
  const eta       = getETA(wallet.currency, receiveCurrency);
  const firstName = contact.name.split(' ')[0];

  // ── Prototype settings ──
  const [protoOutcome, setProtoOutcome] = useState<Outcome>('success');
  const [protoDelay,   setProtoDelay]   = useState(1000);

  // ── Phase machine ──
  const [phase, setPhase] = useState<Phase>('idle');

  // Stored for navigation after slide completes
  const successParamsRef = useRef<TrackingParams | null>(null);

  // ── Disable swipe-back when mid-flow ──
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: phase === 'idle' });
  }, [phase, navigation]);

  // ── Drawer slide-down ──
  const { height: screenHeight } = Dimensions.get('window');
  const slideY = useSharedValue(0);
  const drawerSlide = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const doGoBack = useCallback(() => navigation.goBack(), [navigation]);

  // ── Android back ──
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'processing') return true;
      if (phase !== 'idle') {
        // treat as close
        slideY.value = withTiming(screenHeight, { duration: 320, easing: Easing.in(Easing.cubic) },
          (done) => { if (done) runOnJS(doGoBack)(); });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phase, slideY, screenHeight, doGoBack]);

  // ── Confirm tap ──
  const handleConfirm = useCallback(() => {
    if (total > wallet.balance) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const capturedOutcome = protoOutcome;
    const txRef = `RIA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    if (capturedOutcome === 'success') {
      const tx: Transaction = {
        id: `tx-${Date.now()}`,
        walletId,
        type: 'send',
        recipientName: contact.name,
        amount: -total,
        currency: wallet.currency,
        date: new Date(),
        status: 'completed',
      };
      deductBalance(walletId, total);
      addTransaction(tx);
      successParamsRef.current = {
        recipientName: contact.name,
        amount,
        currency: wallet.currency,
        receivedAmount: converted,
        receiveCurrency,
        eta,
        txRef,
      };
    }

    setPhase('processing');

    // Remove SendMoney from the stack so it doesn't sit behind us during the
    // success slide-out. Keep only [Main, Confirmation].
    const navState = navigation.getState();
    const selfRoute = navState.routes[navState.index];
    navigation.dispatch(CommonActions.reset({
      index: 1,
      routes: [{ name: 'Main' }, { key: selfRoute.key, name: 'Confirmation', params: route.params }],
    }));

    setTimeout(() => {
      if (capturedOutcome === 'success') {
        setPhase('success');
        // Persist "Transfer sent" for 2 seconds before advancing to the CTA
        setTimeout(() => setPhase('viewTransfer'), 2000);
      } else {
        setPhase('failed');
      }
    }, protoDelay);
  }, [total, wallet, protoOutcome, protoDelay, walletId, contact, deductBalance, addTransaction, amount, converted, receiveCurrency, eta]);

  // ── "View transfer" → slide whole screen down → navigate to SendSuccess ──
  const doNavigateSuccess = useCallback(() => {
    if (!successParamsRef.current) return;
    navigation.dispatch(CommonActions.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'SendSuccess', params: successParamsRef.current }],
    }));
  }, [navigation]);

  const handleViewTransfer = useCallback(() => {
    if (!successParamsRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    slideY.value = withTiming(
      screenHeight,
      { duration: 320, easing: Easing.in(Easing.cubic) },
      (done) => { if (done) runOnJS(doNavigateSuccess)(); },
    );
  }, [slideY, screenHeight, doNavigateSuccess]);

  // ── Close ──
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (phase === 'idle') {
      navigation.goBack();
      return;
    }
    slideY.value = withTiming(
      screenHeight,
      { duration: 320, easing: Easing.in(Easing.cubic) },
      (done) => { if (done) runOnJS(doGoBack)(); },
    );
  }, [phase, navigation, slideY, screenHeight, doGoBack]);

  const convertedFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);

  return (
    <Animated.View style={[styles.root, drawerSlide]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              disabled={phase !== 'idle'}
            >
              <ChevronLeft
                size={24}
                color={phase === 'idle' ? colors.textPrimary : 'transparent'}
                strokeWidth={2}
              />
            </Pressable>
            <Text style={styles.title}>Confirm transfer</Text>
            <View style={styles.backBtn} />
          </View>

          {/* Confirmation content — always visible throughout all phases */}
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            scrollEnabled={phase === 'idle'}
          >
            {/* Hero */}
            <View style={styles.hero}>
              <FlagIcon code={contact.flag} size={48} style={styles.heroFlag} />
              <Text style={styles.heroLabel}>{firstName} receives</Text>
              <View style={styles.heroAmountRow}>
                <Text style={styles.heroAmount}>
                  {recipientCurrency.symbol}{convertedFormatted}
                </Text>
                <Text style={styles.heroAmountCode}>{receiveCurrency}</Text>
              </View>
              <View style={styles.etaChip}>
                <Zap size={12} color={colors.success} strokeWidth={2.5} />
                <Text style={styles.etaText}>{eta}</Text>
              </View>
            </View>

            {/* Recipient */}
            <View style={styles.card}>
              <View style={styles.recipientRow}>
                <View style={styles.recipientAvatar}>
                  <FlagIcon code={contact.flag} size={24} />
                </View>
                <View style={styles.recipientDetails}>
                  <Text style={styles.recipientName}>{contact.name}</Text>
                  <Text style={styles.recipientPhone}>{contact.phone}</Text>
                </View>
              </View>
            </View>

            {/* Breakdown */}
            <View style={styles.card}>
              <Row label="From wallet" value={currency.code} flagCode={currency.flag} />
              <View style={styles.divider} />
              <Row label="You send"     value={formatAmount(amount, wallet.currency)} />
              <View style={styles.divider} />
              <Row label="Transfer fee" value={formatAmount(fee, wallet.currency)} />
              <View style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total deducted</Text>
                <Text style={styles.totalValue}>{formatAmount(total, wallet.currency)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.rateFootnote}>
                <Text style={styles.rateFootnoteText}>
                  1 {currency.code} = {rate.toFixed(4)} {receiveCurrency}
                </Text>
              </View>
            </View>

            {/* Edit link */}
            <Pressable
              onPress={() => navigation.goBack()}
              disabled={phase !== 'idle'}
              style={({ pressed }) => [
                styles.editBtn,
                pressed && { opacity: 0.6 },
                phase !== 'idle' && { opacity: 0 },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pen size={13} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.editBtnText}>Edit transfer</Text>
              </View>
            </Pressable>

            {/* Prototype settings */}
            <View style={styles.protoWrap}>
              <Text style={styles.protoTitle}>⚙  Prototype</Text>
              <SegControl<Outcome>
                label="Outcome"
                value={protoOutcome}
                onChange={setProtoOutcome}
                options={[
                  { label: 'Success', value: 'success' },
                  { label: 'Failure', value: 'failure' },
                ]}
              />
              <SegControl<string>
                label="Delay"
                value={String(protoDelay)}
                onChange={(v) => setProtoDelay(Number(v))}
                options={[
                  { label: '0.5s', value: '500'  },
                  { label: '1s',   value: '1000' },
                  { label: '2s',   value: '2000' },
                  { label: '3s',   value: '3000' },
                ]}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <MorphButton
              phase={phase}
              onConfirm={handleConfirm}
              onViewTransfer={handleViewTransfer}
              total={total}
              currency={wallet.currency}
            />
            <Pressable
              onPress={handleClose}
              disabled={phase === 'processing'}
              style={[styles.closeBtn, phase === 'processing' && styles.closeBtnDisabled]}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

        </SafeAreaView>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },

  hero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  heroFlag: { marginBottom: spacing.xs },
  heroLabel: { fontSize: typography.sm, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, fontWeight: typography.semibold },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  heroAmount: { fontSize: typography.hero, color: colors.textPrimary, fontWeight: typography.bold, letterSpacing: -2 },
  heroAmountCode: { fontSize: typography.lg, color: colors.textSecondary, fontWeight: typography.semibold, paddingBottom: 6 },
  etaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successSubtle, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: colors.success, marginTop: spacing.sm },
  etaText: { fontSize: typography.xs, color: colors.success, fontWeight: typography.semibold },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  recipientAvatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  recipientFlag: {},
  recipientDetails: { flex: 1 },
  recipientName: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },
  recipientPhone: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.borderSubtle },
  totalDivider: { height: 2, backgroundColor: colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surfaceHigh },
  totalLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  totalValue: { fontSize: typography.lg, color: colors.textPrimary, fontWeight: typography.bold, letterSpacing: -0.5 },
  rateFootnote: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' },
  rateFootnoteText: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.medium },
  editBtn: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  editBtnText: { fontSize: typography.sm, color: colors.textSecondary },

  protoWrap: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderSubtle, gap: spacing.sm },
  protoTitle: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },

  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm, gap: spacing.xs },
  closeBtn: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  closeBtnDisabled: { opacity: 0.35 },
  closeBtnText: { fontSize: typography.base, color: colors.textSecondary, fontWeight: typography.medium },
});
