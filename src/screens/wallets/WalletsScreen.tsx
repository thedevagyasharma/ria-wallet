import React, { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
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

const GREETING_H = 52;
const ITEM_H     = 196;

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

// ─── Wallet item ──────────────────────────────────────────────────────────────

function WalletItem({ wallet, cardCount }: { wallet: Wallet; cardCount: number }) {
  const currency  = getCurrency(wallet.currency);
  const accent    = walletAccent(wallet.currency);
  const formatted = formatAmount(wallet.balance, wallet.currency);

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
        <Text style={styles.itemCode}>{currency.code}</Text>
      </View>

      <Text
        style={styles.balanceAmount}
        adjustsFontSizeToFit
        numberOfLines={1}
        minimumFontScale={0.5}
      >
        {formatted}
      </Text>

      <Text style={styles.linkedText}>
        {cardCount === 0 ? 'No cards linked' : `${cardCount} ${cardCount === 1 ? 'card' : 'cards'} linked`}
      </Text>
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

  const startIdx = wallets.findIndex((w) => w.isPrimary);
  const [currentIndex, setCurrentIndex] = useState(startIdx >= 0 ? startIdx : 0);
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

  const handleCarouselEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / W);
      const clamped = Math.max(0, Math.min(idx, wallets.length - 1));
      if (clamped !== currentIndex) {
        setCurrentIndex(clamped);
        setActiveWallet(wallets[clamped].id);
        Haptics.selectionAsync();
      }
    },
    [wallets, currentIndex, setActiveWallet],
  );

  const renderWallet = useCallback(
    ({ item }: ListRenderItemInfo<Wallet>) =>
      <WalletItem wallet={item} cardCount={getWalletCards(item.id).length} />,
    [getWalletCards],
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

        {/* ── Wallet carousel ───────────────────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={wallets}
          horizontal
          pagingEnabled
          keyExtractor={(item) => item.id}
          renderItem={renderWallet}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleCarouselEnd}
          scrollEventThrottle={16}
          style={styles.carousel}
          nestedScrollEnabled
        />

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

  // ── Carousel ──
  carousel: { height: ITEM_H },

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
    marginBottom: 14,
  },
  primaryChipPlaceholder: {
    height: 22,
    marginBottom: 14,
  },
  primaryChipText: { fontSize: 10, fontWeight: typography.semibold, letterSpacing: 0.2 },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 18,
  },
  itemFlag: { fontSize: 20 },
  itemCode: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    letterSpacing: 0.4,
  },
  balanceAmount: {
    fontSize: 44,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    letterSpacing: -1.5,
    lineHeight: 50,
    textAlign: 'center',
    width: '100%',
  },
  linkedText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 12,
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
