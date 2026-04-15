import React, { useState, useCallback, useRef, useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  Dimensions,
  ListRenderItemInfo,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  CreditCard,
  UserCircle,
  Eye,
  EyeOff,
} from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { usePrefsStore } from '../../stores/usePrefsStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import StatusChip from '../../components/StatusChip';
import SecondaryButton from '../../components/SecondaryButton';
import CardStackPreview from '../../components/CardStackPreview';
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
function walletAccent(c: string) { return WALLET_ACCENTS[c] ?? colors.brand; }
function alpha(hex: string, o: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${o})`;
}

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
function drumY(d: string) { return -(parseInt(d, 10) + 1) * BALANCE_DIGIT_H; }

function BalanceDrumChar({ actual, revealed, delay }: {
  actual: string; revealed: boolean; delay: number;
}) {
  const y = useSharedValue(revealed ? drumY(actual) : 0);

  useEffect(() => {
    y.value = withDelay(
      delay,
      withTiming(revealed ? drumY(actual) : 0, { duration: 340, easing: Easing.out(Easing.cubic) }),
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
  const accent   = walletAccent(wallet.currency);

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
    </View>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  icon, label, onPress, accent,
}: { icon: React.ReactNode; label: string; onPress: () => void; accent: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.5 }]}>
      <View style={[styles.actionCircle, { backgroundColor: alpha(accent, 0.1) }]}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit  = tx.amount > 0;
  const formatted = formatAmount(Math.abs(tx.amount), tx.currency);
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(tx.date);
  return (
    <View style={styles.txRow}>
      <View style={styles.txAvatar}>
        <Text style={styles.txAvatarText}>{tx.recipientName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.txMiddle}>
        <Text style={styles.txName}>{tx.recipientName}</Text>
        <View style={styles.txMeta}>
          <StatusChip status={tx.status} />
          <Text style={styles.txDate}>{date}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: isCredit ? colors.success : colors.textPrimary }]}>
        {isCredit ? '+' : '−'}{formatted}
      </Text>
    </View>
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
  useEffect(() => {
    if (scrollReset > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollReset]);

  const active      = wallets[currentIndex] ?? wallets[0];
  const accent      = walletAccent(active?.currency ?? 'USD');
  const activeCards = active ? getWalletCards(active.id) : [];
  const walletTxs   = transactions
    .filter((t) => t.walletId === active?.id)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const previewTxs = walletTxs.slice(0, MAX_PREVIEW_TXS);

  // Fires every frame during the swipe. Updates currentIndex (and thus the
  // balance flipKey) the moment the user crosses the midpoint — no waiting
  // for the snap to complete.
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const nearest = Math.max(0, Math.min(Math.round(x / W), wallets.length - 1));
      if (nearest !== pendingIdx.current) {
        pendingIdx.current = nearest;
        setCurrentIndex(nearest);
        setActiveWallet(wallets[nearest].id);
        Haptics.selectionAsync();
      }
    },
    [wallets, setActiveWallet],
  );

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

  const handleSend      = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); if (active) navigation.navigate('SendMoney', { walletId: active.id }); }, [active, navigation]);
  const handleCards     = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  if (active) navigation.navigate('WalletCardList', { walletId: active.id }); }, [active, navigation]);
  const handleStub      = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), []);
  const handleAddWallet = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('CurrencyPicker'); }, [navigation]);
  const handleSeeAll    = useCallback(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (active) navigation.navigate('Activity', { walletId: active.id }); }, [active, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
            <Pressable hitSlop={8}>
              <UserCircle size={28} color={colors.textMuted} strokeWidth={1.5} />
            </Pressable>
          </View>
        </View>

        {/* ── Wallet carousel + balance overlay ────────────────────────── */}
        {/* The FlatList covers ITEM_H + BALANCE_H so swipes work over the
            digits. The balance is an absolute overlay on the bottom half;
            pointerEvents="box-none" lets swipes pass through to the FlatList
            while the eye-toggle Pressable still intercepts taps. */}
        <View style={styles.carouselWrap}>
          <FlatList
            ref={flatListRef}
            data={wallets}
            horizontal
            pagingEnabled
            keyExtractor={(item) => item.id}
            renderItem={renderWallet}
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleCarouselEnd}
            scrollEventThrottle={16}
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
            <Pressable
              onPress={() => { Haptics.selectionAsync(); toggleHideBalances(); }}
              style={({ pressed }) => [styles.eyeToggle, pressed && { opacity: 0.5 }]}
            >
              {hideBalances
                ? <EyeOff size={18} color={colors.textSecondary} strokeWidth={1.8} />
                : <Eye    size={18} color={colors.textSecondary} strokeWidth={1.8} />
              }
              <Text style={styles.eyeToggleLabel}>
                {hideBalances ? 'Show balance' : 'Hide balance'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Dots ──────────────────────────────────────────────────────── */}
        {wallets.length > 1 && (
          <View style={styles.dotsRow}>
            {wallets.map((_, i) => (
              <View key={i} style={[
                styles.dot,
                i === currentIndex
                  ? [styles.dotActive, { backgroundColor: accent }]
                  : styles.dotInactive,
              ]} />
            ))}
          </View>
        )}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <View style={styles.actions}>
          <ActionBtn icon={<ArrowUpRight  size={22} color={accent} strokeWidth={1.8} />} label="Send"    onPress={handleSend}  accent={accent} />
          <ActionBtn icon={<ArrowDownLeft size={22} color={accent} strokeWidth={1.8} />} label="Receive" onPress={handleStub}  accent={accent} />
          <ActionBtn icon={<Plus          size={22} color={accent} strokeWidth={1.8} />} label="Add"     onPress={handleStub}  accent={accent} />
          <ActionBtn icon={<CreditCard    size={22} color={accent} strokeWidth={1.8} />} label="Cards"   onPress={handleCards} accent={accent} />
        </View>

        {/* ── Cards section ─────────────────────────────────────────────── */}
        <View style={styles.cardStackSection}>
          <CardStackPreview
            cards={activeCards}
            accent={accent}
            onPress={handleCards}
          />
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
            {previewTxs.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
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

  scroll: { flex: 1 },
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

  walletItem: {
    width: W,
    height: ITEM_H,
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
    height: BALANCE_DIGIT_H,
    alignItems: 'center',
  },
  balanceDigitCell: {
    width: BALANCE_DIGIT_W,
    height: BALANCE_DIGIT_H,
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
  eyeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
  dot: { height: 3, borderRadius: radius.full },
  dotActive: { width: 14 },
  dotInactive: { width: 3, backgroundColor: colors.border },

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

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: H_PAD,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  txAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txAvatarText: { fontSize: typography.base, color: colors.textSecondary, fontWeight: typography.semibold },
  txMiddle: { flex: 1 },
  txName: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium, marginBottom: 3 },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  txDate: { fontSize: typography.xs, color: colors.textMuted },
  txAmount: { fontSize: typography.base, fontWeight: typography.semibold },

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
