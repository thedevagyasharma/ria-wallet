import React, { useState, useCallback, useRef, useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  withTiming,
  withDelay,
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
import TransactionRow from '../../components/TransactionRow';
import FlatButton from '../../components/FlatButton';
import StackCardFace, { STACK_CARD_H, STACK_V_OFFSET } from '../../components/StackCardFace';
import type { RootStackParamList } from '../../navigation/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';
import type { Transaction, Wallet, Card } from '../../stores/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: W } = Dimensions.get('window');
const H_PAD = 24;

const GREETING_H      = 52;
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

function WalletItem({ wallet }: { wallet: Wallet }) {
  const currency = getCurrency(wallet.currency);
  const accent   = walletAccent(wallet.currency, wallet.accentColor);

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
        <View style={styles.primaryChipPlaceholder} />
      )}

      <View style={styles.currencyRow}>
        <Text style={styles.itemFlag}>{currency.flag}</Text>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.5 }]}>
      <Animated.View style={[styles.actionCircle, circleStyle]}>{icon}</Animated.View>
      <Text style={styles.actionLabel}>{label}</Text>
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


// Container height for n visible cards
function stackH(n: number): number {
  return n <= 1 ? STACK_CARD_H : STACK_CARD_H + STACK_V_OFFSET * (n - 1);
}

// translateY for slot i in an n-card stack (front card = largest offset = bottom)
// Must be a worklet — called from useAnimatedStyle callbacks on the UI thread.
function slotTargetY(i: number, n: number): number {
  'worklet';
  return n <= 1 ? 0 : (n - 1 - i) * STACK_V_OFFSET;
}

function AnimatedCardStack({ walletIndex, cards, accent, onPress, scrollX }: {
  walletIndex: number;
  cards: Card[];
  accent: string;
  onPress: () => void;
  scrollX: SharedValue<number>;
}) {
  const n = Math.min(cards.length, CARD_SLOTS);

  // st = signed distance from this wallet's centre in wallet-widths.
  // visible = this stack's active region: hard-cut at ±0.5, no scroll-linked fade.
  // p  = stagger progress: 0 = fully staggered, 1 = fully collapsed.

  // Slot 0 — front card (or empty-state placeholder when n=0)
  const as0 = useAnimatedStyle(() => {
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    const p = Math.min(Math.abs(st) * 2, 1);
    return {
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: (n > 0 ? slotTargetY(0, n) : 0) * (1 - p) },
        { scale: 1 },
      ],
    };
  });

  // Slot 1
  const as1 = useAnimatedStyle(() => {
    if (n <= 1) return { opacity: 0, transform: [{ translateY: 0 }, { scale: 1 }] };
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    const p = Math.min(Math.abs(st) * 2, 1);
    return {
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: slotTargetY(1, n) * (1 - p) },
        { scale: 1 - 0.02 * (1 - p) },
      ],
    };
  });

  // Slot 2
  const as2 = useAnimatedStyle(() => {
    if (n <= 2) return { opacity: 0, transform: [{ translateY: 0 }, { scale: 1 }] };
    const st = scrollX.value / W - walletIndex;
    const visible = st > -0.5 && st < 0.5;
    const p = Math.min(Math.abs(st) * 2, 1);
    return {
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: slotTargetY(2, n) * (1 - p) },
        { scale: 1 - 0.04 * (1 - p) },
      ],
    };
  });

  const animStyles = [as0, as1, as2];

  return (
    <Pressable onPress={onPress} style={StyleSheet.absoluteFill}>
      {n === 0 ? (
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: STACK_CARD_H }, as0]}>
          <View style={[styles.cardEmpty, { borderColor: alpha(accent, 0.25), backgroundColor: alpha(accent, 0.04) }]}>
            <Text style={[styles.cardEmptyText, { color: accent }]}>+ Add your first card</Text>
          </View>
        </Animated.View>
      ) : (
        cards.slice(0, n).map((card, idx) => (
          <Animated.View
            key={card.id}
            style={[styles.cardSlot, { zIndex: n - idx, borderColor: alpha(card.color, 0.06) }, animStyles[idx]]}
          >
            <StackCardFace card={card} showLast4={idx === 0} />
          </Animated.View>
        ))
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WalletsScreen() {
  const navigation = useNavigation<Nav>();
  const { wallets, transactions, setActiveWallet } = useWalletStore();
  const { getWalletCards } = useCardStore();
  const { hideBalances, toggleHideBalances } = usePrefsStore();

  const startIdx = wallets.findIndex((w) => w.isPrimary);
  const [currentIndex, setCurrentIndex] = useState(startIdx >= 0 ? startIdx : 0);
  // Track the last index we fired for so onScroll doesn't double-fire.
  const pendingIdx = useRef(startIdx >= 0 ? startIdx : 0);
  const flatListRef = useRef<FlatList<Wallet>>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollReset = useTabScrollReset();
  const scrollX = useSharedValue(startIdx >= 0 ? startIdx * W : 0);

  useEffect(() => {
    if (scrollReset > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollReset]);

  const active      = wallets[currentIndex] ?? wallets[0];
  const activeCards = active ? getWalletCards(active.id) : [];
  const accent      = walletAccent(active?.currency ?? 'USD', active?.accentColor);
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
    new RNAnimated.Value(stackH(Math.min(activeCards.length, CARD_SLOTS)))
  ).current;

  // Keep height in sync when cards are added/removed on the active wallet.
  useEffect(() => {
    cardStackHeightAnim.setValue(stackH(Math.min(activeCards.length, CARD_SLOTS)));
  }, [activeCards.length]);

  // JS-thread side-effects: state updates + haptics (called via runOnJS)
  const handleScrollJS = useCallback((x: number) => {
    const nearest = Math.max(0, Math.min(Math.round(x / W), wallets.length - 1));
    if (nearest !== pendingIdx.current) {
      pendingIdx.current = nearest;
      // Reserve the new wallet's full stack height now — cards are fully collapsed
      // at the midpoint so this setValue is invisible to the user.
      const n = Math.min(getWalletCards(wallets[nearest].id).length, CARD_SLOTS);
      cardStackHeightAnim.setValue(stackH(n));
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
    ({ item }: ListRenderItemInfo<Wallet>) => <WalletItem wallet={item} />,
    [],
  );

  const handleSend       = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); if (active) navigation.navigate('SendMoney', { walletId: active.id }); }, [active, navigation]);
  const handleCards      = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  if (active) navigation.navigate('WalletCardList', { walletId: active.id }); }, [active, navigation]);
  const handleCustomize  = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  if (active) navigation.navigate('WalletSettings', { walletId: active.id }); }, [active, navigation]);
  const handleStub       = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), []);
  const handleAddWallet  = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('CurrencyPicker'); }, [navigation]);
  const handleSeeAll     = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (active) navigation.navigate('Activity', { walletId: active.id }); }, [active, navigation]);

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
              <Plus size={11} color={colors.textMuted} strokeWidth={2.5} />
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
        <View style={styles.cardStackSection}>
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
                  cards={getWalletCards(wallet.id)}
                  accent={walletAccent(wallet.currency, wallet.accentColor)}
                  onPress={handleCards}
                  scrollX={scrollX}
                />
              </View>
            ))}
          </RNAnimated.View>
        </View>

        {/* ── Activity ──────────────────────────────────────────────────── */}
        <View style={styles.activityHead}>
          <Text style={styles.activityLabel}>Activity</Text>
        </View>

        {walletTxs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySub}>Send or receive to see transactions here.</Text>
          </View>
        ) : (
          <>
            {previewTxs.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onPress={() => navigation.navigate('TransactionDetail', { txId: tx.id })} />
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
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: typography.medium,
    marginBottom: 1,
  },
  greetingName: {
    fontSize: typography.md,
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
  addBtnText: { fontSize: 11, color: colors.textMuted, fontWeight: typography.medium },

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
  primaryChipPlaceholder: {
    height: 22,
    marginBottom: 10,
  },
  primaryChipText: { fontSize: 10, fontWeight: typography.semibold, letterSpacing: 0.2 },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  itemFlag: { fontSize: 20 },
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
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
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
    height: STACK_CARD_H,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  cardEmpty: {
    height: STACK_CARD_H,
    borderRadius: radius.lg,
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
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  seeAllBtn: {
    marginHorizontal: H_PAD,
    marginTop: 4,
    marginBottom: 8,
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
