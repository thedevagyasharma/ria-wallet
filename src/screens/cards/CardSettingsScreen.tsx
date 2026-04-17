import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  Snowflake,
  Unlock,
  Trash2,
  CreditCard,
  Globe,
  Wallet as WalletIcon,
  Activity,
  Check,
  KeyRound,
  WifiOff,
  Nfc,
  Gauge,
  AlertTriangle,
} from 'lucide-react-native';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import DestructiveButton from '../../components/DestructiveButton';
import FlatButton from '../../components/FlatButton';
import BottomSheet from '../../components/BottomSheet';
import ConfirmSheet from '../../components/ConfirmSheet';
import { NumKey, NUM_KEYS_AMOUNT, NUM_KEYS_PIN } from '../../components/NumPad';

import { colors, typography, spacing, radius } from '../../theme';
import { useCardStore } from '../../stores/useCardStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency } from '../../data/currencies';
import FlagIcon from '../../components/FlagIcon';
import { CardFront, CARD_WIDTH, CARD_HEIGHT } from '../../components/CardFace';
import ViewPinSheet from '../../components/ViewPinSheet';
import type { RootStackProps } from '../../navigation/types';
import type { Card, CardType } from '../../stores/types';

const TYPE_LABELS: Record<CardType, string> = {
  physical: 'Physical card',
  virtual: 'Virtual card',
  'single-use': 'Single-use card',
};

// ─── View PIN sheet ────────────────────────────────────────────────────────────

// ─── Change PIN sheet ──────────────────────────────────────────────────────────

function ChangePinSheet({
  visible,
  currentPin,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  currentPin: string;
  onConfirm: (newPin: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0=verify current, 1=enter new, 2=confirm new
  const [pin0, setPin0] = useState('');
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const shakeX = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  useEffect(() => {
    if (!visible) { setStep(0); setPin0(''); setPin1(''); setPin2(''); }
  }, [visible]);

  function shake(then: () => void) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeX.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8,  { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6,  { duration: 60 }),
      withTiming(0,  { duration: 60 }),
    );
    setTimeout(then, 300);
  }

  function handleKey(key: string) {
    if (key === '⌫') {
      if (step === 0) setPin0((p) => p.slice(0, -1));
      else if (step === 1) setPin1((p) => p.slice(0, -1));
      else setPin2((p) => p.slice(0, -1));
      return;
    }
    const current = step === 0 ? pin0 : step === 1 ? pin1 : pin2;
    if (current.length >= 4) return;
    const next = current + key;

    if (step === 0) {
      setPin0(next);
      if (next.length === 4) {
        if (next === currentPin) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setTimeout(() => { setStep(1); setPin0(''); }, 120);
        } else {
          shake(() => setPin0(''));
        }
      }
    } else if (step === 1) {
      setPin1(next);
      if (next.length === 4) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => setStep(2), 120);
      }
    } else {
      setPin2(next);
      if (next.length === 4) {
        if (next === pin1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onConfirm(pin1);
        } else {
          shake(() => setPin2(''));
        }
      }
    }
  }

  const displayPin = step === 0 ? pin0 : step === 1 ? pin1 : pin2;

  const TITLES = ['Enter current PIN', 'Enter new PIN', 'Confirm new PIN'];
  const BODIES = [
    'Verify your identity before changing.',
    'Choose a new 4-digit PIN for this card.',
    'Re-enter your new PIN to confirm.',
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.sheetIconWrap, styles.sheetIconBrand]}>
        <KeyRound size={26} color={colors.brand} strokeWidth={1.8} />
      </View>
      <Text style={styles.sheetTitle}>{TITLES[step]}</Text>
      <Text style={styles.sheetBody}>{BODIES[step]}</Text>

      <Animated.View style={[styles.pinDotsRow, shakeStyle]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.pinDot, i < displayPin.length && styles.pinDotFilled]} />
        ))}
      </Animated.View>

      <View style={styles.numpad}>
        {NUM_KEYS_PIN.map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.numKey} />
          ) : (
            <NumKey key={k} label={k} onPress={() => handleKey(k)} style={styles.numKey} />
          )
        )}
      </View>

      <FlatButton onPress={onClose} label="Cancel" style={styles.sheetCancelBtn} />
    </BottomSheet>
  );
}

// ─── Spending limit sheet (single period) ─────────────────────────────────────

type LimitPeriod = 'daily' | 'weekly' | 'monthly';
const PERIOD_LABELS: Record<LimitPeriod, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const PERIOD_UNITS: Record<LimitPeriod, string> = { daily: '/day', weekly: '/week', monthly: '/month' };


function LimitSheet({
  visible,
  period,
  currentLimit,
  currencySymbol,
  onSave,
  onClose,
}: {
  visible: boolean;
  period: LimitPeriod;
  currentLimit: number | null;
  currencySymbol: string;
  onSave: (limit: number | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [localPeriod, setLocalPeriod] = useState<LimitPeriod>(period);
  const [localLimit, setLocalLimit] = useState<number | null>(currentLimit);

  useEffect(() => {
    if (visible) {
      setLocalPeriod(period);
      setLocalLimit(currentLimit);
      setValue(currentLimit != null ? String(currentLimit) : '');
    }
  }, [visible]);

  function handleKey(key: string) {
    if (key === '⌫') { setValue((v) => v.slice(0, -1)); return; }
    if (key === '.') {
      if (value.includes('.')) return;
      setValue((v) => (v === '' ? '0.' : v + '.'));
      return;
    }
    if (value === '0') { setValue(key); return; }
    const dotIdx = value.indexOf('.');
    if (dotIdx !== -1 && value.length - dotIdx > 2) return;
    if (value.replace('.', '').length >= 8) return;
    setValue((v) => v + key);
  }

  const parsed = parseFloat(value);
  const isValid = !isNaN(parsed) && parsed > 0;
  const displayValue = value === '' ? '0' : value;
  const isEmpty = value === '' || value === '0';

  return (
    <BottomSheet visible={visible} onClose={onClose} swipeToDismiss>
      <Text style={styles.sheetTitle}>{PERIOD_LABELS[localPeriod]} limit</Text>

      <View style={styles.limitAmountRow}>
        <Text style={[styles.limitSymbol, isEmpty && styles.limitMuted]}>{currencySymbol}</Text>
        <Text style={[styles.limitAmount, isEmpty && styles.limitMuted]}>{displayValue}</Text>
      </View>

      <View style={styles.numpad}>
        {NUM_KEYS_AMOUNT.map((k) => (
          <NumKey key={k} label={k} onPress={() => handleKey(k)} style={styles.limitNumKey} />
        ))}
      </View>

      <View style={styles.limitActions}>
        <PrimaryButton
          onPress={() => isValid && onSave(parsed)}
          disabled={!isValid}
          label={`Set ${PERIOD_LABELS[localPeriod].toLowerCase()} limit`}
          style={styles.limitSaveBtn}
        />
        {localLimit != null && (
          <SecondaryButton
            onPress={() => onSave(null)}
            label="Remove limit"
            style={styles.sheetOutlineBtn}
          />
        )}
        <FlatButton onPress={onClose} label="Cancel" style={styles.limitCancelBtn} />
      </View>
    </BottomSheet>
  );
}

// ─── Settings row ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  sublabel,
  value,
  onPress,
  isToggle,
  toggleValue,
  onToggle,
  toggleDisabled,
  destructive,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  isToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  toggleDisabled?: boolean;
  destructive?: boolean;
  isLast?: boolean;
}) {
  return (
    <>
      <Pressable
        onPress={isToggle ? undefined : onPress}
        disabled={isToggle}
        style={({ pressed }) => [
          styles.settingsRow,
          !isToggle && pressed && { opacity: 0.6 },
        ]}
      >
        <View style={styles.settingsRowLeft}>
          <View style={styles.settingsRowIcon}>{icon}</View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsRowLabel, destructive && styles.settingsRowDestructive]}>
              {label}
            </Text>
            {sublabel ? <Text style={styles.settingsRowSublabel}>{sublabel}</Text> : null}
          </View>
        </View>
        {isToggle ? (
          <Switch
            value={toggleValue}
            onValueChange={onToggle}
            disabled={toggleDisabled}
            trackColor={{ false: colors.border, true: colors.brand }}
            thumbColor="#fff"
          />
        ) : value !== undefined ? (
          <View style={styles.settingsRowRight}>
            <Text style={styles.settingsRowValue}>{value}</Text>
            <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
          </View>
        ) : !destructive ? (
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
        ) : null}
      </Pressable>
      {!isLast && <View style={styles.settingsRowDivider} />}
    </>
  );
}

// ─── Prototype seg control ────────────────────────────────────────────────────

function CardSegControl<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
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

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function CardSettingsScreen({ route }: RootStackProps<'CardSettings'>) {
  const navigation = useNavigation();
  const { cardId, scrollTo } = route.params;
  const {
    cards, toggleFreeze, removeCard,
    changePin, setOnlineTransactions, setContactless, setSpendingLimit,
    setExpired, setFreezeSimulateError,
  } = useCardStore();
  const { wallets } = useWalletStore();

  const [showRemove, setShowRemove] = useState(false);
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);
  const [showFreezeError, setShowFreezeError] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [editingLimit, setEditingLimit] = useState<LimitPeriod | null>(null);
  const [showLostStolen, setShowLostStolen] = useState(false);
  const [freezeProcessing, setFreezeProcessing] = useState(false);

  // Scroll coordination — deep-link from CardListScreen's "Edit limits"
  // lands here with scrollTo:'limits'. We measure the Spending section's Y
  // via onLayout and scroll once both the layout is known and the native push
  // transition has settled. One-shot: guarded so we don't re-scroll if the
  // user manually scrolls back up after landing.
  const scrollRef = useRef<ScrollView>(null);
  const [limitsY, setLimitsY] = useState<number | null>(null);
  const hasScrolledToLimits = useRef(false);

  const card = cards.find((c) => c.id === cardId);
  const wallet = wallets.find((w) => w.id === card?.walletId);
  const currency = wallet ? getCurrency(wallet.currency) : null;

  // Frost overlay — pulses during freeze/unfreeze processing
  const frostOpacity = useSharedValue(0);
  const frostScale = useSharedValue(1);
  const frostStyle = useAnimatedStyle(() => ({
    opacity: frostOpacity.value,
    transform: [{ scale: frostScale.value }],
  }));

  const handleFreezeConfirm = useCallback(() => {
    if (!card) return;
    setShowFreezeConfirm(false);
    setFreezeProcessing(true);
    Haptics.impactAsync(card.frozen ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);

    if (!card.frozen) {
      frostOpacity.value = withSequence(
        withTiming(0.28, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withDelay(200, withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }))
      );
      frostScale.value = withSequence(
        withTiming(1.015, { duration: 1400 }),
        withDelay(200, withTiming(1, { duration: 300 }))
      );
    } else {
      frostOpacity.value = withSequence(
        withTiming(0.14, { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1300, easing: Easing.in(Easing.cubic) })
      );
    }

    setTimeout(() => {
      setFreezeProcessing(false);
      if (card.freezeSimulateError) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setShowFreezeError(true);
      } else {
        toggleFreeze(card.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 1800);
  }, [card, toggleFreeze, frostOpacity, frostScale]);

  const handleRemoveConfirm = useCallback(() => {
    if (!card) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    removeCard(card.id);
    setShowRemove(false);
    navigation.goBack();
  }, [card, removeCard, navigation]);

  const handleChangePinConfirm = useCallback((newPin: string) => {
    if (!card) return;
    changePin(card.id, newPin);
    setShowChangePin(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [card, changePin]);

  const handleSpendingLimitSave = useCallback(
    (period: LimitPeriod, limit: number | null) => {
      if (!card) return;
      setSpendingLimit(card.id, period, limit);
      setEditingLimit(null);
      Haptics.notificationAsync(
        limit == null
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
    },
    [card, setSpendingLimit],
  );

  const handleOnlineTransactionsToggle = useCallback((value: boolean) => {
    if (!card) return;
    setOnlineTransactions(card.id, value);
    Haptics.selectionAsync();
  }, [card, setOnlineTransactions]);

  useEffect(() => {
    if (scrollTo !== 'limits' || limitsY == null || hasScrolledToLimits.current) return;
    hasScrolledToLimits.current = true;
    // Small delay lets the native-stack push transition finish before we
    // start animating the scroll — prevents a jerky double-motion.
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, limitsY - spacing.lg), animated: true });
    }, 280);
    return () => clearTimeout(t);
  }, [scrollTo, limitsY]);

  const handleLostStolenConfirm = useCallback(() => {
    if (!card) return;
    setShowLostStolen(false);
    if (!card.frozen) toggleFreeze(card.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    navigation.goBack();
  }, [card, toggleFreeze, navigation]);

  if (!card || !currency) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: colors.textPrimary, padding: spacing.xl }}>Card not found.</Text>
      </SafeAreaView>
    );
  }

  const cardPin = card.pin ?? '1234';
  const onlineEnabled = card.onlineTransactions !== false;
  const contactlessEnabled = card.contactless !== false;
  const spendingLimits = card.spendingLimits ?? {};
  const isExpired = card.expired === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Card settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Card face */}
        <View style={styles.cardArea}>
          <View style={styles.cardWrapper}>
            <CardFront
              card={card}
              currency={currency.code}
            />
            <Animated.View style={[styles.frostOverlay, frostStyle]} pointerEvents="none" />
          </View>
        </View>

        {/* Card settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card settings</Text>
          <SettingsRow
            icon={<Snowflake size={17} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Freeze card"
            sublabel={
              freezeProcessing
                ? (card.frozen ? 'Unfreezing…' : 'Freezing…')
                : (card.frozen ? 'Card is frozen' : 'Card is active')
            }
            isToggle
            toggleValue={card.frozen}
            toggleDisabled={freezeProcessing || isExpired}
            onToggle={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFreezeConfirm(true);
            }}
          />
          <SettingsRow
            icon={
              onlineEnabled
                ? <Globe size={17} color={colors.textSecondary} strokeWidth={1.8} />
                : <WifiOff size={17} color={colors.textMuted} strokeWidth={1.8} />
            }
            label="Online transactions"
            sublabel={onlineEnabled ? 'Card can be used online' : 'Blocked for online use'}
            isToggle
            toggleValue={onlineEnabled}
            onToggle={handleOnlineTransactionsToggle}
          />
          {card.type === 'physical' && (
            <SettingsRow
              icon={<Nfc size={17} color={contactlessEnabled ? colors.textSecondary : colors.textMuted} strokeWidth={1.8} />}
              label="Contactless payments"
              sublabel={contactlessEnabled ? 'Tap to pay enabled' : 'Tap to pay disabled'}
              isToggle
              toggleValue={contactlessEnabled}
              onToggle={(v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setContactless(card.id, v);
              }}
            />
          )}
          <SettingsRow
            icon={<KeyRound size={17} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Change PIN"
            onPress={() => { Haptics.selectionAsync(); setShowChangePin(true); }}
            isLast
          />
        </View>

        {/* Spending */}
        <View
          style={styles.section}
          onLayout={(e: LayoutChangeEvent) => setLimitsY(e.nativeEvent.layout.y)}
        >
          <Text style={styles.sectionTitle}>Spending limits</Text>
          {(['daily', 'weekly', 'monthly'] as LimitPeriod[]).map((p, i) => {
            const lim = spendingLimits[p];
            return (
              <SettingsRow
                key={p}
                icon={<Gauge size={17} color={colors.textSecondary} strokeWidth={1.8} />}
                label={PERIOD_LABELS[p]}
                value={lim != null ? `${currency.symbol}${lim.toLocaleString()}${PERIOD_UNITS[p]}` : 'Not set'}
                onPress={() => { Haptics.selectionAsync(); setEditingLimit(p); }}
                isLast={i === 2}
              />
            );
          })}
        </View>

        {/* Card info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card info</Text>
          <InfoRow
            icon={<CreditCard size={17} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Type"
            value={TYPE_LABELS[card.type]}
          />
          <View style={styles.infoDivider} />
          <InfoRow
            icon={<Globe size={17} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Network"
            value={card.network}
          />
          <View style={styles.infoDivider} />
          <InfoRow
            icon={<WalletIcon size={17} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Wallet"
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FlagIcon code={currency.flag} size={14} />
                <Text style={styles.infoValue}>{currency.code}</Text>
              </View>
            }
          />
          {!isExpired && !card.frozen && (
            <>
              <View style={styles.infoDivider} />
              <InfoRow
                icon={<Activity size={17} color={colors.textSecondary} strokeWidth={1.8} />}
                label="Status"
                right={
                  <View style={[styles.statusBadge, styles.statusActive]}>
                    <Check size={10} color="#16a34a" strokeWidth={2.5} />
                    <Text style={[styles.statusBadgeText, styles.statusActiveText]}>Active</Text>
                  </View>
                }
              />
            </>
          )}
        </View>

        {/* Danger zone */}
        <View style={[styles.section, styles.sectionLast]}>
          <Text style={styles.sectionTitle}>Danger zone</Text>
          <SettingsRow
            icon={<AlertTriangle size={17} color="#d97706" strokeWidth={1.8} />}
            label={card.type === 'virtual' || card.type === 'single-use' ? 'Report compromised' : 'Report lost or stolen'}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowLostStolen(true);
            }}
          />
          <SettingsRow
            icon={<Trash2 size={17} color={colors.failed} strokeWidth={1.8} />}
            label="Remove card"
            destructive
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowRemove(true);
            }}
            isLast
          />
        </View>

        {/* Prototype controls */}
        <View style={styles.protoWrap}>
          <Text style={styles.protoTitle}>⚙  Prototype</Text>
          <CardSegControl
            label="Card status"
            value={isExpired ? 'expired' : 'active'}
            onChange={(v) => { setExpired(card.id, v === 'expired'); Haptics.selectionAsync(); }}
            options={[{ label: 'Active', value: 'active' }, { label: 'Expired', value: 'expired' }]}
          />
          <CardSegControl
            label="Freeze action"
            value={card.freezeSimulateError ? 'fail' : 'success'}
            onChange={(v) => { setFreezeSimulateError(card.id, v === 'fail'); Haptics.selectionAsync(); }}
            options={[{ label: 'Success', value: 'success' }, { label: 'Fail', value: 'fail' }]}
          />
        </View>

      </ScrollView>

      <ChangePinSheet
        visible={showChangePin}
        currentPin={cardPin}
        onConfirm={handleChangePinConfirm}
        onClose={() => setShowChangePin(false)}
      />
      <LimitSheet
        visible={editingLimit !== null}
        period={editingLimit ?? 'daily'}
        currentLimit={editingLimit ? (spendingLimits[editingLimit] ?? null) : null}
        currencySymbol={currency.symbol}
        onSave={(limit) => editingLimit && handleSpendingLimitSave(editingLimit, limit)}
        onClose={() => setEditingLimit(null)}
      />

      {/* Freeze / unfreeze — neutral action, PrimaryButton */}
      <ConfirmSheet
        visible={showFreezeConfirm}
        icon={
          card.frozen
            ? <Unlock size={26} color={colors.brand} strokeWidth={1.8} />
            : <Snowflake size={26} color={colors.brand} strokeWidth={1.8} />
        }
        iconBg={colors.brandSubtle}
        title={card.frozen ? 'Unfreeze card?' : 'Freeze card?'}
        body={
          card.frozen
            ? 'Your card will be ready to use again. This may take a moment to process.'
            : 'All transactions will be blocked until you unfreeze it. This may take a moment to process.'
        }
        confirmLabel={card.frozen ? 'Yes, unfreeze' : 'Yes, freeze card'}
        onConfirm={handleFreezeConfirm}
        onCancel={() => setShowFreezeConfirm(false)}
      />

      {/* Report lost / compromised — destructive (permanently blocks card) */}
      <ConfirmSheet
        visible={showLostStolen}
        icon={<AlertTriangle size={26} color={colors.failed} strokeWidth={1.8} />}
        iconBg={colors.failedSubtle}
        title={card.type !== 'physical' ? 'Report card compromised?' : 'Report lost or stolen?'}
        body={
          card.type !== 'physical'
            ? `${card.name} ···· ${card.last4} will be permanently blocked and a new card will be issued. This cannot be undone.`
            : `${card.name} ···· ${card.last4} will be permanently blocked and a replacement card will be issued. This cannot be undone.`
        }
        confirmLabel="Report card"
        destructive
        onConfirm={handleLostStolenConfirm}
        onCancel={() => setShowLostStolen(false)}
      />

      {/* Remove card — destructive */}
      <ConfirmSheet
        visible={showRemove}
        icon={<Trash2 size={26} color={colors.failed} strokeWidth={1.8} />}
        iconBg={colors.failedSubtle}
        title="Remove card?"
        body={`${card.name} ···· ${card.last4} will be permanently removed from your wallet. This cannot be undone.`}
        confirmLabel="Remove card"
        destructive
        onConfirm={handleRemoveConfirm}
        onCancel={() => setShowRemove(false)}
      />

      {/* Freeze error — prototype simulation */}
      <ConfirmSheet
        visible={showFreezeError}
        icon={<WifiOff size={26} color={colors.failed} strokeWidth={1.8} />}
        iconBg={colors.failedSubtle}
        title={card.frozen ? 'Unfreeze failed' : 'Freeze failed'}
        body="We couldn't process your request right now. Please check your connection and try again."
        confirmLabel="Dismiss"
        secondary
        hideCancelButton
        onConfirm={() => setShowFreezeError(false)}
        onCancel={() => setShowFreezeError(false)}
      />
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelGroup}>
        <View style={styles.infoIconWrap}>{icon}</View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      {right ?? <Text style={styles.infoValue}>{value}</Text>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  title: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },

  scroll: {},

  // ── Card wrapper ──
  cardArea: {
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  frostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#bfdbfe',
    borderRadius: radius.xl,
  },
  // ── Sections ──
  section: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sectionLast: {
    paddingBottom: 0,
    marginBottom: spacing.xxxl,
    borderBottomWidth: 0,
  },
  sectionTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },

  // ── Reveal row ──
  revealRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  revealBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: spacing.md,
  },
  revealBtnText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  // ── Info rows (flat) ──
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoIconWrap: { width: 22, alignItems: 'center' },
  infoLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  infoValue: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },

  // ── Status badge (Active only — face shows Frozen/Expired) ──
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: 'rgba(22,163,74,0.08)',
    borderColor: 'rgba(22,163,74,0.22)',
  },
  statusBadgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    letterSpacing: 0.3,
  },
  statusActiveText: { color: '#16a34a' },

  // ── Prototype section ──
  protoWrap: { marginTop: spacing.xxl, paddingTop: spacing.lg, paddingHorizontal: spacing.xl, borderTopWidth: 1, borderTopColor: colors.borderSubtle, gap: spacing.sm, paddingBottom: spacing.xxxl },
  protoTitle: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },

  // ── Settings rows (flat) ──
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  settingsRowDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingsRowIcon: { width: 22, alignItems: 'center' },
  settingsRowLabel: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  settingsRowSublabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingsRowValue: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  settingsRowDestructive: { color: colors.failed },

  // ── Sheet icon / text ──
  sheetIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  sheetIconBrand: { backgroundColor: colors.brandSubtle },
  sheetTitle: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  sheetBody: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  sheetOutlineBtn: {
    width: '100%',
    paddingVertical: spacing.lg,
  },
  sheetCancelBtn: { width: '100%', paddingVertical: spacing.md },

  // ── View PIN ──
  pinRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  pinBox: {
    width: 52,
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDigit: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    fontVariant: ['tabular-nums'],
  },
  pinTimer: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // ── Change PIN keypad dots ──
  pinDotsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },

  // ── Shared numpad (PIN + amount) ──
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  numKey: {
    width: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },

  // ── Spending limit amount display ──
  limitAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xxxl,
  },
  limitSymbol: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
    paddingBottom: 5,
  },
  limitAmount: {
    fontSize: 52,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    fontVariant: ['tabular-nums'],
    lineHeight: 60,
  },
  limitMuted: { color: colors.textMuted },

  // ── Limit sheet numpad (taller keys) ──
  limitNumKey: {
    width: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },

  // ── Limit sheet actions ──
  limitActions: {
    width: '100%',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  limitCancelBtn: {
    paddingVertical: spacing.md,
  },
  limitSaveBtn: {
    width: '100%',
    paddingVertical: spacing.lg,
  },
});
