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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
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
  interpolateColor,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronDown, Search, X, ArrowUpDown, Check, Phone, RefreshCw, ScanLine, Info } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import FlatButton from '../../components/FlatButton';
import BottomSheet from '../../components/BottomSheet';
import FlagIcon from '../../components/FlagIcon';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { MOCK_CONTACTS } from '../../data/mockData';
import { getRate, getFee } from '../../data/exchangeRates';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Contact } from '../../stores/types';
import { getInitials } from '../../utils/strings';
import { usePendingTransferStore } from '../../stores/usePendingTransferStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

const PRIMARY_CURRENCY_BY_ISO: Record<string, string> = {
  MX: 'MXN',
  US: 'USD',
  PH: 'PHP',
  IN: 'INR',
  NG: 'NGN',
  GB: 'GBP',
  EU: 'EUR',
  GT: 'GTQ',
  HN: 'HNL',
  DO: 'DOP',
  CO: 'COP',
  MA: 'MAD',
};

// Currencies a recipient in each country can receive, primary-first
const RECEIVE_CURRENCIES_BY_ISO: Record<string, string[]> = {
  MX: ['MXN', 'USD'],
  US: ['USD'],
  PH: ['PHP', 'USD'],
  IN: ['INR', 'USD'],
  NG: ['NGN', 'USD'],
  GB: ['GBP', 'EUR', 'USD'],
  EU: ['EUR', 'GBP', 'USD'],
  GT: ['GTQ', 'USD'],
  HN: ['HNL', 'USD'],
  DO: ['DOP', 'USD'],
  CO: ['COP', 'USD'],
  MA: ['MAD', 'EUR'],
};

function getPrimaryCurrency(flag: string): string {
  return PRIMARY_CURRENCY_BY_ISO[flag] ?? 'USD';
}

function getCurrencyFlag(code: string): string | undefined {
  return Object.entries(PRIMARY_CURRENCY_BY_ISO).find(([, c]) => c === code)?.[0];
}

function getReceiveCurrencies(flag: string): string[] {
  return RECEIVE_CURRENCIES_BY_ISO[flag] ?? ['USD'];
}

// Returns true when the query has enough digits to be treated as a phone number
function looksLikePhone(q: string): boolean {
  return q.replace(/\D/g, '').length >= 4;
}

// Sanitize free-form decimal input: one '.', max 2 decimal places, max 8 integer digits, no leading zeros
function sanitizeAmount(text: string): string {
  let s = text.replace(/[^0-9.]/g, '');
  const dotIdx = s.indexOf('.');
  if (dotIdx !== -1) {
    s = s.slice(0, dotIdx + 1) + s.slice(dotIdx + 1).replace(/\./g, '');
    const dec = s.split('.')[1] ?? '';
    if (dec.length > 2) s = s.slice(0, dotIdx + 3);
  }
  const intPart = s.split('.')[0];
  if (intPart.length > 8) s = intPart.slice(0, 8) + (s.includes('.') ? s.slice(s.indexOf('.')) : '');
  if (s.length > 1 && s[0] === '0' && s[1] !== '.') s = s.slice(1);
  // Reject a standalone '0' — the field can't meaningfully hold just zero.
  // '0.XX' is preserved because the leading-zero strip above only fires when s[1] is not '.'.
  if (s === '0') s = '';
  return s;
}

// Dynamic TextInput maxLength so native input refuses chars that would exceed the 8-int/2-decimal limits —
// avoids the flash from native-accept then sanitize-reject on ios.
function maxLengthFor(raw: string): number {
  const dotIdx = raw.indexOf('.');
  if (dotIdx === -1) {
    // no dot yet: allow up to 8 int digits, plus room for '.' + 2 decimals
    return raw.length >= 8 ? raw.length + 3 : 11;
  }
  const decLen = raw.length - dotIdx - 1;
  return decLen >= 2 ? raw.length : raw.length + (2 - decLen);
}

const CALLING_CODE_BY_CURRENCY: Record<string, string> = {
  USD: '+1', MXN: '+52', PHP: '+63', INR: '+91', NGN: '+234',
  GBP: '+44', EUR: '+49', GTQ: '+502', HNL: '+504', DOP: '+1',
  COP: '+57', MAD: '+212',
};

// Best-effort country detection from international prefix. Returns null if unknown.
function detectFromPhone(phone: string): { flag: string; currency: string } | null {
  if (phone.startsWith('+52'))  return { flag: 'MX', currency: 'MXN' };
  if (phone.startsWith('+63'))  return { flag: 'PH', currency: 'PHP' };
  if (phone.startsWith('+91'))  return { flag: 'IN', currency: 'INR' };
  if (phone.startsWith('+234')) return { flag: 'NG', currency: 'NGN' };
  if (phone.startsWith('+44'))  return { flag: 'GB', currency: 'GBP' };
  if (phone.startsWith('+502')) return { flag: 'GT', currency: 'GTQ' };
  if (phone.startsWith('+504')) return { flag: 'HN', currency: 'HNL' };
  if (phone.startsWith('+57'))  return { flag: 'CO', currency: 'COP' };
  if (phone.startsWith('+212')) return { flag: 'MA', currency: 'MAD' };
  if (phone.startsWith('+1'))   return { flag: 'US', currency: 'USD' };
  return null;
}

// ─── Recent contact circle ────────────────────────────────────────────────────

function RecentCircle({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.recentCircleWrap, pressed && { opacity: 0.7 }]}
    >
      <Avatar name={contact.name} size="xl" style={{ marginBottom: spacing.xs }} />
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

// ─── Drum / slot-machine quick-amount chip ────────────────────────────────────

function DrumChip({ label, isActive, isDisabled, onPress, index, animKey }: {
  label: string;
  isActive: boolean;
  isDisabled: boolean;
  onPress: () => void;
  index: number;
  animKey: string;
}) {
  // flip: 0 = at rest, 0→1 = exiting upward, -1→0 = entering from below
  // translateY = -flip * 10,  opacity = 1 - |flip|
  const flip = useSharedValue(0);
  const activeProgress = useSharedValue(isActive ? 1 : 0);
  const [displayLabel, setDisplayLabel] = useState(label);
  const mounted = useRef(false);
  const prevAnimKey = useRef(animKey);

  useEffect(() => {
    const isFlip = prevAnimKey.current !== animKey;
    prevAnimKey.current = animKey;
    if (!mounted.current) { mounted.current = true; return; }

    const nextLabel = label;

    if (isFlip) {
      const delay = index * 40;
      flip.value = withDelay(delay, withTiming(1, { duration: 80, easing: Easing.in(Easing.quad) }, (done) => {
        'worklet';
        if (!done) return;
        runOnJS(setDisplayLabel)(nextLabel);
        flip.value = -1;
        flip.value = withTiming(0, { duration: 100, easing: Easing.out(Easing.quad) });
      }));
      activeProgress.value = withDelay(delay, withTiming(isActive ? 1 : 0, { duration: 80 }));
    } else {
      setDisplayLabel(nextLabel);
      activeProgress.value = withTiming(isActive ? 1 : 0, { duration: 100 });
    }
  }, [animKey, isActive, label]); // eslint-disable-line react-hooks/exhaustive-deps

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(activeProgress.value, [0, 1], [colors.surface, colors.textPrimary]),
    borderColor: interpolateColor(activeProgress.value, [0, 1], [colors.border, colors.textPrimary]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -flip.value * 10 }],
    opacity: flip.value >= 0 ? 1 - flip.value : 1 + flip.value,
    color: interpolateColor(activeProgress.value, [0, 1], [colors.textSecondary, colors.bg]),
  }));

  return (
    <Animated.View style={[styles.quickChip, isDisabled && styles.quickChipDisabled, chipStyle]}>
      <Animated.Text style={[styles.quickChipText, textStyle]}>
        {displayLabel}
      </Animated.Text>
      <Pressable onPress={onPress} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SendMoneyScreen({ route }: RootStackProps<'SendMoney'>) {
  const navigation = useNavigation<Nav>();
  const { wallets } = useWalletStore();
  const setPending = usePendingTransferStore((s) => s.setPending);


  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  const prefillContact = route.params?.contactName
    ? MOCK_CONTACTS.find((c) => c.name === route.params.contactName) ?? null
    : null;
  const prefillAmount = route.params?.prefillSendAmount;

  const [sendWalletId, setSendWalletId] = useState(route.params?.walletId ?? primaryWallet.id);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(prefillContact);
  const [receiveCurrency, setReceiveCurrency] = useState(
    prefillContact ? getPrimaryCurrency(prefillContact.flag) : 'MXN',
  );

  const [step, setStep] = useState<'recipient' | 'amount'>(prefillContact ? 'amount' : 'recipient');

  // Dual-field editing
  const [activeField, setActiveField] = useState<'send' | 'receive'>('send');
  const [sendRaw, setSendRaw] = useState(
    prefillContact && prefillAmount && prefillAmount > 0 ? prefillAmount.toFixed(2) : '',
  );
  const [receiveRaw, setReceiveRaw] = useState('');

  const sendInputRef = useRef<TextInput>(null);
  const receiveInputRef = useRef<TextInput>(null);

  // Always-fresh refs so focus handlers never read stale closure values
  const sendRawRef = useRef(sendRaw);
  sendRawRef.current = sendRaw;
  const receiveRawRef = useRef(receiveRaw);
  receiveRawRef.current = receiveRaw;

  // Did the user actually type in the receive field (vs it being auto-computed)?
  const receiveUserEditedRef = useRef(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showReceiveDropdown, setShowReceiveDropdown] = useState(false);
  const [contactQuery, setContactQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showFeeSheet, setShowFeeSheet] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  const receiveCurrencies = useMemo(
    () => (selectedContact ? getReceiveCurrencies(selectedContact.flag) : ['USD']),
    [selectedContact],
  );

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
  // Half-cent tolerance — FX round-trips can overshoot balance by < $0.01, which would otherwise show "over by $0.00"
  const hasFunds = total <= sendWallet.balance + 0.005;
  const maxSendable = Math.max(0, sendWallet.balance - getFee(sendWallet.balance, sendWallet.currency));
  const canReview = sendAmountNum > 0 && hasFunds && selectedContact !== null;

  const sendDisplayText =
    activeField === 'send'
      ? sendRaw
      : sendAmountNum > 0
      ? sendAmountNum.toFixed(2)
      : '';

  const receiveDisplayText =
    activeField === 'receive'
      ? receiveRaw
      : receiveAmountNum > 0
      ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(receiveAmountNum)
      : '';

  useEffect(() => {
    if (!selectedContact) return;
    setReceiveCurrency(getPrimaryCurrency(selectedContact.flag));
  }, [selectedContact]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entry + dismiss animations ──
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  const dismissX = useSharedValue(0);

  useEffect(() => {
    if (step === 'amount') {
      const t = setTimeout(() => sendInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [step]);
  const finishDismiss = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    dismissX.value = withTiming(
      screenWidth,
      { duration: 300, easing: Easing.in(Easing.cubic) },
      (done) => { if (done) runOnJS(finishDismiss)(); }
    );
  }, [dismissX, screenWidth, finishDismiss]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [dismiss]);

  const panGesture = useMemo(() =>
    Gesture.Pan()
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
  [dismissX, screenWidth, finishDismiss]
  );
  const stepX = useSharedValue(prefillContact ? -screenWidth : 0);
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

  // Shake + haptic as soon as the user types past their balance
  const prevHasFundsRef = useRef(true);
  useEffect(() => {
    if (prevHasFundsRef.current && !hasFunds && sendAmountNum > 0) {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    prevHasFundsRef.current = hasFunds;
  }, [hasFunds, sendAmountNum, shake]);

  // ── Amount input handlers ──
  const handleSendChange = useCallback((text: string) => {
    const sanitized = sanitizeAmount(text);
    // Flush native first so the rejected char never has a chance to render.
    // Unconditional call because React bails out when sanitized === previous sendRaw,
    // and we can't rely on value prop reconciling back to native in that case.
    if (sanitized !== text) {
      sendInputRef.current?.setNativeProps({ text: sanitized, selection: { start: sanitized.length, end: sanitized.length } });
    }
    setSendRaw(sanitized);
    setActiveField('send');
  }, []);

  const handleReceiveChange = useCallback((text: string) => {
    const sanitized = sanitizeAmount(text);
    if (sanitized !== text) {
      receiveInputRef.current?.setNativeProps({ text: sanitized, selection: { start: sanitized.length, end: sanitized.length } });
    }
    setReceiveRaw(sanitized);
    setActiveField('receive');
    receiveUserEditedRef.current = true;
  }, []);

  const handleSendFocus = useCallback(() => {
    if (activeField === 'receive') {
      // Only recompute send if the user actually typed in receive; otherwise keep whatever they typed
      if (receiveUserEditedRef.current) {
        const computed = (parseFloat(receiveRawRef.current) || 0) / rate;
        if (computed > 0) setSendRaw(computed.toFixed(2));
        else setSendRaw('');
      }
      receiveUserEditedRef.current = false;
    }
    setActiveField('send');
    setTimeout(() => sendInputRef.current?.setNativeProps({ selection: { start: 999, end: 999 } }), 0);
  }, [activeField, rate]);

  const handleReceiveFocus = useCallback(() => {
    if (activeField === 'send') {
      const computed = (parseFloat(sendRawRef.current) || 0) * rate;
      if (computed > 0) setReceiveRaw(computed.toFixed(2));
      else setReceiveRaw('');
      receiveUserEditedRef.current = false;
    }
    setActiveField('receive');
    setTimeout(() => receiveInputRef.current?.setNativeProps({ selection: { start: 999, end: 999 } }), 0);
  }, [activeField, rate]);

  const handleSendBlur = useCallback(() => {
    const val = parseFloat(sendRawRef.current) || 0;
    if (val > 0) setSendRaw(val.toFixed(2));
  }, []);

  const handleReceiveBlur = useCallback(() => {
    const val = parseFloat(receiveRawRef.current) || 0;
    if (val > 0) setReceiveRaw(val.toFixed(2));
  }, []);

  // ── Review ──
  const handleReview = useCallback(() => {
    if (!selectedContact) return;
    if (sendAmountNum <= 0 || !hasFunds) {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPending({ contact: selectedContact, sendWalletId, sendAmount: sendAmountNum, receiveCurrency });
    navigation.navigate('ConfirmTransfer');
  }, [selectedContact, sendAmountNum, hasFunds, shake, setPending, sendWalletId, receiveCurrency, navigation]);

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

  const handleOpenScanner = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }
    scanLock.current = false;
    setScannerOpen(true);
  }, [cameraPermission, requestCameraPermission]);

  const handleBarcodeScan = useCallback(({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScannerOpen(false);
    try {
      const url = new URL(data);
      if (url.protocol !== 'ria:') return;
      const p = url.searchParams;
      const name = p.get('name') ?? '';
      const phone = p.get('phone') ?? '';
      const flag = p.get('currency') ? (getCurrencyFlag(p.get('currency')!) ?? 'US') : 'US';
      const scanned: Contact = {
        id: `qr-${phone}`,
        name: name || phone,
        phone,
        flag,
        lastSentCurrency: p.get('currency') ?? 'USD',
        lastSentAmount: 0,
      };
      handleSelectContact(scanned);
      const prefill = parseFloat(p.get('amount') ?? '');
      if (prefill > 0) {
        setReceiveCurrency(p.get('currency') ?? getPrimaryCurrency(flag));
        setActiveField('receive');
        setReceiveRaw(prefill.toFixed(2));
      }
    } catch {
      // not a valid ria:// URI — ignore
    }
  }, [handleSelectContact]);

  const recentContacts = MOCK_CONTACTS.slice(0, 4);

  // ══ Render ════════════════════════════════════════════════════════════════════
  return (
    <>
    <GestureDetector gesture={panGesture}>
      <View style={{ flex: 1 }}>

        {/* Modal foreground — slides up on enter, slides down on View Transfer */}
        <View style={{ flex: 1, overflow: 'hidden' }}>
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

                <View style={styles.searchRow}>
                  <View style={[styles.searchWrap, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
                    <Search size={16} color={colors.textMuted} strokeWidth={2} />
                    <TextInput
                      style={styles.searchInput}
                      value={contactQuery}
                      onChangeText={setContactQuery}
                      placeholder="Name or phone number…"
                      placeholderTextColor={colors.textMuted}
                      keyboardAppearance="light"
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
                  <Pressable onPress={handleOpenScanner} style={styles.scanBtn}>
                    <ScanLine size={20} color={colors.textPrimary} strokeWidth={1.8} />
                  </Pressable>
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
                      <EmptyState
                        compact
                        illustration={<Search size={36} color={colors.textMuted} strokeWidth={1.5} />}
                        title={`No contacts found for "${contactQuery}"`}
                      />
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
                        <Avatar name={item.name} size="md" />
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
              <View style={[styles.safe, { paddingTop: insets.top, flex: 1 }]}>
                {/* ── Header ── */}
                <View style={styles.header}>
                  <Pressable onPress={dismiss} style={styles.backBtn}>
                    <X size={22} color={colors.textPrimary} strokeWidth={2} />
                  </Pressable>
                  <Text style={styles.title}>Send Money</Text>
                  <View style={styles.backBtn} />
                </View>

                {/* ── Scrollable content + sticky bottom ── */}
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={{ flex: 1 }}
                >
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Recipient — compact inline display */}
                  {selectedContact && (
                    <View style={[styles.selectedRecipient, { marginBottom: spacing.md }]}>
                      <Avatar name={selectedContact.name} size="sm" />
                      <Text style={styles.recipientName}>{selectedContact.name}</Text>
                      <Pressable onPress={handleSwapRecipient} hitSlop={6} style={styles.headerChangeBtn}>
                        <RefreshCw size={11} color={colors.textSecondary} strokeWidth={2.5} />
                        <Text style={styles.headerChangeBtnLabel}>Change</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Combined exchange card */}
                  <View style={styles.exchangeCard}>
                    {/* You send */}
                    <Pressable onPress={() => { sendInputRef.current?.focus(); setTimeout(() => sendInputRef.current?.setNativeProps({ selection: { start: 999, end: 999 } }), 0); }} style={[styles.exchangeSection, activeField === 'send' && styles.exchangeSectionActive]}>
                      <View style={styles.exchangeLabelRow}>
                        <Text style={styles.fieldLabel}>You send</Text>
                        <Text style={styles.fieldHint}>
                          Balance: {formatAmount(sendWallet.balance, sendWallet.currency)}
                        </Text>
                      </View>
                      <View style={styles.exchangeInputRow}>
                        <Pressable
                          onPress={() => setShowWalletDropdown(true)}
                          style={({ pressed }) => [styles.currencyBtn, pressed && { opacity: 0.7 }]}
                        >
                          <FlagIcon code={sendCurrency.flag} size={20} />
                          <Text style={styles.currencyBtnCode}>{sendCurrency.code}</Text>
                          <ChevronDown size={12} color={colors.textSecondary} strokeWidth={2} />
                        </Pressable>
                        <View style={styles.amountDivider} onStartShouldSetResponder={() => true} />
                        <Animated.View style={[styles.exchangeInputWrap, amountStyle]}>
                          <TextInput
                            ref={sendInputRef}
                            style={[styles.exchangeInput, activeField !== 'send' && styles.amountInputInactive, !hasFunds && sendAmountNum > 0 && styles.amountInputError]}
                            value={sendDisplayText}
                            onChangeText={handleSendChange}
                            onFocus={handleSendFocus}
                            onBlur={handleSendBlur}
                            onSelectionChange={() => sendInputRef.current?.setNativeProps({ selection: { start: 999, end: 999 } })}
                            keyboardType="decimal-pad"
                            keyboardAppearance="light"
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            textAlign="right"
                            maxLength={maxLengthFor(sendRaw)}
                          />
                        </Animated.View>
                      </View>
                    </Pressable>

                    {/* Floating rate badge — straddles both sections */}
                    <View style={styles.exchangeBadgeZone} onStartShouldSetResponder={() => true}>
                      <View style={styles.exchangeBadgeHairline} />
                      <View style={styles.exchangeRateBadge}>
                        <ArrowUpDown size={11} color={colors.textMuted} strokeWidth={2} />
                        <Text style={styles.exchangeRateBadgeText}>
                          1 {sendCurrency.code} = {rate.toFixed(4)} {receiveCurrency}
                        </Text>
                      </View>
                    </View>

                    {/* They receive */}
                    <Pressable onPress={() => { receiveInputRef.current?.focus(); setTimeout(() => receiveInputRef.current?.setNativeProps({ selection: { start: 999, end: 999 } }), 0); }} style={[styles.exchangeSection, { paddingTop: spacing.md, paddingBottom: spacing.sm }, activeField === 'receive' && styles.exchangeSectionActive]}>
                      <View style={styles.exchangeLabelRow}>
                        <Text style={styles.fieldLabel}>They receive</Text>
                      </View>
                      <View style={styles.exchangeInputRow}>
                        <Pressable
                          onPress={() => setShowReceiveDropdown(true)}
                          style={({ pressed }) => [styles.currencyBtn, pressed && { opacity: 0.7 }]}
                        >
                          <FlagIcon code={getCurrency(receiveCurrency).flag} size={20} />
                          <Text style={styles.currencyBtnCode}>{receiveCurrency}</Text>
                          <ChevronDown size={12} color={colors.textSecondary} strokeWidth={2} />
                        </Pressable>
                        <View style={styles.amountDivider} onStartShouldSetResponder={() => true} />
                        <TextInput
                          ref={receiveInputRef}
                          style={[styles.exchangeInput, (activeField !== 'receive' || !(parseFloat(receiveRaw) > 0)) && styles.amountInputInactive]}
                          value={receiveDisplayText}
                          onChangeText={handleReceiveChange}
                          onFocus={handleReceiveFocus}
                          onBlur={handleReceiveBlur}
                          onSelectionChange={() => receiveInputRef.current?.setNativeProps({ selection: { start: 999, end: 999 } })}
                          keyboardType="decimal-pad"
                          keyboardAppearance="light"
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          textAlign="right"
                          maxLength={maxLengthFor(receiveRaw)}
                        />
                      </View>
                    </Pressable>
                  </View>
                  {/* ── Persistent fee breakdown ── */}
                  <View style={styles.feeSection}>
                    <View style={styles.feeLineRow}>
                      <View style={styles.feeLabelRow}>
                        <Text style={styles.feeLabel}>Fee</Text>
                        <Pressable
                          onPress={() => setShowFeeSheet(true)}
                          hitSlop={8}
                          style={styles.feeInfoBtn}
                        >
                          <Info size={12} color={colors.textMuted} />
                        </Pressable>
                      </View>
                      <Text style={styles.feeValue}>
                        {sendAmountNum > 0 ? formatAmount(fee, sendWallet.currency) : '—'}
                      </Text>
                    </View>
                    <View style={styles.feeDivider} />
                    <View style={styles.feeLineRow}>
                      <Text style={styles.feeTotalLabel}>Total</Text>
                      <Text style={styles.feeTotalValue}>
                        {sendAmountNum > 0 ? formatAmount(total, sendWallet.currency) : '—'}
                      </Text>
                    </View>
                    {!hasFunds && sendAmountNum > 0 && (
                      <Text style={styles.feeOverBy}>
                        Over by {formatAmount(total - sendWallet.balance, sendWallet.currency)}
                      </Text>
                    )}
                  </View>
                </ScrollView>

                  <View style={styles.quickAmounts}>
                    {(activeField === 'send'
                      ? (QUICK_AMOUNTS[sendWallet.currency] ?? DEFAULT_QUICK_AMOUNTS)
                      : (QUICK_AMOUNTS[receiveCurrency]    ?? DEFAULT_QUICK_AMOUNTS)
                    ).slice(0, 3).map((amt, i) => {
                      const isSend = activeField === 'send';
                      const symbol = isSend ? sendCurrency.symbol : getCurrency(receiveCurrency).symbol;
                      const affordable = isSend
                        ? amt <= sendWallet.balance
                        : (amt / rate + getFee(amt / rate, sendWallet.currency)) <= sendWallet.balance;
                      const activeAmt = isSend ? parseFloat(sendRaw) : parseFloat(receiveRaw);
                      const isActive = activeAmt === amt;
                      return (
                        <DrumChip
                          key={i}
                          index={i}
                          animKey={activeField}
                          label={`${symbol}${amt}`}
                          isActive={isActive}
                          isDisabled={!affordable}
                          onPress={() => {
                            if (!affordable) return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (isSend) {
                              setSendRaw(String(amt));
                              sendInputRef.current?.setNativeProps({ text: String(amt) });
                            } else {
                              setReceiveRaw(String(amt));
                              receiveInputRef.current?.setNativeProps({ text: String(amt) });
                              receiveUserEditedRef.current = true;
                            }
                          }}
                        />
                      );
                    })}
                    {(() => {
                      // Max always anchors on send side — receive is a derived display value.
                      // This keeps the debit exactly at maxSendable regardless of which field the user tapped from.
                      const maxTarget = Math.floor(maxSendable * 100) / 100;
                      // Use sendAmountNum (derived from the active field) so a new preset tap on receive clears the Max highlight
                      const isActive = maxTarget > 0 && Math.abs(sendAmountNum - maxTarget) < 0.005;
                      return (
                        <DrumChip
                          key="max"
                          index={3}
                          animKey={activeField}
                          label="Max"
                          isActive={isActive}
                          isDisabled={maxTarget <= 0}
                          onPress={() => {
                            if (maxTarget <= 0) return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const sendV = maxTarget.toFixed(2);
                            // Floor so the back-divide from receiveRaw never exceeds maxTarget
                            const receiveV = (Math.floor(maxTarget * rate * 100) / 100).toFixed(2);
                            setSendRaw(sendV);
                            setReceiveRaw(receiveV);
                            sendInputRef.current?.setNativeProps({ text: sendV });
                            receiveInputRef.current?.setNativeProps({ text: receiveV });
                            receiveUserEditedRef.current = false;
                          }}
                        />
                      );
                    })()}
                  </View>

                  <View style={[styles.footer, { paddingBottom: keyboardVisible ? 6 : insets.bottom + 6 }]}>
                    <PrimaryButton
                      label="Review"
                      onPress={handleReview}
                      disabled={!canReview}
                      style={styles.reviewBtn}
                    />
                  </View>
                </KeyboardAvoidingView>

                {/* ══ Wallet Dropdown Modal ══ */}
                <Modal visible={showWalletDropdown} transparent animationType="fade">
                  <Pressable style={styles.dropdownBackdrop} onPress={() => setShowWalletDropdown(false)}>
                    <Pressable style={styles.dropdownPanel} onPress={() => {}}>
                      <View style={styles.dropdownHandle} />
                      <Text style={styles.dropdownTitle}>Send from</Text>
                      {wallets.map((w, i) => {
                        const cur = getCurrency(w.currency);
                        const active = w.id === sendWalletId;
                        const disabled = w.balance <= 0;
                        const isLast = i === wallets.length - 1;
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
                              !isLast && styles.dropdownRowDivider,
                              active && styles.dropdownRowActive,
                              disabled && styles.dropdownRowDisabled,
                              pressed && !disabled && { opacity: 0.6 },
                            ]}
                          >
                            <View style={styles.dropdownRowLeft}>
                              <FlagIcon code={cur.flag} size={24} />
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
                              {active && !disabled && <Check size={16} color={colors.textPrimary} strokeWidth={2.5} />}
                            </View>
                          </Pressable>
                        );
                      })}
                      <View style={{ height: insets.bottom + 8 }} />
                    </Pressable>
                  </Pressable>
                </Modal>

                {/* ══ Receive Currency Dropdown Modal ══ */}
                <Modal visible={showReceiveDropdown} transparent animationType="fade">
                  <Pressable style={styles.dropdownBackdrop} onPress={() => setShowReceiveDropdown(false)}>
                    <Pressable style={styles.dropdownPanel} onPress={() => {}}>
                      <View style={styles.dropdownHandle} />
                      <Text style={styles.dropdownTitle}>Receive currency</Text>
                      <Text style={styles.dropdownHelper}>
                        {selectedContact?.name.split(' ')[0]} can only receive the following currencies
                      </Text>
                      {receiveCurrencies.map((code, i) => {
                        const cur = getCurrency(code);
                        const active = code === receiveCurrency;
                        const isLast = i === receiveCurrencies.length - 1;
                        return (
                          <Pressable
                            key={code}
                            onPress={() => {
                              setReceiveCurrency(code);
                              setShowReceiveDropdown(false);
                              Haptics.selectionAsync();
                            }}
                            style={({ pressed }) => [
                              styles.dropdownRow,
                              !isLast && styles.dropdownRowDivider,
                              active && styles.dropdownRowActive,
                              pressed && { opacity: 0.6 },
                            ]}
                          >
                            <View style={styles.dropdownRowLeft}>
                              <FlagIcon code={cur.flag} size={24} />
                              <View>
                                <Text style={styles.dropdownCode}>{cur.code}</Text>
                                <Text style={styles.dropdownName}>{cur.name}</Text>
                              </View>
                            </View>
                            <View style={styles.dropdownRowRight}>
                              {active && <Check size={16} color={colors.textPrimary} strokeWidth={2.5} />}
                            </View>
                          </Pressable>
                        );
                      })}
                      <View style={{ height: insets.bottom + 8 }} />
                    </Pressable>
                  </Pressable>
                </Modal>

                {/* ══ Fee Info Bottom Sheet ══ */}
                <BottomSheet visible={showFeeSheet} onClose={() => setShowFeeSheet(false)}>
                  <Text style={styles.feeSheetTitle}>Transfer fees</Text>
                  {(() => {
                    const cur = sendWallet.currency;
                    const sym = sendCurrency.symbol;
                    const fxRate = getRate('USD', cur) || 1;
                    const usdEquiv = sendAmountNum > 0 ? sendAmountNum / fxRate : 0;
                    const activeTier = usdEquiv <= 0 ? -1 : usdEquiv < 50 ? 0 : usdEquiv < 200 ? 1 : 2;

                    const t1 = Math.round(50 * fxRate);
                    const t2 = Math.round(200 * fxRate);
                    const fmt = (n: number) => n.toLocaleString('en-US');

                    const tiers = [
                      { range: `Under ${sym}${fmt(t1)}`, fee: formatAmount(1.99 * fxRate, cur) },
                      { range: `${sym}${fmt(t1)} – ${sym}${fmt(t2)}`, fee: formatAmount(2.99 * fxRate, cur) },
                      { range: `Over ${sym}${fmt(t2)}`, fee: `1% (max ${formatAmount(9.99 * fxRate, cur)})` },
                    ];

                    return (
                      <View style={styles.feeTierTable}>
                        {tiers.map((tier, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <View style={styles.feeTierDivider} />}
                            <View style={[styles.feeTierRow, activeTier === i && styles.feeTierRowActive]}>
                              <Text style={[styles.feeTierRange, activeTier === i && styles.feeTierTextActive]}>{tier.range}</Text>
                              <Text style={[styles.feeTierAmount, activeTier === i && styles.feeTierTextActive]}>{tier.fee}</Text>
                            </View>
                          </React.Fragment>
                        ))}
                      </View>
                    );
                  })()}
                  <SecondaryButton
                    label="Got it"
                    onPress={() => setShowFeeSheet(false)}
                    style={styles.feeSheetBtn}
                  />
                </BottomSheet>
              </View>
            </View>
          </Animated.View>

        </View>
      </View>
    </GestureDetector>

    {/* QR Scanner modal */}
    <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScan}
        />
        <View style={[styles.scannerOverlay, { paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <Pressable onPress={() => setScannerOpen(false)} style={styles.scannerClose}>
            <X size={24} color="#fff" strokeWidth={2} />
          </Pressable>
          <View style={styles.scannerReticle} />
          <Text style={styles.scannerHint}>Point at a Ria QR code</Text>
        </View>
      </View>
    </Modal>
    </>
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
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold, flexShrink: 1 },
  headerChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  headerChangeBtnLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: 2 },

  // Field groups
  fieldGroup: { marginBottom: 4 },
  fieldLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
    paddingHorizontal: 2,
  },

  selectedRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recipientName: { flex: 1, fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.semibold },

  // Exchange card
  exchangeCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  exchangeSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    zIndex: 0,
  },
  exchangeSectionActive: {},
  exchangeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  exchangeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  exchangeInputWrap: { flex: 1, alignSelf: 'stretch' },
  exchangeInput: {
    flex: 1,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: 0,
    fontSize: 26,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    letterSpacing: -0.5,
  },
  exchangeBadgeZone: {
    paddingLeft: spacing.md + 80, // section padding + currencyBtn minWidth = start at divider
    alignItems: 'center',
    marginVertical: -13,
    zIndex: 2,
  },
  exchangeBadgeHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  exchangeRateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    height: 26,
  },
  exchangeRateBadgeText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: '100%',
    minWidth: 80,
  },
  currencyBtnCode: { fontSize: typography.xs + 1, color: colors.textPrimary, fontWeight: typography.bold },

  amountDivider: { width: StyleSheet.hairlineWidth, height: '60%', backgroundColor: colors.border },

  amountInputInactive: { color: colors.textSecondary },
  amountInputError: { color: colors.failed },

  feeSection: {
    marginTop: spacing.md,
    paddingHorizontal: 2,
  },
  feeLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  feeValue: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  feeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  feeTotalLabel: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  feeTotalValue: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  feeOverBy: {
    fontSize: typography.xs,
    color: colors.failed,
    fontWeight: typography.medium,
    marginTop: 2,
    textAlign: 'right',
  },
  feeInfoBtn: {
    padding: 2,
  },
  feeSheetTitle: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  feeTierTable: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  feeTierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  feeTierDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  feeTierRange: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  feeTierAmount: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  feeTierRowActive: {
    backgroundColor: colors.surface,
  },
  feeTierTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  feeSheetBtn: {
    width: '100%',
    paddingVertical: spacing.lg,
  },

  // Quick amounts
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  quickChip: {
    flex: 1,          // fills the Animated.View wrapper
    alignItems: 'center',
    paddingVertical: 9,
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
    fontSize: typography.xs + 1,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
  },
  quickChipTextActive: {
    color: colors.bg,
  },
  quickChipTextDisabled: {
    color: colors.textMuted,
  },

  // Footer CTA
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  reviewBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  // ── Contact picker (step 1) ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: typography.base },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── QR Scanner ──
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  scannerClose: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerReticle: {
    width: 220,
    height: 220,
    borderRadius: radius.xl,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  scannerHint: {
    fontSize: typography.base,
    color: '#fff',
    fontWeight: typography.medium,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },

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
  contactAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const },
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


  // ── Wallet dropdown modal ──
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dropdownPanel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  dropdownHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dropdownTitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  dropdownHelper: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: 15,
  },
  dropdownRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownRowActive: { backgroundColor: colors.surface },
  dropdownRowDisabled: { opacity: 0.4 },
  dropdownRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dropdownFlag: {},
  dropdownCode: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  dropdownName: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  dropdownRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dropdownBalance: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.regular },

});
