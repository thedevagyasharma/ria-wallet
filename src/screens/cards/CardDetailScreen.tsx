import React, { useState, useCallback } from 'react';
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
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Snowflake, Unlock, Eye, Trash2 } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useCardStore } from '../../stores/useCardStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency } from '../../data/currencies';
import { CardFront, CardBack, CARD_HEIGHT } from '../../components/CardFace';
import type { RootStackProps } from '../../navigation/types';
import type { Card, CardType } from '../../stores/types';

const FLIP_DURATION = 320;

const TYPE_LABELS: Record<CardType, string> = {
  physical:     'Physical card',
  virtual:      'Virtual card',
  'single-use': 'Single-use card',
};

// ─── Action button ────────────────────────────────────────────────────────────

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
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <View style={styles.actionBtnIcon}>{icon}</View>
      <Text style={[styles.actionBtnLabel, destructive && { color: colors.failed }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Remove confirmation modal ────────────────────────────────────────────────

function RemoveModal({
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
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Remove card?</Text>
          <Text style={styles.modalBody}>
            {card.name} ···· {card.last4} will be permanently removed. This cannot be undone.
          </Text>
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [styles.modalDestructiveBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.modalDestructiveBtnText}>Remove card</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={styles.modalCancelBtn}>
            <Text style={styles.modalCancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CardDetailScreen({ route }: RootStackProps<'CardDetail'>) {
  const navigation = useNavigation();
  const { cardId } = route.params;
  const { cards, toggleFreeze, removeCard } = useCardStore();
  const { wallets } = useWalletStore();
  const [showRemove, setShowRemove] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const card = cards.find((c) => c.id === cardId);
  const wallet = wallets.find((w) => w.id === card?.walletId);
  const currency = wallet ? getCurrency(wallet.currency) : null;

  // Flip state
  const flipAnim = useSharedValue(0);
  const isFlipped = useSharedValue(false);

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isFlipped.value) {
      flipAnim.value = withTiming(0, { duration: FLIP_DURATION });
      isFlipped.value = false;
    } else {
      flipAnim.value = withTiming(1, { duration: FLIP_DURATION });
      isFlipped.value = true;
    }
  });

  const frontStyle = useAnimatedStyle(() => {
    const rotate = interpolate(flipAnim.value, [0, 1], [0, 180], Extrapolation.CLAMP);
    return { transform: [{ perspective: 1000 }, { rotateY: `${rotate}deg` }] };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotate = interpolate(flipAnim.value, [0, 1], [180, 360], Extrapolation.CLAMP);
    return { transform: [{ perspective: 1000 }, { rotateY: `${rotate}deg` }], position: 'absolute' };
  });

  const handleFreeze = useCallback(() => {
    if (!card) return;
    Haptics.impactAsync(
      card.frozen ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );
    toggleFreeze(card.id);
  }, [card, toggleFreeze]);

  const handleRemoveConfirm = useCallback(() => {
    if (!card) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    removeCard(card.id);
    setShowRemove(false);
    navigation.goBack();
  }, [card, removeCard, navigation]);

  const handleViewPin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPin(true);
    setTimeout(() => setShowPin(false), 5000);
  }, []);

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
        {/* Flip card */}
        <GestureDetector gesture={tapGesture}>
          <View style={styles.cardWrapper}>
            <Animated.View style={frontStyle}>
              <CardFront card={card} currency={currency.code} />
            </Animated.View>
            <Animated.View style={backStyle}>
              <CardBack card={card} />
            </Animated.View>
            <Text style={styles.flipHint}>Tap to reveal card details</Text>
          </View>
        </GestureDetector>

        {/* Actions row */}
        <View style={styles.actionsRow}>
          <ActionBtn
            icon={card.frozen
              ? <Unlock size={22} color={colors.textSecondary} strokeWidth={1.8} />
              : <Snowflake size={22} color='#93c5fd' strokeWidth={1.8} />}
            label={card.frozen ? 'Unfreeze' : 'Freeze'}
            onPress={handleFreeze}
          />
          <ActionBtn
            icon={<Eye size={22} color={colors.textSecondary} strokeWidth={1.8} />}
            label={showPin ? '1234' : 'View PIN'}
            onPress={handleViewPin}
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
          <View style={styles.card}>
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

      <RemoveModal
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
    <View style={styles.limitRow}>
      <Text style={styles.limitLabel}>{label}</Text>
      <Text style={styles.limitValue}>{value}</Text>
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
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  scroll: { paddingHorizontal: spacing.xl },

  cardWrapper: {
    height: CARD_HEIGHT + 32,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  flipHint: {
    marginTop: spacing.sm,
    fontSize: typography.xs,
    color: colors.textMuted,
  },

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

  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  limitLabel: { fontSize: typography.base, color: colors.textSecondary },
  limitValue: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },

  // Remove modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  modalDestructiveBtn: {
    backgroundColor: colors.failed,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalDestructiveBtnText: { fontSize: typography.md, color: '#fff', fontWeight: typography.bold },
  modalCancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  modalCancelBtnText: { fontSize: typography.base, color: colors.textSecondary },
});
