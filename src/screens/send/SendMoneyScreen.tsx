import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronDown, Search, X, ArrowUpDown, ArrowLeftRight, Check, Phone, Zap, Pen } from 'lucide-react-native';
import { NumKey } from '../../components/NumPad';

import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import { MOCK_CONTACTS } from '../../data/mockData';
import { getRate, getFee, getETA } from '../../data/exchangeRates';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Contact, Transaction } from '../../stores/types';
import { SendSuccessContent } from './SendSuccessScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = 'idle' | 'processing' | 'success' | 'viewTransfer' | 'failed' | 'retryReady';
type Outcome = 'success' | 'failure';

// ─── Primary receive currency per recipient country ───────────────────────────

const QUICK_AMOUNTS: Record<string, number[]> = {
  USD: [25,  50,   100,   500],
  GBP: [20,  50,   100,   500],
  EUR: [25,  50,   100,   500],
  MXN: [200, 500,  1000,  5000],
  PHP: [500, 1000, 2500,  5000],
  INR: [500, 1000, 2500,  5000],
  NGN: [2500, 5000, 10000, 50000],
  GTQ: [100, 200,  500,   1000],
  HNL: [200, 500,  1000,  2500],
  DOP: [500, 1000, 2500,  5000],
  COP: [50000, 100000, 250000, 500000],
  MAD: [100, 250,  500,   1000],
};
const DEFAULT_QUICK_AMOUNTS = [25, 50, 100, 500];

const PRIMARY_CURRENCY_BY_FLAG: Record<string, string> = {
  '🇲🇽': 'MXN',
  '🇺🇸': 'USD',
  '🇵🇭': 'PHP',
  '🇮🇳': 'INR',
  '🇳🇬': 'NGN',
  '🇬🇧': 'GBP',
  '🇪🇺': 'EUR',
  '🇬🇹': 'GTQ',
  '🇭🇳': 'HNL',
  '🇩🇴': 'DOP',
  '🇨🇴': 'COP',
  '🇲🇦': 'MAD',
};

function getPrimaryCurrency(flag: string): string {
  return PRIMARY_CURRENCY_BY_FLAG[flag] ?? 'USD';
}

// Returns true when the query has enough digits to be treated as a phone number
function looksLikePhone(q: string): boolean {
  return q.replace(/\D/g, '').length >= 4;
}

const CALLING_CODE_BY_CURRENCY: Record<string, string> = {
  USD: '+1', MXN: '+52', PHP: '+63', INR: '+91', NGN: '+234',
  GBP: '+44', EUR: '+49', GTQ: '+502', HNL: '+504', DOP: '+1',
  COP: '+57', MAD: '+212',
};

// Best-effort country detection from international prefix. Returns null if unknown.
function detectFromPhone(phone: string): { flag: string; currency: string } | null {
  if (phone.startsWith('+52'))  return { flag: '🇲🇽', currency: 'MXN' };
  if (phone.startsWith('+63'))  return { flag: '🇵🇭', currency: 'PHP' };
  if (phone.startsWith('+91'))  return { flag: '🇮🇳', currency: 'INR' };
  if (phone.startsWith('+234')) return { flag: '🇳🇬', currency: 'NGN' };
  if (phone.startsWith('+44'))  return { flag: '🇬🇧', currency: 'GBP' };
  if (phone.startsWith('+502')) return { flag: '🇬🇹', currency: 'GTQ' };
  if (phone.startsWith('+504')) return { flag: '🇭🇳', currency: 'HNL' };
  if (phone.startsWith('+57'))  return { flag: '🇨🇴', currency: 'COP' };
  if (phone.startsWith('+212')) return { flag: '🇲🇦', currency: 'MAD' };
  if (phone.startsWith('+1'))   return { flag: '🇺🇸', currency: 'USD' };
  return null;
}

// ─── Numpad ───────────────────────────────────────────────────────────────────

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

// ─── Recent contact circle ────────────────────────────────────────────────────

function RecentCircle({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.recentCircleWrap, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.recentCircle}>
        <Text style={styles.recentCircleInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.recentCircleName} numberOfLines={1}>
        {contact.name.split(' ')[0]}
      </Text>
    </Pressable>
  );
}

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  label: { fontSize: typography.base, color: colors.textSecondary },
  value: { fontSize: typography.base, color: colors.textPrimary },
});

// ─── Morphing button ──────────────────────────────────────────────────────────

const SLOT_H = 26;

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function MorphButton({
  phase,
  onConfirm,
  onViewTransfer,
  onRetry,
  total,
  currency,
}: {
  phase: Phase;
  onConfirm: () => void;
  onViewTransfer: () => void;
  onRetry: () => void;
  total: number;
  currency: string;
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
      phase === 'success'      ? colors.successSubtle :
      phase === 'failed'       ? colors.failedSubtle  :
      /* viewTransfer / retryReady */  '#f97316';

    animateBg(targetBg, (phase === 'viewTransfer' || phase === 'retryReady') ? 350 : 450);

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

  const isInteractive = phase === 'idle' || phase === 'viewTransfer' || phase === 'retryReady';
  const hasIcon = display === 'processing' || display === 'success' || display === 'failed';

  return (
    <Animated.View style={[morphStyles.outer, bgStyle]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.00)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        onPress={phase === 'idle' ? onConfirm : phase === 'viewTransfer' ? onViewTransfer : phase === 'retryReady' ? onRetry : undefined}
        style={({ pressed }) => [
          morphStyles.pressable,
          pressed && isInteractive && morphStyles.pressablePressed,
        ]}
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
                  {display === 'viewTransfer' ? 'View transfer' : 'Try again'}
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SendMoneyScreen({ route }: RootStackProps<'SendMoney'>) {
  const navigation = useNavigation<Nav>();
  const { wallets, deductBalance, addTransaction } = useWalletStore();

  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  const [sendWalletId, setSendWalletId] = useState(route.params?.walletId ?? primaryWallet.id);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [receiveCurrency, setReceiveCurrency] = useState('MXN');

  // Step: recipient picker first, then amount entry, then confirm overlay
  const [step, setStep] = useState<'recipient' | 'amount' | 'confirm'>('recipient');

  // Dual-field editing
  const [activeField, setActiveField] = useState<'send' | 'receive'>('send');
  const [sendRaw, setSendRaw] = useState('0');
  const [receiveRaw, setReceiveRaw] = useState('0');

  // Blinking caret
  const [caretVisible, setCaretVisible] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => setCaretVisible((v) => !v), 530);
    return () => clearInterval(timer);
  }, []);

  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [contactQuery, setContactQuery] = useState('');

  // Confirm step state
  const [phase, setPhase] = useState<Phase>('idle');
  const [protoOutcome, setProtoOutcome] = useState<Outcome>('success');
  const [protoDelay, setProtoDelay] = useState(1000);
  const successParamsRef = useRef<RootStackParamList['SendSuccess'] | null>(null);
  const [successBgParams, setSuccessBgParams] = useState<RootStackParamList['SendSuccess'] | null>(null);
  const [showSuccessBg, setShowSuccessBg] = useState(false);

  // Derived values
  const sendWallet = wallets.find((w) => w.id === sendWalletId) ?? wallets[0];
  const sendCurrency = getCurrency(sendWallet.currency);
  const rate = getRate(sendWallet.currency, receiveCurrency);

  const sendAmountNum =
    activeField === 'send'
      ? parseFloat(sendRaw) || 0
      : (parseFloat(receiveRaw) || 0) / rate;

  const receiveAmountNum =
    activeField === 'receive'
      ? parseFloat(receiveRaw) || 0
      : (parseFloat(sendRaw) || 0) * rate;

  const fee = getFee(sendAmountNum, sendWallet.currency);
  const total = sendAmountNum + fee;
  const hasFunds = total <= sendWallet.balance;
  const canReview = sendAmountNum > 0 && hasFunds && selectedContact !== null;

  const sendDisplayText =
    activeField === 'send'
      ? sendRaw
      : sendAmountNum > 0
      ? String(parseFloat(sendAmountNum.toFixed(2)))
      : '0';

  const receiveDisplayText =
    activeField === 'receive'
      ? receiveRaw
      : receiveAmountNum > 0
      ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(receiveAmountNum)
      : '0.00';

  const caretColor = caretVisible ? colors.brand : 'transparent';

  // Confirm step derived values
  const eta = selectedContact ? getETA(sendWallet.currency, receiveCurrency) : 'Instantly';
  const converted = sendAmountNum * rate;
  const convertedFormatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(converted);

  useEffect(() => {
    if (!selectedContact) return;
    setReceiveCurrency(getPrimaryCurrency(selectedContact.flag));
  }, [selectedContact]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entry + dismiss animations ──
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  const enterY = useSharedValue(screenHeight);
  const dismissX = useSharedValue(0);
  const dismissStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: enterY.value }, { translateX: dismissX.value }],
  }));
  useEffect(() => {
    enterY.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [enterY]);
  const finishDismiss = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  const dismiss = useCallback(() => {
    dismissX.value = withTiming(
      screenWidth,
      { duration: 300, easing: Easing.in(Easing.cubic) },
      (done) => { if (done) runOnJS(finishDismiss)(); }
    );
  }, [dismissX, screenWidth, finishDismiss]);

  // ── Confirm overlay slide animation ──
  const confirmSlideX = useSharedValue(screenWidth);
  const confirmSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: confirmSlideX.value }],
  }));

  const openConfirm = useCallback(() => {
    setStep('confirm');
    setPhase('idle');
    confirmSlideX.value = screenWidth;
    confirmSlideX.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [confirmSlideX, screenWidth]);

  const handleCloseConfirm = useCallback(() => {
    if (phase === 'processing') return;
    confirmSlideX.value = withTiming(screenWidth, { duration: 280, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) {
        runOnJS(setStep)('amount');
        runOnJS(setPhase)('idle');
      }
    });
  }, [phase, confirmSlideX, screenWidth]);

  const doNavigateSuccess = useCallback(() => {
    if (!successParamsRef.current) return;
    navigation.dispatch(CommonActions.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'SendSuccess', params: successParamsRef.current }],
    }));
  }, [navigation]);

  const handleViewTransfer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    enterY.value = withTiming(screenHeight, { duration: 320, easing: Easing.in(Easing.cubic) },
      (done) => { if (done) runOnJS(doNavigateSuccess)(); });
  }, [enterY, screenHeight, doNavigateSuccess]);

  const popToTop = useCallback(() => navigation.popToTop(), [navigation]);
  const handleCloseToWallets = useCallback(() => {
    // Hide the tracking screen bg so native transparency reveals wallets behind
    setShowSuccessBg(false);
    enterY.value = withTiming(screenHeight, { duration: 320, easing: Easing.in(Easing.cubic) },
      (done) => { if (done) runOnJS(popToTop)(); });
  }, [enterY, screenHeight, popToTop]);

  const handleConfirm = useCallback(() => {
    if (!selectedContact) return;
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
        recipientName: selectedContact.name,
        amount: -total,
        currency: sendWallet.currency,
        date: new Date(),
        status: 'completed',
      };
      deductBalance(sendWalletId, total);
      addTransaction(tx);
      const sp = {
        recipientName: selectedContact.name,
        amount: sendAmountNum,
        currency: sendWallet.currency,
        receivedAmount: converted,
        receiveCurrency,
        eta,
        txRef,
      };
      successParamsRef.current = sp;
      setSuccessBgParams(sp);
      setShowSuccessBg(true);
    }
    setPhase('processing');
    setTimeout(() => {
      if (capturedOutcome === 'success') {
        setPhase('success');
        setTimeout(() => setPhase('viewTransfer'), 2000);
      } else {
        setPhase('failed');
        setTimeout(() => setPhase('retryReady'), 2000);
      }
    }, protoDelay);
  }, [selectedContact, total, sendWallet, protoOutcome, protoDelay, sendWalletId, deductBalance, addTransaction, sendAmountNum, converted, receiveCurrency, eta]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'confirm') {
        if (phase === 'success' || phase === 'viewTransfer' || phase === 'failed' || phase === 'retryReady') handleCloseToWallets();
        else if (phase !== 'processing') handleCloseConfirm();
        return true;
      }
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [step, phase, dismiss, handleCloseConfirm, handleCloseToWallets]);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .enabled(step !== 'confirm')
      .activeOffsetX([10, Infinity])
      .failOffsetY([-15, 15])
      .onUpdate((e) => {
        dismissX.value = Math.max(0, e.translationX);
      })
      .onEnd((e) => {
        if (e.translationX > screenWidth * 0.35 || e.velocityX > 600) {
          dismissX.value = withTiming(
            screenWidth,
            { duration: 180, easing: Easing.out(Easing.cubic) },
            (done) => { if (done) runOnJS(finishDismiss)(); }
          );
        } else {
          dismissX.value = withSpring(0, { damping: 20, stiffness: 200 });
        }
      }),
  [step, dismissX, screenWidth, finishDismiss]
  );
  const stepX = useSharedValue(0);
  const goToStep = useCallback((s: 'recipient' | 'amount') => {
    setStep(s);
    stepX.value = withTiming(s === 'amount' ? -screenWidth : 0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [setStep, stepX, screenWidth]);

  const stepRowAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: stepX.value }],
  }));

  // ── Shake for insufficient funds ──
  const amountShake = useSharedValue(0);
  const amountStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: amountShake.value }],
  }));
  const shake = useCallback(() => {
    amountShake.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-5, { duration: 50 }),
      withTiming(5, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [amountShake]);

  // ── Field activation ──
  const handleActivateField = useCallback(
    (field: 'send' | 'receive') => {
      if (field === activeField) return;
      Haptics.selectionAsync();
      if (field === 'receive') {
        const computed = (parseFloat(sendRaw) || 0) * rate;
        setReceiveRaw(computed > 0 ? String(parseFloat(computed.toFixed(2))) : '0');
      } else {
        const computed = (parseFloat(receiveRaw) || 0) / rate;
        setSendRaw(computed > 0 ? String(parseFloat(computed.toFixed(2))) : '0');
      }
      setActiveField(field);
    },
    [activeField, sendRaw, receiveRaw, rate],
  );

  // ── Numpad ──
  const handleKey = useCallback(
    (key: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const setRaw = activeField === 'send' ? setSendRaw : setReceiveRaw;
      setRaw((prev) => {
        if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
        if (key === '.') return prev.includes('.') ? prev : prev + '.';
        const [integer] = prev.split('.');
        if (!prev.includes('.') && integer.length >= 8) return prev;
        if (prev.includes('.')) {
          const [, dec] = prev.split('.');
          if (dec && dec.length >= 2) return prev;
        }
        if (prev === '0') return key;
        return prev + key;
      });
    },
    [activeField],
  );

  // ── Review ──
  const handleReview = useCallback(() => {
    if (!selectedContact) return;
    if (sendAmountNum <= 0 || !hasFunds) {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openConfirm();
  }, [selectedContact, sendAmountNum, hasFunds, shake, openConfirm]);

  // ── Contact selection ──
  const filteredContacts = useMemo(() => {
    if (!contactQuery.trim()) return MOCK_CONTACTS;
    const q = contactQuery.toLowerCase();
    return MOCK_CONTACTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
    );
  }, [contactQuery]);

  const handleSelectContact = useCallback((contact: Contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isSwap = selectedContact !== null;
    setSelectedContact(contact);
    setReceiveCurrency(getPrimaryCurrency(contact.flag));
    setContactQuery('');
    if (isSwap) {
      setSendRaw('0');
      setReceiveRaw('0');
      setActiveField('send');
    }
    goToStep('amount');
  }, [selectedContact, goToStep]);

  const handleSendToPhone = useCallback((phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const detected = detectFromPhone(phone);
    const flag     = detected?.flag     ?? getCurrency(primaryWallet.currency).flag;
    const currency = detected?.currency ?? primaryWallet.currency;
    const callingCode = CALLING_CODE_BY_CURRENCY[primaryWallet.currency] ?? '';
    const formatDigits = (raw: string) => {
      const d = raw.replace(/\D/g, '');
      if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
      if (d.length === 11)  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
      return d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
    };
    const displayPhone = detected ? phone : `${callingCode} ${formatDigits(phone)}`;
    const adhoc: Contact = {
      id: `adhoc-${displayPhone}`,
      name: displayPhone,
      phone: displayPhone,
      flag,
      lastSentCurrency: currency,
      lastSentAmount: 0,
    };
    setSelectedContact(adhoc);
    setReceiveCurrency(getPrimaryCurrency(flag));
    setContactQuery('');
    goToStep('amount');
  }, [primaryWallet, goToStep]);

  const handleSwapRecipient = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setContactQuery(selectedContact?.id.startsWith('adhoc-') ? selectedContact.phone : '');
    setSendRaw('0');
    setReceiveRaw('0');
    setActiveField('send');
    goToStep('recipient');
  }, [selectedContact, goToStep]);

  const recentContacts = MOCK_CONTACTS.slice(0, 4);

  // ══ Render ════════════════════════════════════════════════════════════════════
  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ flex: 1 }}>
        {/* Tracking screen background — only shown when revealing on "View transfer".
            All other dismiss paths let native modal transparency show wallets behind. */}
        {showSuccessBg && successBgParams && (
          <View style={StyleSheet.absoluteFill}>
            <SendSuccessContent params={successBgParams} animated={false} />
          </View>
        )}

        {/* Modal foreground — slides up on enter, slides down on View Transfer */}
        <Animated.View style={[{ flex: 1, overflow: 'hidden' }, dismissStyle]}>
          {/* Horizontal step row (recipient + amount) */}
          <Animated.View style={[{ flex: 1, flexDirection: 'row' as const, width: screenWidth * 2 }, stepRowAnim]}>
            <View style={{ width: screenWidth, flex: 1 }}>
              <View style={[styles.safe, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                  <Pressable
                    onPress={() => selectedContact ? goToStep('amount') : dismiss()}
                    style={styles.backBtn}
                  >
                    {selectedContact
                      ? <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
                      : <X size={22} color={colors.textPrimary} strokeWidth={2} />}
                  </Pressable>
                  <Text style={styles.title}>Send to</Text>
                  <View style={styles.backBtn} />
                </View>

                <View style={styles.searchWrap}>
                  <Search size={16} color={colors.textMuted} strokeWidth={2} />
                  <TextInput
                    style={styles.searchInput}
                    value={contactQuery}
                    onChangeText={setContactQuery}
                    placeholder="Name or phone number…"
                    placeholderTextColor={colors.textMuted}
                    autoFocus={false}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {contactQuery.length > 0 && (
                    <Pressable onPress={() => setContactQuery('')} hitSlop={8}>
                      <X size={14} color={colors.textMuted} strokeWidth={2} />
                    </Pressable>
                  )}
                </View>

                <ScrollView
                  contentContainerStyle={styles.contactScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {!contactQuery.trim() && (
                    <>
                      <Text style={styles.contactSectionLabel}>Recent</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.recentCirclesRow}
                      >
                        {recentContacts.map((c) => (
                          <RecentCircle
                            key={c.id}
                            contact={c}
                            onPress={() => handleSelectContact(c)}
                          />
                        ))}
                      </ScrollView>
                      <Text style={[styles.contactSectionLabel, { marginTop: spacing.xl }]}>
                        All contacts
                      </Text>
                    </>
                  )}

                  {/* Send to new phone number */}
                  {looksLikePhone(contactQuery) && (
                    <Pressable
                      onPress={() => handleSendToPhone(contactQuery)}
                      style={({ pressed }) => [styles.contactRow, pressed && { backgroundColor: colors.surfaceHigh }]}
                    >
                      <View style={[styles.contactAvatar, styles.phoneAvatar]}>
                        <Phone size={18} color={colors.brand} strokeWidth={1.8} />
                      </View>
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactName}>{contactQuery}</Text>
                        <Text style={styles.contactPhone}>Send to this number</Text>
                      </View>
                    </Pressable>
                  )}

                  {filteredContacts.length === 0 ? (
                    !looksLikePhone(contactQuery) && (
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🔎</Text>
                        <Text style={styles.emptyText}>No contacts found for "{contactQuery}"</Text>
                      </View>
                    )
                  ) : (
                    filteredContacts.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleSelectContact(item)}
                        style={({ pressed }) => [
                          styles.contactRow,
                          pressed && { backgroundColor: colors.surfaceHigh },
                        ]}
                      >
                        <View style={styles.contactAvatar}>
                          <Text style={styles.contactAvatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.contactInfo}>
                          <Text style={styles.contactName}>{item.name}</Text>
                          <Text style={styles.contactPhone}>{item.phone}</Text>
                        </View>
                        <View style={styles.contactLastSent}>
                          <Text style={styles.contactLastLabel}>Last sent</Text>
                          <Text style={styles.contactLastAmount}>
                            {formatAmount(item.lastSentAmount, item.lastSentCurrency)}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>

            <View style={{ width: screenWidth, flex: 1 }}>
              <View style={[styles.safe, { paddingTop: insets.top }]}>
                {/* ── Header ── */}
                <View style={styles.header}>
                  <Pressable onPress={dismiss} style={styles.backBtn}>
                    <X size={22} color={colors.textPrimary} strokeWidth={2} />
                  </Pressable>
                  <Text style={styles.title}>Send Money</Text>
                  <View style={styles.backBtn} />
                </View>

                {/* ── Scrollable content ── */}
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Recipient — always selected here, swap button to change */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>To</Text>
                    {selectedContact && (
                      <View style={styles.selectedRecipient}>
                        <View style={styles.recipientAvatarWrap}>
                          <Text style={styles.recipientAvatarFlag}>{selectedContact.flag}</Text>
                        </View>
                        <View style={styles.recipientInfo}>
                          <Text style={styles.recipientName}>{selectedContact.name}</Text>
                          <Text style={styles.recipientPhone}>{selectedContact.phone}</Text>
                        </View>
                        <Pressable
                          onPress={handleSwapRecipient}
                          hitSlop={10}
                          style={styles.swapRecipientBtn}
                        >
                          <ArrowLeftRight size={15} color={colors.textMuted} strokeWidth={1.8} />
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* You send */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>You send</Text>
                    <View style={[styles.amountRow, activeField === 'send' && styles.amountRowActive, !hasFunds && sendAmountNum > 0 && styles.amountRowError]}>
                      <Pressable
                        onPress={() => setShowWalletDropdown(true)}
                        style={({ pressed }) => [styles.currencyBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={styles.currencyBtnFlag}>{sendCurrency.flag}</Text>
                        <Text style={styles.currencyBtnCode}>{sendCurrency.code}</Text>
                        <ChevronDown size={12} color={colors.textSecondary} strokeWidth={2} />
                      </Pressable>

                      <View style={styles.amountDivider} />

                      <Pressable
                        style={styles.amountTouchArea}
                        onPress={() => handleActivateField('send')}
                      >
                        <Animated.Text
                          style={[
                            styles.amountText,
                            activeField !== 'send' && styles.amountTextComputed,
                            !hasFunds && sendAmountNum > 0 && styles.amountTextError,
                            amountStyle,
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {sendDisplayText}
                          <Text style={[styles.caretText, { color: activeField === 'send' ? caretColor : 'transparent' }]}>|</Text>
                        </Animated.Text>
                      </Pressable>
                    </View>
                    <Text style={[styles.fieldHint, !hasFunds && sendAmountNum > 0 && { color: colors.failed }]}>
                      {!hasFunds && sendAmountNum > 0
                        ? `Insufficient funds · Balance: ${formatAmount(sendWallet.balance, sendWallet.currency)}`
                        : `Balance: ${formatAmount(sendWallet.balance, sendWallet.currency)}`}
                    </Text>
                  </View>

                  {/* Rate indicator */}
                  <View style={styles.rateRow}>
                    {sendAmountNum > 0 ? (
                      <View style={styles.rateChip}>
                        <Text style={styles.rateChipText}>
                          1 {sendCurrency.code} = {rate.toFixed(4)} {receiveCurrency}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.exchangeArrow}>
                        <ArrowUpDown size={16} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                    )}
                  </View>

                  {/* They receive */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>They receive</Text>
                    <View style={[styles.amountRow, activeField === 'receive' && styles.amountRowActive]}>
                      <View style={[styles.currencyBtn, styles.currencyBtnLocked]}>
                        <Text style={styles.currencyBtnFlag}>{getCurrency(receiveCurrency).flag}</Text>
                        <Text style={styles.currencyBtnCode}>{receiveCurrency}</Text>
                      </View>

                      <View style={styles.amountDivider} />

                      <Pressable
                        style={styles.amountTouchArea}
                        onPress={() => handleActivateField('receive')}
                      >
                        <Text
                          style={[
                            styles.amountText,
                            activeField !== 'receive' && styles.amountTextComputed,
                          ]}
                          numberOfLines={1}
                        >
                          {receiveDisplayText}
                          <Text style={[styles.caretText, { color: activeField === 'receive' ? caretColor : 'transparent' }]}>|</Text>
                        </Text>
                      </Pressable>
                    </View>
                    {sendAmountNum > 0 && (
                      <Text style={styles.fieldHint}>
                        Fee: {formatAmount(fee, sendWallet.currency)}  ·  Total deducted: {formatAmount(total, sendWallet.currency)}
                      </Text>
                    )}
                  </View>
                </ScrollView>

                {/* ── Quick amounts ── */}
                <View style={styles.quickAmounts}>
                  {(activeField === 'send'
                    ? (QUICK_AMOUNTS[sendWallet.currency] ?? DEFAULT_QUICK_AMOUNTS)
                    : (QUICK_AMOUNTS[receiveCurrency]    ?? DEFAULT_QUICK_AMOUNTS)
                  ).map((amt) => {
                    const isSend = activeField === 'send';
                    const symbol = isSend ? sendCurrency.symbol : getCurrency(receiveCurrency).symbol;
                    const affordable = isSend
                      ? amt <= sendWallet.balance
                      : (amt / rate + getFee(amt / rate, sendWallet.currency)) <= sendWallet.balance;
                    const activeAmt = isSend ? parseFloat(sendRaw) : parseFloat(receiveRaw);
                    const isActive = activeAmt === amt;
                    return (
                      <Pressable
                        key={amt}
                        onPress={() => {
                          if (!affordable) return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          if (isSend) {
                            setSendRaw(String(amt));
                          } else {
                            setReceiveRaw(String(amt));
                          }
                        }}
                        style={[
                          styles.quickChip,
                          isActive && styles.quickChipActive,
                          !affordable && styles.quickChipDisabled,
                        ]}
                      >
                        <Text style={[
                          styles.quickChipText,
                          isActive && styles.quickChipTextActive,
                          !affordable && styles.quickChipTextDisabled,
                        ]}>
                          {symbol}{amt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* ── Numpad ── */}
                <View style={styles.numpad}>
                  {KEYS.map((k) => (
                    <NumKey key={k} label={k} onPress={() => handleKey(k)} style={styles.key} />
                  ))}
                </View>

                {/* ── CTA ── */}
                <View style={styles.footer}>
                  <PrimaryButton
                    onPress={handleReview}
                    disabled={!canReview}
                    style={styles.reviewBtn}
                  >
                    <Text style={styles.reviewBtnText}>Next</Text>
                  </PrimaryButton>
                </View>

                {/* ══ Wallet Dropdown Modal ══ */}
                <Modal visible={showWalletDropdown} transparent animationType="fade">
                  <Pressable style={styles.dropdownBackdrop} onPress={() => setShowWalletDropdown(false)}>
                    <Pressable style={styles.dropdownPanel} onPress={() => {}}>
                      <Text style={styles.dropdownTitle}>Select wallet</Text>
                      {wallets.map((w) => {
                        const cur = getCurrency(w.currency);
                        const active = w.id === sendWalletId;
                        const disabled = w.balance <= 0;
                        return (
                          <Pressable
                            key={w.id}
                            onPress={() => {
                              if (disabled) return;
                              setSendWalletId(w.id);
                              setShowWalletDropdown(false);
                              Haptics.selectionAsync();
                            }}
                            style={({ pressed }) => [
                              styles.dropdownRow,
                              active && styles.dropdownRowActive,
                              disabled && styles.dropdownRowDisabled,
                              pressed && !disabled && { backgroundColor: colors.surfaceHigh },
                            ]}
                          >
                            <View style={styles.dropdownRowLeft}>
                              <Text style={styles.dropdownFlag}>{cur.flag}</Text>
                              <View>
                                <Text style={[styles.dropdownCode, disabled && { color: colors.textMuted }]}>
                                  {cur.code}
                                </Text>
                                <Text style={styles.dropdownName}>{cur.name}</Text>
                              </View>
                            </View>
                            <View style={styles.dropdownRowRight}>
                              <Text style={[styles.dropdownBalance, disabled && { color: colors.textMuted }]}>
                                {disabled ? 'No funds' : formatAmount(w.balance, w.currency)}
                              </Text>
                              {active && !disabled && <Check size={16} color={colors.brand} strokeWidth={2.5} />}
                            </View>
                          </Pressable>
                        );
                      })}
                    </Pressable>
                  </Pressable>
                </Modal>
              </View>
            </View>
          </Animated.View>

          {/* Confirm step overlay — slides in from right */}
          <Animated.View style={[StyleSheet.absoluteFill, confirmSlideStyle]}>
            <View style={[styles.safe, { flex: 1, paddingTop: insets.top }]}>
              {/* Header */}
              <View style={styles.header}>
                <Pressable onPress={handleCloseConfirm} style={styles.backBtn} disabled={phase !== 'idle'}>
                  <ChevronLeft size={24} color={phase === 'idle' ? colors.textPrimary : 'transparent'} strokeWidth={2} />
                </Pressable>
                <Text style={styles.title}>Confirm transfer</Text>
                <View style={styles.backBtn} />
              </View>

              {/* ScrollView with confirmation breakdown */}
              <ScrollView contentContainerStyle={styles.confirmScroll} showsVerticalScrollIndicator={false} scrollEnabled={phase === 'idle' || phase === 'failed'}>
                {/* Hero — failed state replaces the amount display */}
                {phase === 'failed' || phase === 'retryReady' ? (
                  <View style={styles.failureBanner}>
                    <View style={styles.failureIconWrap}>
                      <X size={22} color={colors.failed} strokeWidth={2.5} />
                    </View>
                    <Text style={styles.failureTitle}>Transfer failed</Text>
                    <Text style={styles.failureSub}>No funds were deducted from your wallet.</Text>
                  </View>
                ) : (
                  <View style={styles.confirmHero}>
                    <Text style={styles.confirmHeroFlag}>{selectedContact?.flag}</Text>
                    <Text style={styles.confirmHeroLabel}>{selectedContact?.name.split(' ')[0]} receives</Text>
                    <View style={styles.confirmHeroAmountRow}>
                      <Text style={styles.confirmHeroAmount}>{getCurrency(receiveCurrency).symbol}{convertedFormatted}</Text>
                      <Text style={styles.confirmHeroAmountCode}>{receiveCurrency}</Text>
                    </View>
                    <View style={styles.etaChip}>
                      <Zap size={12} color={colors.success} strokeWidth={2.5} />
                      <Text style={styles.etaText}>{eta}</Text>
                    </View>
                  </View>
                )}

                {/* Recipient card */}
                <View style={styles.card}>
                  <View style={styles.recipientRow}>
                    <View style={styles.confirmRecipientAvatar}>
                      <Text style={styles.confirmRecipientFlag}>{selectedContact?.flag}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.confirmRecipientName}>{selectedContact?.name}</Text>
                      <Text style={styles.confirmRecipientPhone}>{selectedContact?.phone}</Text>
                    </View>
                  </View>
                </View>

                {/* Breakdown card */}
                <View style={styles.card}>
                  <Row label="From wallet" value={`${sendCurrency.flag}  ${sendCurrency.code}`} />
                  <View style={styles.divider} />
                  <Row label="You send" value={formatAmount(sendAmountNum, sendWallet.currency)} />
                  <View style={styles.divider} />
                  <Row label="Transfer fee" value={formatAmount(fee, sendWallet.currency)} />
                  <View style={styles.totalDivider} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total deducted</Text>
                    <Text style={styles.totalValue}>{formatAmount(total, sendWallet.currency)}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.rateFootnote}>
                    <Text style={styles.rateFootnoteText}>1 {sendCurrency.code} = {rate.toFixed(4)} {receiveCurrency}</Text>
                  </View>
                </View>

                {/* Edit link */}
                <Pressable onPress={handleCloseConfirm} disabled={phase !== 'idle'} style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }, phase !== 'idle' && { opacity: 0 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pen size={13} color={colors.textSecondary} strokeWidth={2} />
                    <Text style={styles.editBtnText}>Edit transfer</Text>
                  </View>
                </Pressable>

                {/* Prototype settings — only visible before a transfer attempt */}
                {phase === 'idle' && (
                  <View style={styles.protoWrap}>
                    <Text style={styles.protoTitle}>⚙  Prototype</Text>
                    <SegControl<Outcome> label="Outcome" value={protoOutcome} onChange={setProtoOutcome}
                      options={[{ label: 'Success', value: 'success' }, { label: 'Failure', value: 'failure' }]} />
                    <SegControl<string> label="Delay" value={String(protoDelay)} onChange={(v) => setProtoDelay(Number(v))}
                      options={[{ label: '0.5s', value: '500' }, { label: '1s', value: '1000' }, { label: '2s', value: '2000' }, { label: '3s', value: '3000' }]} />
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.confirmFooter}>
                <MorphButton phase={phase} onConfirm={handleConfirm} onViewTransfer={handleViewTransfer} onRetry={() => setPhase('idle')} total={total} currency={sendWallet.currency} />
                <Pressable
                  onPress={phase === 'success' || phase === 'viewTransfer' || phase === 'failed' || phase === 'retryReady' ? handleCloseToWallets : handleCloseConfirm}
                  disabled={phase === 'processing'}
                  style={[styles.closeBtn, phase === 'processing' && styles.closeBtnDisabled]}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs },

  // Field groups
  fieldGroup: { marginBottom: spacing.sm },
  fieldLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  fieldHint: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    paddingHorizontal: 2,
  },

  // Recipient
  selectedRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 56,
  },
  recipientAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientAvatarFlag: { fontSize: 18 },
  recipientInfo: { flex: 1 },
  recipientName: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  recipientPhone: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 1 },
  swapRecipientBtn: { padding: spacing.xs },

  // Amount rows
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    height: 64,
    overflow: 'hidden',
  },
  amountRowActive: { borderColor: colors.brand },
  amountRowError: { borderColor: colors.failed, backgroundColor: colors.failedSubtle },

  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    height: '100%',
    minWidth: 96,
  },
  currencyBtnLocked: { opacity: 1 },
  currencyBtnFlag: { fontSize: 20 },
  currencyBtnCode: { fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.bold },

  amountDivider: { width: 1, height: '55%', backgroundColor: colors.border },

  amountTouchArea: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  amountText: {
    fontSize: 30,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    letterSpacing: -1,
    textAlign: 'right',
  },
  amountTextComputed: { color: colors.textSecondary },
  amountTextError: { color: colors.failed },
  caretText: {
    fontSize: 30,
    color: colors.brand,
    fontWeight: typography.regular,
  },

  // Rate row
  rateRow: { alignItems: 'center', marginVertical: spacing.xs },
  exchangeArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateChipText: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium },

  // Quick amounts
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  quickChipDisabled: {
    opacity: 0.35,
  },
  quickChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
  },
  quickChipTextActive: {
    color: colors.bg,
  },
  quickChipTextDisabled: {
    color: colors.textMuted,
  },

  // Numpad
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
  },
  key: {
    width: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  keyText: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },

  // Footer CTA
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.sm,
  },
  reviewBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  reviewBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },

  // ── Contact picker (step 1) ──
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: typography.base },

  contactScrollContent: {
    paddingBottom: spacing.xxxl,
  },
  contactSectionLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },

  // Recent circles
  recentCirclesRow: { gap: spacing.lg, paddingBottom: spacing.sm, paddingHorizontal: spacing.xl },
  recentCircleWrap: { alignItems: 'center', width: 64 },
  recentCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  recentCircleInitial: { fontSize: typography.lg, color: colors.textSecondary, fontWeight: typography.semibold },
  recentCircleName: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    textAlign: 'center',
  },

  // Contact rows
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarInitial: { fontSize: typography.lg, color: colors.textSecondary, fontWeight: typography.semibold },
  phoneAvatar: { backgroundColor: colors.brandSubtle, borderColor: colors.brandLight },
  contactInfo: { flex: 1 },
  contactName: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  contactPhone: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  contactLastSent: { alignItems: 'flex-end' },
  contactLastLabel: { fontSize: typography.xs, color: colors.textMuted },
  contactLastAmount: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    marginTop: 2,
  },

  emptyState: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.md },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center' },

  // ── Wallet dropdown modal ──
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  dropdownPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dropdownTitle: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  dropdownRowActive: { backgroundColor: colors.brandSubtle },
  dropdownRowDisabled: { opacity: 0.45 },
  dropdownRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dropdownFlag: { fontSize: 24 },
  dropdownCode: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  dropdownName: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  dropdownRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dropdownBalance: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },

  // ── Confirm step ──
  confirmScroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  confirmHero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  confirmHeroFlag: { fontSize: 48, marginBottom: spacing.xs },
  confirmHeroLabel: { fontSize: typography.sm, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, fontWeight: typography.semibold },
  confirmHeroAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  confirmHeroAmount: { fontSize: typography.hero, color: colors.textPrimary, fontWeight: typography.bold, letterSpacing: -2 },
  confirmHeroAmountCode: { fontSize: typography.lg, color: colors.textSecondary, fontWeight: typography.semibold, paddingBottom: 6 },
  etaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successSubtle, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: colors.success, marginTop: spacing.sm },
  etaText: { fontSize: typography.xs, color: colors.success, fontWeight: typography.semibold },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  confirmRecipientAvatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  confirmRecipientFlag: { fontSize: 24 },
  confirmRecipientName: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },
  confirmRecipientPhone: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
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
  confirmFooter: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm, gap: spacing.xs },
  closeBtn: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  closeBtnDisabled: { opacity: 0.35 },
  closeBtnText: { fontSize: typography.base, color: colors.textSecondary, fontWeight: typography.medium },
  failureBanner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  failureIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.failedSubtle,
    borderWidth: 1,
    borderColor: colors.failed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  failureTitle: { fontSize: typography.xl, color: colors.textPrimary, fontWeight: typography.bold },
  failureSub: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center' },
});
