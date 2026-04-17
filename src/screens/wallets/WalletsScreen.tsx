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
  Animated as RNAnimated,
  InteractionManager,
  ListRenderItemInfo,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Wallet>);
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { alpha } from '../../utils/color';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { usePrefsStore } from '../../stores/usePrefsStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import SecondaryButton from '../../components/SecondaryButton';
import ActivityItem from '../../components/ActivityItem';
import FlatButton from '../../components/FlatButton';
import { CardFront, MoreCardsPlaceholder, CARD_HEIGHT, STACK_V_OFFSET } from '../../components/CardFace';
import FlagIcon from '../../components/FlagIcon';
import type { RootStackParamList } from '../../navigation/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';
import type { Transaction, Wallet, Card } from '../../stores/types';

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

// ─── Liquid dot — width tracks scroll position, color is the wallet's own accent ─

const DOT_W_INACTIVE = 5;
const DOT_W_ACTIVE   = 18;

function WalletDot({ index, scrollX, accentColor }: {
  index: number;
  scrollX: SharedValue<number>;
  accentColor: string;
}) {
  const inactive = colors.border;
  const dotStyle = useAnimatedStyle(() => {
    const t = Math.max(0, 1 - Math.abs(scrollX.value / W - index));
    return {
      width: DOT_W_INACTIVE + (DOT_W_ACTIVE - DOT_W_INACTIVE) * t,
      backgroundColor: interpolateColor(t, [0, 1], [inactive, accentColor]),
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

// ─── Animated card stack ─────────────────────────────────────────────────────
//
// Purely scrollX-driven: no state, no timers, no data swapping.
// One AnimatedCardStack is rendered per wallet, all absolutely layered.
//
// t = |scrollX/W - walletIndex|  →  0 when this wallet is centred, 0.5 at the
//                                    midpoint between this wallet and the next
// p = clamp(t * 2, 0, 1)         →  stagger progress: 0 = full stagger,
//                                    1 = fully collapsed & transparent
//
// As p → 1: cards slide to ty=0, scale to 1:1, opacity to 0.
// As p → 0: cards spring to staggered positions, natural scale, opacity 1.
//
// The incoming wallet's stack is always rendered at ty=0 underneath the
// outgoing one, so at the swap point (p=1, opacity=0) the new front card is
// already present — no JS race, no flash.

const CARD_SLOTS = 3;

// Stable empty fallback for wallets with no cards — avoids allocating a fresh
// [] reference each render, which would bust AnimatedCardStack's memo.
const EMPTY_CARDS: Card[] = [];


// Total visual slots: real cards (capped at CARD_SLOTS) + 1 if there's overflow.
// The overflow slot is a "+N more" placeholder peeking out at the back of the stack.
function visibleSlots(cardCount: number): number {
  const real = Math.min(cardCount, CARD_SLOTS);
  return real + (cardCount > CARD_SLOTS ? 1 : 0);
}

// Container height for n visible cards
function stackH(n: number): number {
  return n <= 1 ? CARD_HEIGHT : CARD_HEIGHT + STACK_V_OFFSET * (n - 1);
}

// translateY for slot i in an n-card stack (front card = largest offset = bottom)
// Must be a worklet — called from useAnimatedStyle callbacks on the UI thread.
function slotTargetY(i: number, n: number): number {
  'worklet';
  return n <= 1 ? 0 : (n - 1 - i) * STACK_V_OFFSET;
}

// Press feedback — mirrored in CardStackPreview so motion is identical across both entry points.
const PRESS_LIFT      = 6;
const PRESS_SCALE     = 0.025;
const PRESS_DEPTH     = [1, 0.55, 0.25];
const PRESS_IN_MS     = 140;
const PRESS_OUT_MS    = 180;

// Memoized so a parent re-render (e.g. setCurrentIndex fired inside the
// justAddedCardId effect) doesn't recreate this component's useAnimatedStyle
// closures mid-entrance — Reanimated rebinding those worklets in the middle of
// a withTiming causes a visible frame drop during the land-in settle.
const AnimatedCardStack = React.memo(function AnimatedCardStack({ walletIndex, cards, accent, onPress, scrollX, playEntrance, onEntranceComplete }: {
  walletIndex: number;
  cards: Card[];
  accent: string;
  onPress: () => void;
  scrollX: SharedValue<number>;
  playEntrance?: boolean;
  onEntranceComplete?: () => void;
}) {
  // realN  = real cards rendered (capped at CARD_SLOTS)
  // overflow = remaining count shown in the "+N more" placeholder
  // slotN  = total visual slots (real + placeholder if any) — drives stagger geometry
  const realN = Math.min(cards.length, CARD_SLOTS);
  const overflow = Math.max(0, cards.length - CARD_SLOTS);
  const slotN = realN + (overflow > 0 ? 1 : 0);

  const pressProgress = useSharedValue(0);

  // Land-in animation for a newly-added card. Slot 0 starts lifted & scaled up
  // (card arriving from above), and the settle starts once all concurrent
  // native work (stack pop, tab slide, balance-drum animations) has finished —
  // otherwise the settle drops frames as Reanimated's UI thread competes with
  // that work. InteractionManager.runAfterInteractions is the mechanism RN
  // provides for exactly this "wait until things quiet down" case.
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

  // st = signed distance from this wallet's centre in wallet-widths.
  // visible = this stack's active region: hard-cut at ±0.5, no scroll-linked fade.
  // p  = stagger progress: 0 = fully staggered, 1 = fully collapsed.
  // pp = press progress scaled by the slot's depth multiplier (front moves most).

  // Slot 0 — front card (or empty-state placeholder when slotN=0).
  // entranceProgress adds a lift+upscale on top of the resting transform so the
  // newly-added card appears "arriving from above" before it settles into place.
  const as0 = useAnimatedStyle(() => {
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    const p = Math.min(Math.abs(st) * 2, 1);
    const pp = pressProgress.value * PRESS_DEPTH[0];
    const ev = entranceProgress.value;
    return {
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: (slotN > 0 ? slotTargetY(0, slotN) : 0) * (1 - p) - pp * PRESS_LIFT - ev * 40 },
        { scale: (1 + pp * PRESS_SCALE) * (1 + ev * 0.06) },
      ],
    };
  });

  // Slot 1
  const as1 = useAnimatedStyle(() => {
    if (slotN <= 1) return { opacity: 0, transform: [{ translateY: 0 }, { scale: 1 }] };
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    const p = Math.min(Math.abs(st) * 2, 1);
    const pp = pressProgress.value * PRESS_DEPTH[1];
    return {
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: slotTargetY(1, slotN) * (1 - p) - pp * PRESS_LIFT },
        { scale: (1 - 0.02 * (1 - p)) * (1 + pp * PRESS_SCALE) },
      ],
    };
  });

  // Slot 2
  const as2 = useAnimatedStyle(() => {
    if (slotN <= 2) return { opacity: 0, transform: [{ translateY: 0 }, { scale: 1 }] };
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    const p = Math.min(Math.abs(st) * 2, 1);
    const pp = pressProgress.value * PRESS_DEPTH[2];
    return {
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: slotTargetY(2, slotN) * (1 - p) - pp * PRESS_LIFT },
        { scale: (1 - 0.04 * (1 - p)) * (1 + pp * PRESS_SCALE) },
      ],
    };
  });

  // Slot 3 — "+N more" placeholder. Only renders when overflow > 0.
  // Press depth = 0 so it stays static while real cards lift — reads as a backplate.
  const as3 = useAnimatedStyle(() => {
    if (slotN <= 3) return { opacity: 0, transform: [{ translateY: 0 }, { scale: 1 }] };
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    const p = Math.min(Math.abs(st) * 2, 1);
    return {
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: slotTargetY(3, slotN) * (1 - p) },
        { scale: 1 - 0.06 * (1 - p) },
      ],
    };
  });

  const handlePressIn = () => {
    pressProgress.value = withTiming(1, { duration: PRESS_IN_MS, easing: Easing.out(Easing.cubic) });
  };

  const handlePressOut = () => {
    pressProgress.value = withTiming(0, { duration: PRESS_OUT_MS, easing: Easing.out(Easing.cubic) });
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPress={onPress}
      onPressOut={handlePressOut}
      pressRetentionOffset={{ top: 40, left: 40, right: 40, bottom: 40 }}
      style={StyleSheet.absoluteFill}
    >
      {realN === 0 ? (
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: CARD_HEIGHT }, as0]}>
          <View style={[styles.cardEmpty, { borderColor: alpha(accent, 0.25), backgroundColor: alpha(accent, 0.04) }]}>
            <Text style={[styles.cardEmptyText, { color: accent }]}>+ Add your first card</Text>
          </View>
        </Animated.View>
      ) : (
        <>
          {cards.slice(0, realN).map((card, idx) => {
            const animStyle = idx === 0 ? as0 : idx === 1 ? as1 : as2;
            return (
              <Animated.View
                key={card.id}
                style={[
                  styles.cardSlot,
                  idx === 0 && styles.cardSlotFrontShadow,
                  { zIndex: slotN - idx },
                  animStyle,
                ]}
              >
                <CardFront card={card} compact />
              </Animated.View>
            );
          })}
          {overflow > 0 && (
            <Animated.View
              key="more-placeholder"
              style={[styles.cardSlot, { zIndex: slotN - 3 }, as3]}
            >
              <MoreCardsPlaceholder count={overflow} />
            </Animated.View>
          )}
        </>
      )}
    </Pressable>
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
  const { hideBalances, toggleHideBalances } = usePrefsStore();

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

  const active      = wallets[currentIndex] ?? wallets[0];
  const activeCards = active ? getWalletCards(active.id) : [];
  const accent      = walletAccent(active?.currency ?? 'USD', active?.accentColor);

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

  // Card stack container height — RNAnimated.Value drives layout so the ScrollView
  // sees the change and the activity section moves smoothly.
  //
  // The height is updated exactly once per wallet switch, at the midpoint where
  // all cards are fully collapsed (p=1). At that instant the change is invisible,
  // so the new wallet's full height is "reserved" before the cards begin to
  // unstagger — no overflow, no jitter, no per-frame bridge calls.
  const cardStackHeightAnim = useRef(
    new RNAnimated.Value(stackH(visibleSlots(activeCards.length)))
  ).current;

  // Keep height in sync when cards are added/removed on the active wallet.
  useEffect(() => {
    cardStackHeightAnim.setValue(stackH(visibleSlots(activeCards.length)));
  }, [activeCards.length]);

  // JS-thread side-effects: state updates + haptics (called via runOnJS)
  const handleScrollJS = useCallback((x: number) => {
    const nearest = Math.max(0, Math.min(Math.round(x / W), wallets.length - 1));
    if (nearest !== pendingIdx.current) {
      pendingIdx.current = nearest;
      // Reserve the new wallet's full stack height now — cards are fully collapsed
      // at the midpoint so this setValue is invisible to the user.
      cardStackHeightAnim.setValue(stackH(visibleSlots(getWalletCards(wallets[nearest].id).length)));
      setCurrentIndex(nearest);
      setActiveWallet(wallets[nearest].id);
      Haptics.selectionAsync();
    }
  }, [wallets, setActiveWallet, getWalletCards, cardStackHeightAnim]);

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
  const handleStub       = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), []);
  const handleAddWallet  = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('CurrencyPicker'); }, [navigation]);
  const handleSeeAll     = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); const w = activeRef.current; if (w) navigation.navigate('Activity', { walletId: w.id }); }, [navigation]);

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
            <Text style={styles.greetingName}>Carlos Mendez</Text>
          </View>
          <View style={styles.greetingRight}>
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
        <View style={styles.actions}>
          <ActionBtn icon={<ArrowUpRight      size={22} color={iconAccent} strokeWidth={1.8} />} label="Send"      onPress={handleSend}      circleStyle={animatedCircleStyle} />
          <ActionBtn icon={<ArrowDownLeft    size={22} color={iconAccent} strokeWidth={1.8} />} label="Receive"   onPress={handleStub}      circleStyle={animatedCircleStyle} />
          <ActionBtn icon={<Plus             size={22} color={iconAccent} strokeWidth={1.8} />} label="Add"       onPress={handleStub}      circleStyle={animatedCircleStyle} />
          <ActionBtn icon={<SlidersHorizontal size={22} color={iconAccent} strokeWidth={1.8} />} label="Customize" onPress={handleCustomize} circleStyle={animatedCircleStyle} />
        </View>

        {/* ── Cards section ─────────────────────────────────────────────── */}
        <View
          style={styles.cardStackSection}
          onLayout={(e) => { cardSectionY.current = e.nativeEvent.layout.y; }}
        >
          <View style={styles.cardHead}>
            <Text style={styles.cardLabel}>Cards</Text>
            <Pressable onPress={handleCards} hitSlop={8}>
              <Text style={[styles.cardViewAll, { color: accent }]}>
                {activeCards.length > 0 ? 'View all  →' : 'Add card  →'}
              </Text>
            </Pressable>
          </View>
          {/* One stack per wallet, all absolutely layered — scrollX drives each one */}
          <RNAnimated.View style={{ height: cardStackHeightAnim, position: 'relative' }}>
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
                  onPress={handleCards}
                  scrollX={scrollX}
                  playEntrance={
                    justAddedCardId != null &&
                    (cardsByWalletId[wallet.id] ?? EMPTY_CARDS)[0]?.id === justAddedCardId
                  }
                  onEntranceComplete={clearJustAddedCardId}
                />
              </View>
            ))}
          </RNAnimated.View>
        </View>

        {/* ── Activity ──────────────────────────────────────────────────── */}
        <View style={styles.activityHead}>
          <Text style={styles.activityLabel}>Recent activity</Text>
        </View>

        {walletTxs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySub}>Send or receive to see transactions here.</Text>
          </View>
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
  actions: {
    flexDirection: 'row',
    paddingHorizontal: H_PAD,
    paddingBottom: 28,
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

  empty: { paddingTop: spacing.xxxl, paddingHorizontal: H_PAD, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: typography.base, color: colors.textSecondary, fontWeight: typography.medium },
  emptySub: { fontSize: typography.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
