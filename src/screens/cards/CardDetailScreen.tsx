import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  Snowflake,
  Unlock,
  Trash2,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useCardStore } from '../../stores/useCardStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency } from '../../data/currencies';
import { CardFront, CARD_WIDTH, CARD_HEIGHT } from '../../components/CardFace';
import type { RootStackProps } from '../../navigation/types';
import type { Card, CardType } from '../../stores/types';

const TYPE_LABELS: Record<CardType, string> = {
  physical: 'Physical card',
  virtual: 'Virtual card',
  'single-use': 'Single-use card',
};

// ─── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  icon,
  label,
  onPress,
  destructive,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        destructive && styles.actionBtnDestructive,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.actionBtnIcon}>{icon}</View>
      <Text style={[styles.actionBtnLabel, destructive && { color: colors.failed }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Reusable bottom sheet ─────────────────────────────────────────────────────

function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const overlayOpacity = useSharedValue(0);
  const sheetY = useSharedValue(600);

  // Mount when opening; unmount only after close animation finishes
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      // Reset to start positions then animate in
      overlayOpacity.value = 0;
      sheetY.value = 600;
      overlayOpacity.value = withTiming(1, { duration: 240 });
      sheetY.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      sheetY.value = withTiming(
        600,
        { duration: 260, easing: Easing.in(Easing.quad) },
        (finished) => { if (finished) runOnJS(setMounted)(false); },
      );
    }
  }, [visible, mounted]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Overlay fades independently */}
      <Animated.View style={[styles.sheetOverlay, overlayStyle]} pointerEvents="box-none">
        {/* Backdrop tap target */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Sheet slides up; onStartShouldSetResponder blocks backdrop from firing on sheet taps */}
        <Animated.View
          style={[styles.sheet, sheetStyle]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.sheetHandle} />
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Freeze / unfreeze confirmation ───────────────────────────────────────────

function FreezeSheet({
  visible,
  isFrozen,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  isFrozen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <View style={[styles.sheetIconWrap, isFrozen ? styles.sheetIconNeutral : styles.sheetIconIce]}>
        {isFrozen
          ? <Unlock size={26} color={colors.textPrimary} strokeWidth={1.8} />
          : <Snowflake size={26} color="#93c5fd" strokeWidth={1.8} />
        }
      </View>
      <Text style={styles.sheetTitle}>{isFrozen ? 'Unfreeze card?' : 'Freeze card?'}</Text>
      <Text style={styles.sheetBody}>
        {isFrozen
          ? 'Your card will be ready to use again. This may take a moment to process.'
          : 'All transactions will be blocked until you unfreeze it. This may take a moment to process.'
        }
      </Text>
      <Pressable
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.sheetPrimaryBtn,
          isFrozen ? styles.sheetUnfreezeBtn : styles.sheetFreezeBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.sheetPrimaryBtnText}>
          {isFrozen ? 'Yes, unfreeze' : 'Yes, freeze card'}
        </Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.sheetCancelBtn}>
        <Text style={styles.sheetCancelBtnText}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

// ─── PIN modal ─────────────────────────────────────────────────────────────────

function PinSheet({
  visible,
  pin,
  onClose,
}: {
  visible: boolean;
  pin: string;
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(15);

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(15);
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.sheetIconWrap, styles.sheetIconBrand]}>
        <Shield size={26} color={colors.brand} strokeWidth={1.8} />
      </View>
      <Text style={styles.sheetTitle}>Your PIN</Text>
      <Text style={styles.sheetBody}>
        Make sure no one can see your screen. Never share your PIN with anyone.
      </Text>
      <View style={styles.pinRow}>
        {pin.split('').map((digit, i) => (
          <View key={i} style={styles.pinBox}>
            <Text style={styles.pinDigit}>{digit}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.pinTimer}>Auto-hides in {secondsLeft}s</Text>
      <Pressable onPress={onClose} style={styles.sheetCancelBtn}>
        <Text style={styles.sheetCancelBtnText}>Close</Text>
      </Pressable>
    </BottomSheet>
  );
}

// ─── Remove confirmation ───────────────────────────────────────────────────────

function RemoveSheet({
  visible,
  card,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  card: Card | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!card) return null;
  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <View style={[styles.sheetIconWrap, styles.sheetIconDestructive]}>
        <Trash2 size={26} color={colors.failed} strokeWidth={1.8} />
      </View>
      <Text style={styles.sheetTitle}>Remove card?</Text>
      <Text style={styles.sheetBody}>
        {card.name} ···· {card.last4} will be permanently removed from your wallet. This cannot be undone.
      </Text>
      <Pressable
        onPress={onConfirm}
        style={({ pressed }) => [styles.sheetPrimaryBtn, styles.sheetDestructiveBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.sheetPrimaryBtnText}>Remove card</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.sheetCancelBtn}>
        <Text style={styles.sheetCancelBtnText}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

// ─── Sensitive detail field ────────────────────────────────────────────────────

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function CardDetailScreen({ route }: RootStackProps<'CardDetail'>) {
  const navigation = useNavigation();
  const { cardId } = route.params;
  const { cards, toggleFreeze, removeCard } = useCardStore();
  const { wallets } = useWalletStore();

  const [showRemove, setShowRemove] = useState(false);
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [freezeProcessing, setFreezeProcessing] = useState(false);
  const [numberRevealed, setNumberRevealed] = useState(false);
  const [cvvRevealed, setCvvRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
    Haptics.impactAsync(
      card.frozen ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy
    );

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
      toggleFreeze(card.id);
      setFreezeProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1800);
  }, [card, toggleFreeze, frostOpacity, frostScale]);

  const handleToggleRevealNumber = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNumberRevealed((prev) => !prev);
  }, []);

  const handleToggleRevealCvv = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCvvRevealed((prev) => !prev);
  }, []);

  const handleCopy = useCallback((field: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const handleRemoveConfirm = useCallback(() => {
    if (!card) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    removeCard(card.id);
    setShowRemove(false);
    navigation.goBack();
  }, [card, removeCard, navigation]);

  if (!card || !currency) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: colors.textPrimary, padding: spacing.xl }}>Card not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>{card.name}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Card face with inline reveal + copy */}
        <View style={styles.cardArea}>
          <View style={styles.cardWrapper}>
            <CardFront
              card={card}
              currency={currency.code}
              revealedNumber={numberRevealed}
              revealedCvv={cvvRevealed}
              onCopyNumber={() => handleCopy('number')}
              onCopyCvv={() => handleCopy('cvv')}
              copiedField={copiedField}
            />
            {/* Animated frost during freeze/unfreeze processing */}
            <Animated.View style={[styles.frostOverlay, frostStyle]} pointerEvents="none" />
          </View>
          {freezeProcessing && (
            <Text style={styles.processingText}>
              {card.frozen ? 'Unfreezing…' : 'Freezing…'}
            </Text>
          )}
        </View>

        {/* Reveal controls */}
        <View style={styles.revealRow}>
          <Pressable
            onPress={handleToggleRevealNumber}
            style={({ pressed }) => [styles.revealBtn, pressed && { opacity: 0.7 }]}
          >
            {numberRevealed
              ? <EyeOff size={16} color={colors.textSecondary} strokeWidth={1.8} />
              : <Eye    size={16} color={colors.textSecondary} strokeWidth={1.8} />
            }
            <Text style={styles.revealBtnText}>
              {numberRevealed ? 'Hide number' : 'Show number'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleToggleRevealCvv}
            style={({ pressed }) => [styles.revealBtn, pressed && { opacity: 0.7 }]}
          >
            {cvvRevealed
              ? <EyeOff size={16} color={colors.textSecondary} strokeWidth={1.8} />
              : <Eye    size={16} color={colors.textSecondary} strokeWidth={1.8} />
            }
            <Text style={styles.revealBtnText}>
              {cvvRevealed ? 'Hide CVV' : 'Show CVV'}
            </Text>
          </Pressable>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <ActionBtn
            icon={
              card.frozen
                ? <Unlock size={22} color={colors.textSecondary} strokeWidth={1.8} />
                : <Snowflake size={22} color="#93c5fd" strokeWidth={1.8} />
            }
            label={
              freezeProcessing
                ? (card.frozen ? 'Unfreezing…' : 'Freezing…')
                : (card.frozen ? 'Unfreeze' : 'Freeze')
            }
            disabled={freezeProcessing}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFreezeConfirm(true);
            }}
          />
          <ActionBtn
            icon={<Shield size={22} color={colors.textSecondary} strokeWidth={1.8} />}
            label="View PIN"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPin(true);
            }}
          />
          <ActionBtn
            icon={<Trash2 size={22} color={colors.failed} strokeWidth={1.8} />}
            label="Remove"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowRemove(true);
            }}
            destructive
          />
        </View>

        {/* Card info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card info</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Type" value={TYPE_LABELS[card.type]} />
            <View style={styles.divider} />
            <InfoRow label="Network" value={card.network} />
            <View style={styles.divider} />
            <InfoRow label="Wallet" value={`${currency.flag} ${currency.code}`} />
            <View style={styles.divider} />
            <InfoRow label="Status" value={card.frozen ? '❄️ Frozen' : '✅ Active'} />
          </View>
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <FreezeSheet
        visible={showFreezeConfirm}
        isFrozen={card.frozen}
        onConfirm={handleFreezeConfirm}
        onCancel={() => setShowFreezeConfirm(false)}
      />
      <PinSheet
        visible={showPin}
        pin="1234"
        onClose={() => setShowPin(false)}
      />
      <RemoveSheet
        visible={showRemove}
        card={card}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setShowRemove(false)}
      />
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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

  scroll: { paddingHorizontal: spacing.xl },

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
    backgroundColor: '#bfdbfe',   // blue-200
    borderRadius: radius.xl,
    // opacity driven by frostStyle
  },
  processingText: {
    marginTop: spacing.sm,
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    letterSpacing: 0.4,
  },

  // ── Sections ──
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle },

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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  revealBtnText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  // ── Actions row ──
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  actionBtnDestructive: {
    borderColor: colors.failedSubtle,
    backgroundColor: colors.failedSubtle,
  },
  actionBtnIcon: { marginBottom: 2 },
  actionBtnLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    textAlign: 'center',
  },

  // ── Info card ──
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoLabel: { fontSize: typography.base, color: colors.textSecondary },
  infoValue: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },

  // ── Bottom sheet ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  sheetIconNeutral: { backgroundColor: colors.surface },
  sheetIconIce: { backgroundColor: 'rgba(147,197,253,0.15)' },
  sheetIconBrand: { backgroundColor: colors.brandSubtle },
  sheetIconDestructive: { backgroundColor: colors.failedSubtle },
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
  sheetPrimaryBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  sheetFreezeBtn: { backgroundColor: '#1e3a5f' },
  sheetUnfreezeBtn: { backgroundColor: colors.textPrimary },
  sheetDestructiveBtn: { backgroundColor: colors.failed },
  sheetPrimaryBtnText: {
    fontSize: typography.md,
    color: '#fff',
    fontWeight: typography.bold,
  },
  sheetCancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  sheetCancelBtnText: { fontSize: typography.base, color: colors.textSecondary },

  // ── PIN sheet ──
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
});
