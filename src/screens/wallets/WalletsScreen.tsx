import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolateColor,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  Dimensions,
  InteractionManager,
  ListRenderItemInfo,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Wallet>);
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  CircleDollarSign,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { alpha } from '../../utils/color';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { usePrefsStore } from '../../stores/usePrefsStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import { MOCK_PROFILE } from '../../data/mockData';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import ActivityItem from '../../components/ActivityItem';
import FlatButton from '../../components/FlatButton';
import { CardFront, CARD_HEIGHT, STACK_V_OFFSET } from '../../components/CardFace';
import FlagIcon from '../../components/FlagIcon';
import type { RootStackParamList } from '../../navigation/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';
import type { Transaction, Wallet, Card } from '../../stores/types';
import EmptyState from '../../components/EmptyState';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: W } = Dimensions.get('window');
const H_PAD = 24;

const GREETING_H      = 64;
const ITEM_H          = 72;   // carousel header — snug to content
const BALANCE_H       = 210;  // digit area + equal top/bottom space + toggle
const BALANCE_DIGIT_H = 54;   // clip height per digit cell
const BALANCE_DIGIT_W = 27;   // fixed width per digit (tabular-nums at fontSize 44)
const BALANCE_SEP_W   = 14;   // comma / space width at fontSize 44

function charW(c: string) { return /\d/.test(c) ? BALANCE_DIGIT_W : BALANCE_SEP_W; }

const MAX_PREVIEW_TXS = 3;


const WALLET_ACCENTS: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};
function walletAccent(c: string, override?: string) { return override ?? WALLET_ACCENTS[c] ?? colors.brand; }

// ─── Per-digit slot drum ──────────────────────────────────────────────────────
//
// Each digit position is a vertical drum containing: • 0 1 2 3 4 5 6 7 8 9
// The drum's translateY selects which item is visible through the clipping cell:
//
//   y = 0              → • (masked)
//   y = -(d+1) * H     → digit d
//
// Wallet switch: `actual` prop changes → animate from old Y to new Y.
// Reveal/hide:   `revealed` changes   → animate between digit Y and 0.
//
// No text swapping, no React state timing races, no resets.

const DRUM_ITEMS = ['•', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Clip window is intentionally smaller than lineHeight so the overflow:hidden
// edge lands in the blank padding around the character, not through its body.
const CLIP_H       = BALANCE_DIGIT_H - 8;          // 46px visible window
const DRUM_OFFSET  = (CLIP_H - BALANCE_DIGIT_H) / 2; // −4 — centres digit in window

function drumY(d: string) {
  return -(parseInt(d, 10) + 1) * BALANCE_DIGIT_H + DRUM_OFFSET;
}

function BalanceDrumChar({ actual, revealed, delay }: {
  actual: string; revealed: boolean; delay: number;
}) {
  const y = useSharedValue(revealed ? drumY(actual) : DRUM_OFFSET);

  useEffect(() => {
    y.value = withDelay(
      delay,
      withTiming(revealed ? drumY(actual) : DRUM_OFFSET, { duration: 340, easing: Easing.out(Easing.cubic) }),
    );
  }, [revealed, actual]);

  const drumStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.balanceDigitCell}>
      <Animated.View style={drumStyle}>
        {DRUM_ITEMS.map((item, i) => (
          <Text key={i} style={styles.balanceDigit}>{item}</Text>
        ))}
      </Animated.View>
    </View>
  );
}

// Expanding container for the "extra" chars that don't exist in the mask.
function ExtraExpand({ chars, revealed }: { chars: string[]; revealed: boolean }) {
  const totalW = chars.reduce((sum, c) => sum + charW(c), 0);
  const animW  = useSharedValue(revealed ? totalW : 0);

  useEffect(() => {
    animW.value = withTiming(revealed ? totalW : 0, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
  }, [revealed, totalW]);

  const style = useAnimatedStyle(() => ({ width: animW.value }));

  return (
    <Animated.View style={[styles.extraExpand, style]}>
      {chars.map((c, i) =>
        /\d/.test(c)
          ? <BalanceDrumChar key={i} actual={c} revealed={revealed} delay={0} />
          : <Text key={i} style={[styles.balanceStatic, { width: BALANCE_SEP_W }]}>{c}</Text>
      )}
    </Animated.View>
  );
}

// Parses the formatted balance string and builds the animated row.
function FlipBalance({ real, revealed }: { real: string; revealed: boolean }) {
  const dotIdx       = real.indexOf('.');
  const fracStr      = dotIdx >= 0 ? real.slice(dotIdx + 1) : '';
  const beforeDot    = dotIdx >= 0 ? real.slice(0, dotIdx) : real;

  // Split symbol (everything before first digit) from integer digits+separators
  const firstDigit   = beforeDot.search(/\d/);
  const symbol       = firstDigit > 0 ? beforeDot.slice(0, firstDigit) : '';
  const intChars     = Array.from(beforeDot.slice(firstDigit >= 0 ? firstDigit : 0));

  // Identify the rightmost 3 digit positions → "core" that maps to the mask •••
  const MASK_DIGITS  = 3;
  let digitsFromRight = 0;
  let coreStart      = intChars.length;
  for (let i = intChars.length - 1; i >= 0; i--) {
    if (/\d/.test(intChars[i])) {
      digitsFromRight++;
      if (digitsFromRight === MASK_DIGITS) { coreStart = i; break; }
    }
  }

  const extraChars = intChars.slice(0, coreStart);
  const coreChars  = intChars.slice(coreStart);
  const fracChars  = Array.from(fracStr);

  // Stagger delays: left-to-right cascade across the whole number
  let flipIdx = 0;
  const coreDelays = coreChars.map(c => /\d/.test(c) ? flipIdx++ * 45 + 30 : -1);
  const fracDelays = fracChars.map(() => flipIdx++ * 45 + 30);

  return (
    <View style={styles.balanceRow}>
      <Text style={styles.balanceStatic}>{symbol}</Text>

      {extraChars.length > 0 && (
        <ExtraExpand chars={extraChars} revealed={revealed} />
      )}

      {coreChars.map((c, i) =>
        /\d/.test(c) ? (
          <BalanceDrumChar key={i} actual={c} revealed={revealed} delay={coreDelays[i]} />
        ) : (
          <Text key={i} style={[styles.balanceStatic, { width: BALANCE_SEP_W }]}>{c}</Text>
        )
      )}

      <Text style={styles.balanceStatic}>{'.'}</Text>

      {fracChars.map((c, i) => (
        <BalanceDrumChar key={i} actual={c} revealed={revealed} delay={fracDelays[i]} />
      ))}
    </View>
  );
}

// ─── Wallet item — pure display, no animation state ──────────────────────────
// Balance lives at the screen level so one element drives the flip.

function WalletItem({ wallet, justCreated }: { wallet: Wallet; justCreated?: boolean }) {
  const currency = getCurrency(wallet.currency);
  const accent   = walletAccent(wallet.currency, wallet.accentColor);

  // "Wallet Created" chip — kept mounted on every non-primary wallet so its
  // footprint reserves the same vertical space as the Primary chip. Visibility
  // is driven purely by opacity + scale transforms (layout-free) so flipping
  // justCreated never shifts the rows below it.
  //
  // Entry: ~450ms delay (lets the carousel scroll settle first) → spring scale
  // 0.5 → 1 with a small overshoot + timing opacity fade-in. Exit: timed fade;
  // scale stays at 1 so the chip doesn't shrink on the way out.
  const chipOpacity = useSharedValue(0);
  const chipScale   = useSharedValue(0.5);
  useEffect(() => {
    if (justCreated) {
      chipOpacity.value = withDelay(450, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
      chipScale.value   = withDelay(450, withSpring(1, { damping: 9, stiffness: 170, mass: 0.7 }));
    } else {
      chipOpacity.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    }
  }, [justCreated]);
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipOpacity.value,
    transform: [{ scale: chipScale.value }],
  }));

  return (
    <View style={styles.walletItem}>
      {wallet.isPrimary ? (
        <View style={[styles.primaryChip, {
          backgroundColor: alpha(accent, 0.1),
          borderColor:     alpha(accent, 0.28),
        }]}>
          <Text style={[styles.primaryChipText, { color: accent }]}>Primary</Text>
        </View>
      ) : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.primaryChip,
            styles.justCreatedChip,
            chipStyle,
          ]}
        >
          <Text style={[styles.primaryChipText, { color: colors.brand }]}>
            Wallet Created
          </Text>
        </Animated.View>
      )}

      <View style={styles.currencyRow}>
        <FlagIcon code={currency.flag} size={14} />
        <Text style={styles.itemCode}>{wallet.nickname ?? currency.code}</Text>
      </View>

      {/* Decorative symbol — lives inside the FlatList item so it slides for free */}
      <Text style={[styles.decorativeCurrencySymbol, { color: accent }]}>
        {getCurrency(wallet.currency).symbol}
      </Text>
    </View>
  );
}

// ─── Animated header gradient — cross-fades wallet accent color ───────────────

function WalletHeaderGradient({ wallet, index, scrollX }: {
  wallet: Wallet;
  index: number;
  scrollX: SharedValue<number>;
}) {
  const accent = walletAccent(wallet.currency, wallet.accentColor);
  const opacityStyle = useAnimatedStyle(() => {
    const dist = Math.abs(scrollX.value - index * W);
    return { opacity: Math.max(0, 1 - dist / W) };
  });
  return (
    <Animated.View style={[styles.headerGradient, opacityStyle]} pointerEvents="none">
      <LinearGradient
        colors={[alpha(accent, 0.1), 'transparent']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

// ─── Liquid dot — width tracks scroll position ──────────────────────────────

const DOT_W_INACTIVE = 5;
const DOT_W_ACTIVE   = 18;

function WalletDot({ index, scrollX, accentColor }: {
  index: number;
  scrollX: SharedValue<number>;
  accentColor: string;
}) {
  const dotStyle = useAnimatedStyle(() => {
    const t = Math.max(0, 1 - Math.abs(scrollX.value / W - index));
    return {
      width: DOT_W_INACTIVE + (DOT_W_ACTIVE - DOT_W_INACTIVE) * t,
      backgroundColor: interpolateColor(t, [0, 1], [colors.border, accentColor]),
    };
  });
  return <Animated.View style={[styles.dot, dotStyle]} />;
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  icon, label, onPress, circleStyle,
}: { icon: React.ReactNode; label: string; onPress: () => void; circleStyle: object }) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      {({ pressed }) => (
        <>
          <Animated.View style={[styles.actionCircle, circleStyle]}>
            {pressed && <View style={styles.actionCircleOverlay} />}
            {icon}
          </Animated.View>
          <Text style={styles.actionLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ─── Prototype seg control ───────────────────────────────────────────────────

function WalletSegControl<T extends string>({
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
            onPress={() => onChange(opt.value)}
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
  row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  label:        { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },
  track:        { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  seg:          { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  segActive:    { backgroundColor: colors.textPrimary },
  segText:      { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.semibold },
  segTextActive:{ color: colors.bg },
});

// ─── Animated card stack ─────────────────────────────────────────────────────

const SPREAD_V_OFFSET = 90;
const SPREAD_DRAG_DIST = 160;

const EMPTY_CARDS: Card[] = [];

// ─── Per-card animated slot ──────────────────────────────────────────────────

const AnimatedCardSlot = React.memo(function AnimatedCardSlot({
  card, index, totalCards, walletIndex, scrollX, spreadProgress,
  entranceProgress, isEntranceTarget, liftProgress, liftedIndex,
}: {
  card: Card;
  index: number;
  totalCards: number;
  walletIndex: number;
  scrollX: SharedValue<number>;
  spreadProgress: SharedValue<number>;
  entranceProgress: SharedValue<number>;
  isEntranceTarget: boolean;
  liftProgress: SharedValue<number>;
  liftedIndex: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => {
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    const p = Math.min(Math.abs(st) * 2, 1);
    const sp = spreadProgress.value;
    const n = totalCards;

    const stagger = n > 1 ? 0.7 / (n - 1) : 0;
    const delay = index * stagger;
    const perSp = Math.min(1, Math.max(0, (sp - delay) / Math.max(0.01, 1 - delay)));

    const vOff = STACK_V_OFFSET + perSp * (SPREAD_V_OFFSET - STACK_V_OFFSET);
    const baseY = (n - 1 - index) * vOff;

    const shrink = 0.01 * Math.min(index, 6) * (1 - sp);
    const baseScale = 1 - shrink * (1 - p);

    const ev = isEntranceTarget ? entranceProgress.value : 0;
    const lift = liftedIndex.value === index ? liftProgress.value * 8 : 0;

    return {
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: baseY * (1 - p) - ev * 40 - lift },
        { scale: baseScale * (1 + ev * 0.06) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.cardSlot,
        index === 0 && styles.cardSlotFrontShadow,
        { zIndex: totalCards - index },
        animStyle,
      ]}
    >
      <CardFront card={card} compact />
    </Animated.View>
  );
});

// ─── Card stack container ───────────────────────────────────────────────────

const AnimatedCardStack = React.memo(function AnimatedCardStack({ walletIndex, cards, accent, onPressCard, scrollX, spreadProgress, liftProgress, liftedIndex, playEntrance, onEntranceComplete }: {
  walletIndex: number;
  cards: Card[];
  accent: string;
  onPressCard: (index: number) => void;
  scrollX: SharedValue<number>;
  spreadProgress: SharedValue<number>;
  liftProgress: SharedValue<number>;
  liftedIndex: SharedValue<number>;
  playEntrance?: boolean;
  onEntranceComplete?: () => void;
}) {
  const entranceProgress = useSharedValue(playEntrance ? 1 : 0);
  useEffect(() => {
    if (!playEntrance) return;
    entranceProgress.value = 1;
    const task = InteractionManager.runAfterInteractions(() => {
      entranceProgress.value = withTiming(
        0,
        { duration: 540, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished && onEntranceComplete) runOnJS(onEntranceComplete)();
        },
      );
    });
    return () => task.cancel?.();
  }, [playEntrance]);

  const emptyStyle = useAnimatedStyle(() => {
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    return { opacity: visible ? 1 : 0 };
  });

  if (cards.length === 0) {
    return (
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: CARD_HEIGHT }, emptyStyle]}>
        <Pressable
          onPress={() => onPressCard(-1)}
          pressRetentionOffset={{ top: 40, left: 40, right: 40, bottom: 40 }}
          style={{ flex: 1 }}
        >
          <View style={[styles.cardEmpty, { borderColor: alpha(accent, 0.25), backgroundColor: alpha(accent, 0.04) }]}>
            <Text style={[styles.cardEmptyText, { color: accent }]}>+ Add your first card</Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {cards.map((card, idx) => (
        <AnimatedCardSlot
          key={card.id}
          card={card}
          index={idx}
          totalCards={cards.length}
          walletIndex={walletIndex}
          scrollX={scrollX}
          spreadProgress={spreadProgress}
          entranceProgress={entranceProgress}
          isEntranceTarget={idx === 0 && !!playEntrance}
          liftProgress={liftProgress}
          liftedIndex={liftedIndex}
        />
      ))}
    </View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WalletsScreen() {
  const navigation = useNavigation<Nav>();
  const {
    wallets,
    transactions,
    setActiveWallet,
    justAddedWalletId,
    clearJustAddedWalletId,
  } = useWalletStore();
  const { cards, getWalletCards, justAddedCardId, clearJustAddedCardId } = useCardStore();
  const { hideBalances, toggleHideBalances, walletActionsLayout, toggleWalletActionsLayout } = usePrefsStore();

  // Initial wallet: prefer just-added wallet, then just-added card's wallet,
  // then primary. Covers first-mount-after-create cases where the store
  // already holds the signal by the time this component initialises.
  const initialIdx = (() => {
    if (justAddedWalletId) {
      const idx = wallets.findIndex((w) => w.id === justAddedWalletId);
      if (idx >= 0) return idx;
    }
    if (justAddedCardId) {
      const card = cards.find((c) => c.id === justAddedCardId);
      const idx = card ? wallets.findIndex((w) => w.id === card.walletId) : -1;
      if (idx >= 0) return idx;
    }
    const primary = wallets.findIndex((w) => w.isPrimary);
    return primary >= 0 ? primary : 0;
  })();

  const [currentIndex, setCurrentIndex] = useState(initialIdx);
  // Track the last index we fired for so onScroll doesn't double-fire.
  const pendingIdx = useRef(initialIdx);
  const flatListRef = useRef<FlatList<Wallet>>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollReset = useTabScrollReset();
  const scrollX = useSharedValue(initialIdx * W);
  // Captured via onLayout on the card section so we can scroll it into view
  // when a new card is added.
  const cardSectionY = useRef(0);

  // One-shot spotlight on the just-created wallet's carousel item. Kept in
  // local state because the store signal is cleared immediately after the
  // scroll effect runs — we need our own timer to hold the chip visible.
  const [highlightWalletId, setHighlightWalletId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollReset > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollReset]);

  // On mount with a pre-existing justAddedCardId (rare: app resumed mid-flow),
  // snap the carousel to the target wallet so scrollX matches the native view.
  useEffect(() => {
    if (initialIdx > 0 && justAddedCardId) {
      flatListRef.current?.scrollToOffset({ offset: initialIdx * W, animated: false });
      setActiveWallet(wallets[initialIdx].id);
    }
    // Only runs on mount — intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to a new justAddedWalletId (common case: user was on Wallets,
  // created a wallet, tapped Done on WalletSuccess). Snap the page to top
  // and slide the carousel to the new wallet with animation so the user
  // sees their new wallet arrive as the success screen fades away.
  useEffect(() => {
    if (!justAddedWalletId) return;
    const idx = wallets.findIndex((w) => w.id === justAddedWalletId);
    if (idx < 0) {
      clearJustAddedWalletId();
      return;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    flatListRef.current?.scrollToOffset({ offset: idx * W, animated: true });
    pendingIdx.current = idx;
    setCurrentIndex(idx);
    setActiveWallet(wallets[idx].id);
    scrollX.value = idx * W;
    setHighlightWalletId(justAddedWalletId);
    clearJustAddedWalletId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justAddedWalletId]);

  // Dismiss the "Just created" chip after a beat — long enough to register,
  // short enough not to linger past the moment the user scans the screen.
  useEffect(() => {
    if (!highlightWalletId) return;
    const t = setTimeout(() => setHighlightWalletId(null), 3200);
    return () => clearTimeout(t);
  }, [highlightWalletId]);

  // React to a new justAddedCardId while mounted (common case: user was on
  // Wallets, added a card, tapped Done). Snap both scrolls (vertical page and
  // horizontal wallet carousel) into position — `animated: false` keeps the
  // UI thread free for the land-in animation that's about to run. The snap
  // itself is hidden by the native stack-pop transition, so the user sees
  // Wallets fully in place when AddCardReview slides away.
  useEffect(() => {
    if (!justAddedCardId) return;
    const card = cards.find((c) => c.id === justAddedCardId);
    if (!card) return;

    // Bring the card section into view — small top offset keeps the balance/
    // actions partially visible so the page still reads as the Wallets home.
    const targetY = Math.max(0, cardSectionY.current - 24);
    scrollRef.current?.scrollTo({ y: targetY, animated: false });

    const idx = wallets.findIndex((w) => w.id === card.walletId);
    if (idx < 0 || idx === currentIndex) return;
    flatListRef.current?.scrollToOffset({ offset: idx * W, animated: false });
    pendingIdx.current = idx;
    setCurrentIndex(idx);
    setActiveWallet(wallets[idx].id);
    scrollX.value = idx * W;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justAddedCardId]);

  const spreadProgress = useSharedValue(0);
  const spreadStart = useSharedValue(0);
  const startTouchY = useSharedValue(0);
  const startTapLocalY = useSharedValue(0);
  const hasMoved = useSharedValue(false);
  const liftProgress = useSharedValue(0);
  const liftedIndex = useSharedValue(-1);

  const active      = wallets[currentIndex] ?? wallets[0];
  const activeCards = active ? getWalletCards(active.id) : [];
  const accent      = walletAccent(active?.currency ?? 'USD', active?.accentColor);
  const activeCardCount = useSharedValue(activeCards.length);

  // active-wallet ref: lets tap handlers read the current wallet without
  // listing `active` in their deps — keeps their references stable across
  // currentIndex changes so AnimatedCardStack's memo doesn't bust mid-entrance.
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  // Pre-grouped cards per wallet id. Stable reference as long as the cards
  // array and wallet list don't change, so AnimatedCardStack's cards prop
  // doesn't flip to a new reference on every render.
  const cardsByWalletId = useMemo(() => {
    const map: Record<string, Card[]> = {};
    for (const w of wallets) {
      map[w.id] = cards.filter((c) => c.walletId === w.id);
    }
    return map;
  }, [wallets, cards]);
  const walletTxs   = transactions
    .filter((t) => t.walletId === active?.id)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const previewTxs = walletTxs.slice(0, MAX_PREVIEW_TXS);

  useEffect(() => {
    activeCardCount.value = activeCards.length;
  }, [activeCards.length]);

  const cardStackAnimStyle = useAnimatedStyle(() => {
    const n = activeCardCount.value;
    const sp = spreadProgress.value;
    const vOff = STACK_V_OFFSET + sp * (SPREAD_V_OFFSET - STACK_V_OFFSET);
    return { height: n <= 1 ? CARD_HEIGHT : CARD_HEIGHT + vOff * (n - 1) };
  });

  const handleScrollJS = useCallback((x: number) => {
    const nearest = Math.max(0, Math.min(Math.round(x / W), wallets.length - 1));
    if (nearest !== pendingIdx.current) {
      pendingIdx.current = nearest;
      activeCardCount.value = getWalletCards(wallets[nearest].id).length;
      setCurrentIndex(nearest);
      setActiveWallet(wallets[nearest].id);
      Haptics.selectionAsync();
      if (spreadProgress.value > 0) {
        spreadProgress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      }
    }
  }, [wallets, setActiveWallet, getWalletCards]);

  // UI-thread handler — scrollX updated here so animated children (symbols,
  // gradients, dots) track the finger with zero JS-thread lag.
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      runOnJS(handleScrollJS)(e.contentOffset.x);
    },
  });

  // Safety net: reconcile to the final snapped position after momentum ends.
  const handleCarouselEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / W);
      const clamped = Math.max(0, Math.min(idx, wallets.length - 1));
      if (clamped !== pendingIdx.current) Haptics.selectionAsync();
      pendingIdx.current = clamped;
      setCurrentIndex(clamped);
      setActiveWallet(wallets[clamped].id);
    },
    [wallets, setActiveWallet],
  );

  const renderWallet = useCallback(
    ({ item }: ListRenderItemInfo<Wallet>) => (
      <WalletItem wallet={item} justCreated={item.id === highlightWalletId} />
    ),
    [highlightWalletId],
  );

  // All tap handlers read the active wallet from activeRef so they don't
  // re-derive when currentIndex changes — reference-stable handlers let
  // memoized children skip re-renders on scroll / wallet switch.
  const handleSend       = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); const w = activeRef.current; if (w) navigation.navigate('SendMoney', { walletId: w.id }); }, [navigation]);
  const handleCards      = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  const w = activeRef.current; if (!w) return; const hasCards = useCardStore.getState().cards.some((c) => c.walletId === w.id); navigation.navigate(hasCards ? 'CardList' : 'AddCardType', { walletId: w.id }); }, [navigation]);
  const handleCustomize  = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  const w = activeRef.current; if (w) navigation.navigate('WalletSettings', { walletId: w.id }); }, [navigation]);
  const handleReceive    = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); const w = activeRef.current; if (w) navigation.navigate('ReceiveMoney', { walletId: w.id }); }, [navigation]);
  const handleStub       = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), []);
  const handleAddWallet  = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('CurrencyPicker'); }, [navigation]);
  const handleSeeAll     = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); const w = activeRef.current; if (w) navigation.navigate('Activity', { walletId: w.id }); }, [navigation]);
  const handleCardTapAtY = useCallback((tapY: number) => {
    const w = activeRef.current;
    if (!w) return;
    const wCards = getWalletCards(w.id);
    if (wCards.length === 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('AddCardType', { walletId: w.id });
      return;
    }
    const sp = spreadProgress.value;
    const n = wCards.length;
    const vOff = STACK_V_OFFSET + sp * (SPREAD_V_OFFSET - STACK_V_OFFSET);
    let tappedIndex = n - 1;
    for (let i = 0; i < n; i++) {
      if (tapY >= (n - 1 - i) * vOff) { tappedIndex = i; break; }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    liftedIndex.value = tappedIndex;
    liftProgress.value = 0;
    liftProgress.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      navigation.navigate('CardList', { walletId: w.id, initialCardIndex: tappedIndex });
      liftProgress.value = 0;
      liftedIndex.value = -1;
    }, 140);
  }, [navigation, getWalletCards]);

  const cardPanGesture = useMemo(() =>
    Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((e) => {
        startTouchY.value = e.allTouches[0].absoluteY;
        startTapLocalY.value = e.allTouches[0].y;
        hasMoved.value = false;
      })
      .onTouchesMove((e, state) => {
        const dy = e.allTouches[0].absoluteY - startTouchY.value;
        if (Math.abs(dy) > 8) hasMoved.value = true;
        if (dy > 14 || (spreadProgress.value > 0.01 && dy < -14)) state.activate();
        else if (spreadProgress.value < 0.01 && dy < -20) state.fail();
      })
      .onTouchesUp((_, state) => {
        if (!hasMoved.value) {
          runOnJS(handleCardTapAtY)(startTapLocalY.value);
        }
        state.fail();
      })
      .onStart(() => { spreadStart.value = spreadProgress.value; })
      .onUpdate((e) => {
        const newSp = spreadStart.value + e.translationY / SPREAD_DRAG_DIST;
        spreadProgress.value = Math.max(0, Math.min(1, newSp));
      })
      .onEnd((e) => {
        const vel = e.velocityY;
        if (vel > 800) {
          spreadProgress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
        } else if (vel < -800) {
          spreadProgress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        }
      }),
    [handleCardTapAtY],
  );

  // Interpolation ranges — stable as long as wallets list doesn't change
  const accentInputRange = wallets.map((_, i) => i * W);
  const accentColorList  = wallets.map(w => walletAccent(w.currency, w.accentColor));
  const accentSubtleList = wallets.map(w => alpha(walletAccent(w.currency, w.accentColor), 0.1));

  const animatedCircleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollX.value, accentInputRange, accentSubtleList),
  }));

  // Icon color — synced from UI thread to JS state so SVG icons interpolate too
  const [iconAccent, setIconAccent] = useState(accent);
  useAnimatedReaction(
    () => interpolateColor(scrollX.value, accentInputRange, accentColorList),
    (color) => runOnJS(setIconAccent)(color as string),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {wallets.map((wallet, i) => (
        <WalletHeaderGradient key={wallet.id} wallet={wallet} index={i} scrollX={scrollX} />
      ))}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // Allow the inner horizontal FlatList to capture horizontal gestures
        nestedScrollEnabled
      >
        {/* ── Greeting ──────────────────────────────────────────────────── */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingLabel}>Good morning</Text>
            <Text style={styles.greetingName}>{MOCK_PROFILE.name}</Text>
          </View>
          <View style={styles.greetingRight}>
            {walletActionsLayout === 'default' && (
              <FlatButton onPress={handleCustomize} style={styles.customizeBtn}>
                <Settings size={18} color={colors.textSecondary} strokeWidth={1.8} />
              </FlatButton>
            )}
            <SecondaryButton onPress={handleAddWallet} style={styles.addBtn}>
              <Plus size={11} color={colors.textPrimary} strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Wallet</Text>
            </SecondaryButton>
          </View>
        </View>

        {/* ── Wallet carousel + balance overlay ────────────────────────── */}
        {/* The FlatList covers ITEM_H + BALANCE_H so swipes work over the
            digits. The balance is an absolute overlay on the bottom half;
            pointerEvents="box-none" lets swipes pass through to the FlatList
            while the eye-toggle Pressable still intercepts taps. */}
        <View style={styles.carouselWrap}>
          <AnimatedFlatList
            ref={flatListRef}
            data={wallets}
            horizontal
            pagingEnabled
            keyExtractor={(item) => item.id}
            renderItem={renderWallet}
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleCarouselEnd}
            scrollEventThrottle={1}
            style={styles.carousel}
            nestedScrollEnabled
          />

          <View style={styles.balanceOverlay} pointerEvents="box-none">
            {/* equal spacer above digits */}
            <View style={{ flex: 1 }} pointerEvents="none" />

            {/* digits — swipes pass through to FlatList */}
            <View pointerEvents="none">
              {active && (
                <FlipBalance
                  real={formatAmount(active.balance, active.currency)}
                  revealed={!hideBalances}
                />
              )}
            </View>

            {/* equal spacer below digits */}
            <View style={{ flex: 1 }} pointerEvents="none" />

            {/* eye toggle — tappable, pinned at bottom */}
            <FlatButton
              onPress={() => { Haptics.selectionAsync(); toggleHideBalances(); }}
              style={styles.eyeToggle}
            >
              {hideBalances
                ? <EyeOff size={18} color={colors.textSecondary} strokeWidth={1.8} />
                : <Eye    size={18} color={colors.textSecondary} strokeWidth={1.8} />
              }
              <Text style={styles.eyeToggleLabel}>
                {hideBalances ? 'Show balance' : 'Hide balance'}
              </Text>
            </FlatButton>
          </View>
        </View>

        {/* ── Dots ──────────────────────────────────────────────────────── */}
        {wallets.length > 1 && (
          <View style={styles.dotsRow}>
            {wallets.map((wallet, i) => (
              <WalletDot
                key={i}
                index={i}
                scrollX={scrollX}
                accentColor={walletAccent(wallet.currency, wallet.accentColor)}
              />
            ))}
          </View>
        )}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        {walletActionsLayout === 'default' ? (
          <View style={styles.actions}>
            <PrimaryButton onPress={handleSend} style={styles.sendBtn}>
              <View style={styles.actionBtnContent}>
                <ArrowUpRight size={18} color="#441306" strokeWidth={2.2} />
                <Text style={styles.sendBtnLabel}>Send Money</Text>
              </View>
            </PrimaryButton>
            <View style={styles.actionSecondaryRow}>
              <SecondaryButton onPress={handleReceive} style={styles.secondaryBtn}>
                <View style={styles.actionBtnContent}>
                  <ArrowDownLeft size={16} color={colors.textPrimary} strokeWidth={2} />
                  <Text style={styles.secondaryBtnLabel}>Receive</Text>
                </View>
              </SecondaryButton>
              <SecondaryButton onPress={handleStub} style={styles.secondaryBtn}>
                <View style={styles.actionBtnContent}>
                  <CircleDollarSign size={16} color={colors.textPrimary} strokeWidth={2} />
                  <Text style={styles.secondaryBtnLabel}>Top Up</Text>
                </View>
              </SecondaryButton>
            </View>
          </View>
        ) : (
          <View style={styles.quickActions}>
            <ActionBtn
              icon={<ArrowUpRight size={20} color={iconAccent} strokeWidth={2.2} />}
              label="Send"
              onPress={handleSend}
              circleStyle={animatedCircleStyle}
            />
            <ActionBtn
              icon={<ArrowDownLeft size={20} color={iconAccent} strokeWidth={2} />}
              label="Receive"
              onPress={handleReceive}
              circleStyle={animatedCircleStyle}
            />
            <ActionBtn
              icon={<CircleDollarSign size={20} color={iconAccent} strokeWidth={2} />}
              label="Top Up"
              onPress={handleStub}
              circleStyle={animatedCircleStyle}
            />
            <ActionBtn
              icon={<Settings size={20} color={iconAccent} strokeWidth={2} />}
              label="Customize"
              onPress={handleCustomize}
              circleStyle={animatedCircleStyle}
            />
          </View>
        )}

        {/* ── Activity ──────────────────────────────────────────────────── */}
        <View style={styles.activityHead}>
          <Text style={styles.activityLabel}>Recent activity</Text>
        </View>

        {walletTxs.length === 0 ? (
          <EmptyState
            compact
            imageSource={require('../../../assets/No Transactions.png')}
            title="No activity yet"
            subtitle="Send or receive to see transactions here."
          />
        ) : (
          <>
            {previewTxs.map((tx) => (
              <ActivityItem
                key={tx.id}
                tx={tx}
                onPress={() => navigation.navigate('TransactionDetail', { txId: tx.id })}
              />
            ))}
            <SecondaryButton onPress={handleSeeAll} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>See all activity</Text>
            </SecondaryButton>
          </>
        )}

        {/* ── Cards section ─────────────────────────────────────────────── */}
        <View
          style={styles.cardStackSection}
          onLayout={(e) => { cardSectionY.current = e.nativeEvent.layout.y; }}
        >
          <View style={styles.cardHead}>
            <Text style={styles.cardLabel}>Cards</Text>
            <Pressable onPress={handleCards} hitSlop={8}>
              <Text style={[styles.cardViewAll, { color: accent }]}>
                {activeCards.length > 0 ? 'View all  →' : 'New card  →'}
              </Text>
            </Pressable>
          </View>
          <GestureDetector gesture={cardPanGesture}>
            <Animated.View style={[{ position: 'relative' }, cardStackAnimStyle]}>
              {wallets.map((wallet, i) => (
                <View
                  key={wallet.id}
                  style={StyleSheet.absoluteFill}
                  pointerEvents={i === currentIndex ? 'box-none' : 'none'}
                >
                  <AnimatedCardStack
                    walletIndex={i}
                    cards={cardsByWalletId[wallet.id] ?? EMPTY_CARDS}
                    accent={walletAccent(wallet.currency, wallet.accentColor)}
                    onPressCard={handleCardTapAtY}
                    scrollX={scrollX}
                    spreadProgress={spreadProgress}
                    liftProgress={liftProgress}
                    liftedIndex={liftedIndex}
                    playEntrance={
                      justAddedCardId != null &&
                      (cardsByWalletId[wallet.id] ?? EMPTY_CARDS)[0]?.id === justAddedCardId
                    }
                    onEntranceComplete={clearJustAddedCardId}
                  />
                </View>
              ))}
            </Animated.View>
          </GestureDetector>
        </View>

        {/* ── Prototype controls ────────────────────────────────────────── */}
        <View style={styles.protoWrap}>
          <Text style={styles.protoTitle}>⚙  Prototype</Text>
          <WalletSegControl
            label="Actions layout"
            value={walletActionsLayout}
            onChange={(v) => { Haptics.selectionAsync(); if (v !== walletActionsLayout) toggleWalletActionsLayout(); }}
            options={[
              { label: 'Default', value: 'default' },
              { label: 'Quick',   value: 'quick'   },
            ]}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingBottom: 40 },

  // ── Greeting ──
  greetingRow: {
    height: GREETING_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
  },
  greetingLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: typography.semibold,
    marginBottom: 2,
  },
  greetingName: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },
  greetingRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: { fontSize: 11, color: colors.textPrimary, fontWeight: typography.semibold },

  // ── Carousel + balance overlay ──
  // carouselWrap is relative-positioned so the balance overlay can be absolute.
  carouselWrap: { position: 'relative' },

  // FlatList covers the full height (header + balance area) so swipes work
  // anywhere in the region, including over the digit display.
  carousel: { height: ITEM_H + BALANCE_H },

  // Absolute overlay: digits + eye toggle centred in the bottom half.
  // pointerEvents="box-none" is set in JSX so swipes pass through to FlatList.
  balanceOverlay: {
    position: 'absolute',
    top: ITEM_H,
    left: 0,
    right: 0,
    height: BALANCE_H,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 16,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: GREETING_H + ITEM_H + BALANCE_H + 48,
    zIndex: 0,
  },

  walletItem: {
    width: W,
    height: ITEM_H + BALANCE_H,
    paddingHorizontal: H_PAD,
    paddingTop: 14,
    alignItems: 'center',
  },
  primaryChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 10,
  },
  justCreatedChip: {
    backgroundColor: alpha(colors.brand, 0.12),
    borderColor: alpha(colors.brand, 0.34),
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryChipText: { fontSize: 10, fontWeight: typography.semibold, letterSpacing: 0.2 },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  itemFlag: {},
  itemCode: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    letterSpacing: 0.4,
  },
  // ── Per-digit balance flip ──
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: BALANCE_DIGIT_H,
  },
  // Extra chars that slide out from behind the currency symbol
  extraExpand: {
    flexDirection: 'row',
    overflow: 'hidden',
    height: CLIP_H,
    alignItems: 'center',
  },
  balanceDigitCell: {
    width: BALANCE_DIGIT_W,
    height: CLIP_H,
    overflow: 'hidden',
    alignItems: 'center',
    // no justifyContent — drum flows from top so translateY positions correctly
  },
  balanceDigit: {
    fontSize: 44,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    lineHeight: BALANCE_DIGIT_H,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  balanceStatic: {
    fontSize: 44,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    lineHeight: BALANCE_DIGIT_H,
  },
  decorativeCurrencySymbol: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 160,
    lineHeight: 160,
    fontWeight: typography.bold,
    opacity: 0.055,
    // ITEM_H puts us at the top of the balance area; +8 centres on the digit row
    top: ITEM_H + 8,
  },
  eyeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  eyeToggleLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  // ── Dots ──
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 12,
  },
  dot: { height: 5, borderRadius: radius.full },

  // ── Actions ──
  customizeBtn: {
    padding: 6,
  },
  actions: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 10,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 28,
  },
  // ── Prototype ──
  protoWrap: {
    marginHorizontal: H_PAD,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  protoTitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  sendBtn: {
    paddingVertical: 16,
    marginBottom: 4,
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sendBtnLabel: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: '#441306',
  },
  actionSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
  },
  secondaryBtnLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8 },
  actionCircle: {
    width: 50,
    height: 50,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: radius.full,
  },
  actionLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: typography.medium },

  // ── Card stack ──
  cardStackSection: {
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardViewAll: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  animStackContainer: {
    position: 'relative',
    overflow: 'visible',
  },
  cardSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderRadius: radius.xl,
  },
  cardSlotFrontShadow: {
    // Kept small on purpose — a transformed view with a large blurred shadow
    // forces iOS to recompute the shadow shape every animation frame.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardEmpty: {
    height: CARD_HEIGHT,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmptyText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },

  // ── Activity ──
  activityHead: {
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  activityLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  seeAllBtn: {
    marginHorizontal: H_PAD,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

});
