import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronDown, Search, X, ArrowUpDown, ArrowLeftRight, Check, Delete, Phone } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import { MOCK_CONTACTS } from '../../data/mockData';
import { getRate, getFee } from '../../data/exchangeRates';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Contact } from '../../stores/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Primary receive currency per recipient country ───────────────────────────

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

function NumKey({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    scale.value = withSequence(withTiming(0.88, { duration: 60 }), withTiming(1, { duration: 100 }));
    onPress();
  };
  return (
    <Pressable onPress={handlePress} style={styles.key}>
      <Animated.View style={animStyle}>
        {label === '⌫'
          ? <Delete size={22} color={colors.textPrimary} strokeWidth={1.8} />
          : <Text style={styles.keyText}>{label}</Text>}
      </Animated.View>
    </Pressable>
  );
}

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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SendMoneyScreen({ route }: RootStackProps<'SendMoney'>) {
  const navigation = useNavigation<Nav>();
  const { wallets } = useWalletStore();

  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0];
  const [sendWalletId, setSendWalletId] = useState(route.params?.walletId ?? primaryWallet.id);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [receiveCurrency, setReceiveCurrency] = useState('MXN');

  // Step: recipient picker first, then amount entry
  const [step, setStep] = useState<'recipient' | 'amount'>('recipient');

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
  const stepX = useSharedValue(0);
  const goToStep = useCallback((s: 'recipient' | 'amount') => {
    setStep(s);
    stepX.value = withTiming(s === 'amount' ? -screenWidth : 0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [setStep, stepX, screenWidth]);
  const stepRow = { flex: 1, flexDirection: 'row' as const, width: screenWidth * 2 };
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
    navigation.navigate('Confirmation', {
      walletId: sendWalletId,
      contactId: selectedContact.id,
      amount: sendAmountNum,
      receiveCurrency,
    });
  }, [selectedContact, sendAmountNum, hasFunds, shake, navigation, sendWalletId, receiveCurrency]);

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
    setSelectedContact(contact);
    setReceiveCurrency(getPrimaryCurrency(contact.flag));
    setContactQuery('');
    goToStep('amount');
  }, [goToStep]);

  const handleSendToPhone = useCallback((phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Fall back to the primary wallet's country when no country code is present
    const detected = detectFromPhone(phone);
    const flag     = detected?.flag     ?? getCurrency(primaryWallet.currency).flag;
    const currency = detected?.currency ?? primaryWallet.currency;
    // Prepend local calling code and format digits if user didn't include one
    const callingCode = CALLING_CODE_BY_CURRENCY[primaryWallet.currency] ?? '';
    const formatDigits = (raw: string) => {
      const d = raw.replace(/\D/g, '');
      if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
      if (d.length === 11)  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
      // generic: groups of 3
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
    // Restore the phone number to the search bar so the user can edit it
    setContactQuery(selectedContact?.id.startsWith('adhoc-') ? selectedContact.phone : '');
    goToStep('recipient');
  }, [selectedContact, goToStep]);

  const recentContacts = MOCK_CONTACTS.slice(0, 4);

  // ─────────────────────────────────────────────────────────────────────────────

  // ══ Render ════════════════════════════════════════════════════════════════════
  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[{ flex: 1, overflow: 'hidden' }, dismissStyle]}>
        <Animated.View style={[stepRow, stepRowAnim]}>
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

      {/* ── Numpad ── */}
      <View style={styles.numpad}>
        {KEYS.map((k) => (
          <NumKey key={k} label={k} onPress={() => handleKey(k)} />
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
      </Animated.View>
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
});
