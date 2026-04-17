import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  Image,
  Platform,
  Dimensions,
  ListRenderItemInfo,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withDelay,
  Easing,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus, Eye, EyeOff, Settings, KeyRound } from 'lucide-react-native';
import AppleWalletBadge from '../../../assets/US-UK_Add_to_Apple_Wallet_RGB_101421.svg';
import GoogleWalletBadge from '../../../assets/enUS_add_to_google_wallet_add-wallet-badge.png';

import { colors, typography, spacing, radius } from '../../theme';
import SecondaryButton from '../../components/SecondaryButton';
import PrimaryButton from '../../components/PrimaryButton';
import FlatButton from '../../components/FlatButton';
import CardTransactionRow from '../../components/CardTransactionRow';
import ViewPinSheet from '../../components/ViewPinSheet';
import BottomSheet from '../../components/BottomSheet';
import { useCardStore } from '../../stores/useCardStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency } from '../../data/currencies';
import FlagIcon from '../../components/FlagIcon';
import { CardFront } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Card, Transaction } from '../../stores/types';

type LimitPeriod = 'daily' | 'weekly' | 'monthly';
const PERIOD_LABELS: Record<LimitPeriod, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

function periodStart(period: LimitPeriod, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === 'daily') return d;
  if (period === 'weekly') {
    const day = d.getDay();
    const daysSinceMon = (day + 6) % 7;
    d.setDate(d.getDate() - daysSinceMon);
    return d;
  }
  d.setDate(1);
  return d;
}

function sumUsageSince(txs: Transaction[], since: Date): number {
  let total = 0;
  for (const t of txs) {
    if (t.amount < 0 && t.date >= since) total += -t.amount;
  }
  return total;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: W } = Dimensions.get('window');
const PEEK = 28;
const CARD_GAP = 12;
const CARD_W = W - 2 * PEEK;
const SNAP = CARD_W + CARD_GAP;
const CARD_FACE_W = CARD_W - CARD_GAP;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Card>);

// ─── Pagination dot ──────────────────────────────────────────────────────────

const DOT_W_INACTIVE = 5;
const DOT_W_ACTIVE   = 18;

function CardDot({ index, scrollX, color }: {
  index: number;
  scrollX: SharedValue<number>;
  color: string;
}) {
  const dotStyle = useAnimatedStyle(() => {
    const t = Math.max(0, 1 - Math.abs(scrollX.value / SNAP - index));
    return {
      width: DOT_W_INACTIVE + (DOT_W_ACTIVE - DOT_W_INACTIVE) * t,
      backgroundColor: interpolateColor(t, [0, 1], [colors.border, color]),
    };
  });
  return <Animated.View style={[styles.dot, dotStyle]} />;
}

// ─── Card item with intro animation ──────────────────────────────────────────

type CardItemProps = {
  card: Card;
  index: number;
  activeIndex: number;
  currency: string;
  numberRevealed: boolean;
  cvvRevealed: boolean;
  copiedField: string | null;
  onCopy: (field: string) => void;
  introProgress: SharedValue<number>;
};

function AnimatedCardItem({
  card, index, activeIndex, currency, numberRevealed, cvvRevealed, copiedField, onCopy, introProgress,
}: CardItemProps) {
  const introStyle = useAnimatedStyle(() => {
    const v = introProgress.value;
    return {
      paddingBottom: v * 60,
      transform: [
        { translateY: v * 24 },
        { scale: 1 + v * 0.12 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.cardItem, introStyle]}>
      <CardFront
        card={card}
        currency={currency}
        width={CARD_FACE_W}
        revealedNumber={index === activeIndex && numberRevealed}
        revealedCvv={index === activeIndex && cvvRevealed}
        onCopyNumber={() => onCopy('number')}
        onCopyCvv={() => onCopy('cvv')}
        copiedField={index === activeIndex ? copiedField : null}
      />
    </Animated.View>
  );
}

// ─── Quick action button ─────────────────────────────────────────────────────

function ActionBtn({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.actionBtn, disabled && { opacity: 0.4 }]}>
      {({ pressed }) => (
        <>
          <View style={[styles.actionCircle, pressed && styles.actionCirclePressed]}>{icon}</View>
          <Text style={styles.actionLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ─── Spending limits ─────────────────────────────────────────────────────────

function LimitBar({
  period,
  used,
  limit,
  currencySymbol,
}: {
  period: LimitPeriod;
  used: number;
  limit: number;
  currencySymbol: string;
}) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  const over = used > limit;
  const remaining = Math.max(0, limit - used);

  return (
    <View style={styles.limitRow}>
      <View style={styles.limitRowHead}>
        <Text style={styles.limitLabel}>{PERIOD_LABELS[period]}</Text>
        <Text style={styles.limitAmounts}>
          <Text style={styles.limitUsed}>
            {currencySymbol}{used.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.limitOf}> of {currencySymbol}{limit.toLocaleString()}</Text>
        </Text>
      </View>
      <View style={styles.limitTrack}>
        <View style={[styles.limitFill, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={styles.limitSub}>
        {over
          ? `${currencySymbol}${(used - limit).toLocaleString(undefined, { maximumFractionDigits: 2 })} over limit`
          : `${currencySymbol}${remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })} remaining`}
      </Text>
    </View>
  );
}

function SpendingLimitsSection({
  card,
  cardTxs,
  currencySymbol,
  onEdit,
}: {
  card: Card;
  cardTxs: Transaction[];
  currencySymbol: string;
  onEdit: () => void;
}) {
  const limits = card.spendingLimits ?? {};
  const setPeriods: LimitPeriod[] = (['daily', 'weekly', 'monthly'] as LimitPeriod[])
    .filter((p) => limits[p] != null);

  if (setPeriods.length === 0) return null;

  return (
    <View style={styles.limitsSection}>
      <View style={styles.limitsHeader}>
        <Text style={styles.sectionLabel}>Spending limits</Text>
        <FlatButton onPress={onEdit} style={styles.editBtn}>
          <Text style={styles.editBtnText}>Edit  →</Text>
        </FlatButton>
      </View>
      {setPeriods.map((p) => (
        <LimitBar
          key={p}
          period={p}
          used={sumUsageSince(cardTxs, periodStart(p))}
          limit={limits[p]!}
          currencySymbol={currencySymbol}
        />
      ))}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CardListScreen({ route }: RootStackProps<'CardList'>) {
  const navigation = useNavigation<Nav>();
  const { walletId } = route.params;
  const { cards, justAddedCardId, clearJustAddedCardId } = useCardStore();
  const { wallets, transactions } = useWalletStore();

  const wallet = wallets.find((w) => w.id === walletId);
  const currency = wallet ? getCurrency(wallet.currency) : null;
  const walletCards = cards.filter((c) => c.walletId === walletId);

  const [activeIndex, setActiveIndex] = useState(0);
  const [numberRevealed, setNumberRevealed] = useState(false);
  const [cvvRevealed, setCvvRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);

  const walletLabel = Platform.OS === 'ios' ? 'Apple Wallet' : 'Google Wallet';

  useEffect(() => {
    if (!justAddedCardId) return;
    const timer = setTimeout(() => {
      setShowWalletPrompt(true);
      clearJustAddedCardId();
    }, 600);
    return () => clearTimeout(timer);
  }, [justAddedCardId, clearJustAddedCardId]);

  const scrollX = useSharedValue(0);

  const handleCarouselScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollX.value = e.contentOffset.x; },
  });

  const handleCarouselSettled = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP);
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

  // ── Intro animation ──
  const introProgress = useSharedValue(1);
  useEffect(() => {
    introProgress.value = withDelay(
      240,
      withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const activeCard = walletCards[activeIndex] ?? null;

  const cardTxs = transactions
    .filter((t) => t.cardId === activeCard?.id && t.amount < 0)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  // ── Handlers ──

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
    navigation.navigate('CardSettings', { cardId: activeCard.id });
  }, [navigation, activeCard]);

  const handleEditLimits = useCallback(() => {
    if (!activeCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CardSettings', { cardId: activeCard.id, scrollTo: 'limits' });
  }, [navigation, activeCard]);

  const renderCard = useCallback(
    ({ item, index }: ListRenderItemInfo<Card>) => (
      <AnimatedCardItem
        card={item}
        index={index}
        activeIndex={activeIndex}
        currency={currency?.code ?? ''}
        numberRevealed={numberRevealed}
        cvvRevealed={cvvRevealed}
        copiedField={copiedField}
        onCopy={handleCopy}
        introProgress={introProgress}
      />
    ),
    [currency, activeIndex, numberRevealed, cvvRevealed, copiedField, handleCopy, introProgress],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <View style={styles.titleCenter}>
          {currency ? (
            <View style={styles.titleRow}>
              <FlagIcon code={currency.flag} size={18} />
              <Text style={styles.title}>{currency.code}</Text>
            </View>
          ) : (
            <Text style={styles.title}>Cards</Text>
          )}
        </View>
        {walletCards.length > 0 ? (
          <SecondaryButton onPress={handleAddCard} style={styles.addBtn}>
            <Plus size={11} color={colors.textPrimary} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Card</Text>
          </SecondaryButton>
        ) : (
          <View style={styles.addBtn} />
        )}
      </View>

      {walletCards.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyContent}>
            <Image
              source={require('../../../assets/Isometric Cards.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptySub}>
              Add a card to start spending from this wallet.
            </Text>
          </View>
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
          {/* Card carousel with peek */}
          <AnimatedFlatList
            data={walletCards}
            keyExtractor={(c) => c.id}
            renderItem={renderCard}
            extraData={{ activeIndex, numberRevealed, cvvRevealed, copiedField }}
            horizontal
            snapToInterval={SNAP}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={handleCarouselScroll}
            onMomentumScrollEnd={handleCarouselSettled}
            scrollEventThrottle={1}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
            ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
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
              icon={<KeyRound size={22} color={activeCard?.type !== 'physical' ? colors.textMuted : colors.textSecondary} strokeWidth={1.8} />}
              label="View PIN"
              disabled={activeCard?.type !== 'physical'}
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

          {/* Spending limits */}
          {activeCard && activeCard.type !== 'single-use' && currency && (
            <SpendingLimitsSection
              card={activeCard}
              cardTxs={cardTxs}
              currencySymbol={currency.symbol}
              onEdit={handleEditLimits}
            />
          )}

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

      <BottomSheet
        visible={showWalletPrompt}
        onClose={() => setShowWalletPrompt(false)}
        swipeToDismiss
      >
        <View style={styles.walletPrompt}>
          <Text style={styles.walletPromptTitle}>Add to {walletLabel}?</Text>
          <Text style={styles.walletPromptBody}>
            Use your card for contactless payments with {walletLabel}.
          </Text>
        </View>
        <View style={styles.walletPromptActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowWalletPrompt(false);
            }}
            style={({ pressed }) => [styles.walletBadgeBtn, pressed && { opacity: 0.7 }]}
          >
            {Platform.OS === 'ios'
              ? <AppleWalletBadge width={200} height={63} />
              : <Image source={GoogleWalletBadge} style={styles.googleBadge} resizeMode="contain" />
            }
          </Pressable>
          <FlatButton
            onPress={() => setShowWalletPrompt(false)}
            label="Not now"
            style={styles.walletPromptDismiss}
          />
          <Text style={styles.walletPromptHint}>
            You can always do this later in card settings.
          </Text>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  titleCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },

  scroll: { paddingBottom: spacing.xxxl },

  // ── Card carousel ──
  carousel: { flexGrow: 0 },
  carouselContent: { paddingHorizontal: PEEK },
  cardItem: {
    width: CARD_W,
    alignItems: 'center',
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

  // ── Spending limits ──
  limitsSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  limitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  editBtnText: {
    fontSize: typography.sm,
    color: colors.brand,
    fontWeight: typography.semibold,
  },
  limitRow: {
    paddingVertical: spacing.md,
  },
  limitRowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  limitLabel: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  limitAmounts: {
    fontSize: typography.sm,
    fontVariant: ['tabular-nums'],
  },
  limitUsed: {
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  limitOf: {
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  limitTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  limitFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.brand,
  },
  limitSub: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyImage: { width: 280, height: 220 },
  emptyTitle: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    marginTop: spacing.lg,
  },
  emptySub: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyAddBtn: {
    paddingVertical: spacing.lg,
  },

  // ── Add to wallet prompt ──
  walletPrompt: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  walletPromptTitle: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  walletPromptBody: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  walletPromptActions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  walletBadgeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBadge: {
    width: 200,
    height: 63,
  },
  walletPromptDismiss: {
    width: '100%',
    paddingVertical: spacing.md,
  },
  walletPromptHint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
