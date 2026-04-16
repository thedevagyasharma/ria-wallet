import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  Dimensions,
  ListRenderItemInfo,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus, Eye, EyeOff, Settings, KeyRound } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import SecondaryButton from '../../components/SecondaryButton';
import PrimaryButton from '../../components/PrimaryButton';
import CardTransactionRow from '../../components/CardTransactionRow';
import ViewPinSheet from '../../components/ViewPinSheet';
import { useCardStore } from '../../stores/useCardStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency } from '../../data/currencies';
import FlagIcon from '../../components/FlagIcon';
import { CardFront } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Card } from '../../stores/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: W } = Dimensions.get('window');

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Card>);

const DOT_W_INACTIVE = 5;
const DOT_W_ACTIVE   = 18;

function CardDot({ index, scrollX, color }: {
  index: number;
  scrollX: SharedValue<number>;
  color: string;
}) {
  const dotStyle = useAnimatedStyle(() => {
    const t = Math.max(0, 1 - Math.abs(scrollX.value / W - index));
    return {
      width: DOT_W_INACTIVE + (DOT_W_ACTIVE - DOT_W_INACTIVE) * t,
      backgroundColor: interpolateColor(t, [0, 1], [colors.border, color]),
    };
  });
  return <Animated.View style={[styles.dot, dotStyle]} />;
}

// ─── Quick action button ──────────────────────────────────────────────────────

function ActionBtn({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      {({ pressed }) => (
        <>
          <View style={[styles.actionCircle, pressed && styles.actionCirclePressed]}>{icon}</View>
          <Text style={styles.actionLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WalletCardListScreen({ route }: RootStackProps<'WalletCardList'>) {
  const navigation = useNavigation<Nav>();
  const { walletId } = route.params;
  const { cards } = useCardStore();
  const { wallets, transactions } = useWalletStore();

  const wallet = wallets.find((w) => w.id === walletId);
  const currency = wallet ? getCurrency(wallet.currency) : null;
  const walletCards = cards.filter((c) => c.walletId === walletId);

  const [activeIndex, setActiveIndex] = useState(0);
  const [numberRevealed, setNumberRevealed] = useState(false);
  const [cvvRevealed, setCvvRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  const scrollX = useSharedValue(0);
  const handleCarouselScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollX.value = e.contentOffset.x; },
  });

  const activeCard = walletCards[activeIndex] ?? null;

  // Cards only ever spend — filter to this card's debit transactions only
  const cardTxs = transactions
    .filter((t) => t.cardId === activeCard?.id && t.amount < 0)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / W);
      const clamped = Math.max(0, Math.min(idx, walletCards.length - 1));
      if (clamped !== activeIndex) {
        setActiveIndex(clamped);
        setNumberRevealed(false);
        setCvvRevealed(false);
        setCopiedField(null);
        Haptics.selectionAsync();
      }
    },
    [walletCards.length, activeIndex],
  );

  const handleToggleRevealNumber = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNumberRevealed((prev) => {
      if (!prev) setCvvRevealed(false);
      return !prev;
    });
  }, []);

  const handleToggleRevealCvv = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCvvRevealed((prev) => {
      if (!prev) setNumberRevealed(false);
      return !prev;
    });
  }, []);

  const handleCopy = useCallback((field: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const handleAddCard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AddCardType', { walletId });
  }, [navigation, walletId]);

  const handleCardSettings = useCallback(() => {
    if (!activeCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CardDetail', { cardId: activeCard.id });
  }, [navigation, activeCard]);

  const renderCard = useCallback(
    ({ item, index }: ListRenderItemInfo<Card>) => (
      <View style={styles.cardItem}>
        <CardFront
          card={item}
          currency={currency?.code ?? ''}
          revealedNumber={index === activeIndex && numberRevealed}
          revealedCvv={index === activeIndex && cvvRevealed}
          onCopyNumber={() => handleCopy('number')}
          onCopyCvv={() => handleCopy('cvv')}
          copiedField={index === activeIndex ? copiedField : null}
        />
      </View>
    ),
    [currency, activeIndex, numberRevealed, cvvRevealed, copiedField, handleCopy],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        {currency ? (
          <View style={styles.titleRow}>
            <FlagIcon code={currency.flag} size={18} />
            <Text style={styles.title}>{currency.code}</Text>
          </View>
        ) : (
          <Text style={styles.title}>Cards</Text>
        )}
        <SecondaryButton onPress={handleAddCard} style={styles.addBtn}>
          <Plus size={11} color={colors.textMuted} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add card</Text>
        </SecondaryButton>
      </View>

      {walletCards.length === 0 ? (
        /* Empty state */
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySub}>
            Add a card to start spending from this wallet.
          </Text>
          <PrimaryButton
            label="Add your first card"
            onPress={handleAddCard}
            style={styles.emptyAddBtn}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          nestedScrollEnabled
        >
          {/* Card carousel */}
          <AnimatedFlatList
            data={walletCards}
            keyExtractor={(c) => c.id}
            renderItem={renderCard}
            extraData={{ activeIndex, numberRevealed, cvvRevealed, copiedField }}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleCarouselScroll}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={1}
            style={styles.carousel}
            nestedScrollEnabled
          />

          {/* Pagination dots */}
          {walletCards.length > 1 && (
            <View style={styles.dots}>
              {walletCards.map((card, i) => (
                <CardDot key={card.id} index={i} scrollX={scrollX} color={card.color} />
              ))}
            </View>
          )}

          {/* Quick actions */}
          <View style={styles.actions}>
            <ActionBtn
              icon={
                numberRevealed
                  ? <EyeOff size={22} color={colors.textSecondary} strokeWidth={1.8} />
                  : <Eye size={22} color={colors.textSecondary} strokeWidth={1.8} />
              }
              label={numberRevealed ? 'Hide number' : 'Show number'}
              onPress={handleToggleRevealNumber}
            />
            <ActionBtn
              icon={
                cvvRevealed
                  ? <EyeOff size={22} color={colors.textSecondary} strokeWidth={1.8} />
                  : <Eye size={22} color={colors.textSecondary} strokeWidth={1.8} />
              }
              label={cvvRevealed ? 'Hide CVV' : 'Show CVV'}
              onPress={handleToggleRevealCvv}
            />
            <ActionBtn
              icon={<KeyRound size={22} color={colors.textSecondary} strokeWidth={1.8} />}
              label="View PIN"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPin(true);
              }}
            />
            <ActionBtn
              icon={<Settings size={22} color={colors.textSecondary} strokeWidth={1.8} />}
              label="Settings"
              onPress={handleCardSettings}
            />
          </View>

          {/* Activity */}
          <View style={styles.activityHead}>
            <Text style={styles.activityLabel}>Activity</Text>
          </View>

          {cardTxs.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityTitle}>No transactions yet</Text>
              <Text style={styles.emptyActivitySub}>
                Purchases made with this card will appear here.
              </Text>
            </View>
          ) : (
            cardTxs.map((tx) => (
              <CardTransactionRow
                key={tx.id}
                tx={tx}
                onPress={() => navigation.navigate('TransactionDetail', { txId: tx.id })}
              />
            ))
          )}
        </ScrollView>
      )}

      <ViewPinSheet
        visible={showPin}
        pin={activeCard?.pin ?? '1234'}
        onClose={() => setShowPin(false)}
      />
    </SafeAreaView>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },

  scroll: { paddingBottom: spacing.xxxl },

  // ── Carousel ──
  carousel: { flexGrow: 0 },
  cardItem: {
    width: W,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  // ── Pagination dots ──
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  dot: {
    height: 5,
    borderRadius: 99,
  },

  // ── Quick actions ──
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8 },
  actionCircle: {
    width: 50,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCirclePressed: {
    backgroundColor: colors.surfaceHigh,
  },
  actionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    textAlign: 'center',
  },

  // ── Activity ──
  activityHead: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  activityLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  emptyActivity: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyActivityTitle: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  emptyActivitySub: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Empty state (no cards) ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },
  emptySub: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyAddBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
});
