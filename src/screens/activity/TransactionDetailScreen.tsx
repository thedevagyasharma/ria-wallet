import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ArrowUpRight, ArrowDownLeft, LifeBuoy } from 'lucide-react-native';
import SecondaryButton from '../../components/SecondaryButton';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { formatAmount } from '../../data/currencies';
import { CATEGORY_META } from '../../utils/cardCategories';
import type { Transaction } from '../../stores/types';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import {
  StatusBadge,
  RefCopyRow,
  TxSummaryCard,
  TxDetailsList,
  TxTimeline,
  getTxRef,
  isCardTx,
  isIncoming,
  shouldShowTimeline,
} from '../../components/TransactionView';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TransactionDetailScreen({ route }: RootStackProps<'TransactionDetail'>) {
  const { txId } = route.params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, wallets } = useWalletStore();
  const cards = useCardStore((s) => s.cards);

  const tx = transactions.find((t) => t.id === txId);

  if (!tx) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.navbar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.navBackBtn}>
            <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Transaction not found.</Text>
        </View>
      </View>
    );
  }

  const wallet   = wallets.find((w) => w.id === tx.walletId);
  const card     = tx.cardId ? cards.find((c) => c.id === tx.cardId) : undefined;
  const firstName = tx.recipientName.split(' ')[0];
  const incoming = isIncoming(tx);
  const isCard   = isCardTx(tx);
  const formattedAmount = formatAmount(Math.abs(tx.amount), tx.currency);

  const heroLabel = isCard
    ? tx.recipientName
    : incoming ? `Received from ${tx.recipientName}` : `Sent to ${firstName}`;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.navBackBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.navTitle}>Transaction Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 80 + insets.bottom + spacing.lg },
        ]}
      >
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <HeroAvatar tx={tx} />

          <Text style={styles.heroAmount}>
            {incoming ? '+' : '−'}{formattedAmount}
          </Text>
          <Text style={styles.heroSub}>{heroLabel}</Text>

          <StatusBadge variant={tx.status} />

          <View style={styles.refWrap}>
            <RefCopyRow refValue={getTxRef(tx)} />
          </View>
        </View>

        {/* ── Failed — refund notice ─────────────────────────────────── */}
        {tx.status === 'failed' && (
          <View style={styles.refundBanner}>
            <Text style={styles.refundText}>
              Your funds were not deducted. If you believe this is an error, use the button below to get help.
            </Text>
          </View>
        )}

        {/* ── Section: Summary (P2P with full breakdown) ────────────── */}
        {!isCard && !incoming && tx.fee !== undefined && (
          <View style={styles.summaryWrap}>
            <TxSummaryCard tx={tx} />
          </View>
        )}

        {/* ── Section: Details (flat per DECISIONS.md #144) ─────────── */}
        <View style={[styles.section, !shouldShowTimeline(tx) && styles.sectionLast]}>
          <Text style={styles.sectionLabel}>Details</Text>
          <TxDetailsList tx={tx} wallet={wallet} card={card} />
        </View>

        {/* ── Section: Timeline (outgoing P2P only) ─────────────────── */}
        {shouldShowTimeline(tx) && (
          <View style={[styles.section, styles.sectionLast]}>
            <Text style={styles.sectionLabel}>Transfer status</Text>
            <TxTimeline status={tx.status} firstName={firstName} />
          </View>
        )}
      </ScrollView>

      {/* ── Sticky footer — always available ───────────────────────── */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <SecondaryButton onPress={() => {}} style={styles.supportBtn}>
          <LifeBuoy size={16} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.supportBtnText}>Get help with this transaction</Text>
        </SecondaryButton>
      </View>
    </View>
  );
}

// ─── Hero avatar (direction arrow for P2P, category icon for card) ────────────

function HeroAvatar({ tx }: { tx: Transaction }) {
  const incoming = isIncoming(tx);
  const isCard   = isCardTx(tx);

  if (isCard) {
    const meta = CATEGORY_META[tx.category ?? 'other'];
    const { Icon, iconColor, bgColor } = meta;
    return (
      <View style={[styles.heroAvatar, { backgroundColor: bgColor }]}>
        <Icon size={24} color={iconColor} strokeWidth={2} />
      </View>
    );
  }

  return (
    <View style={[
      styles.heroAvatar,
      { backgroundColor: incoming ? colors.successSubtle : colors.surface },
    ]}>
      {incoming
        ? <ArrowDownLeft size={24} color={colors.success} strokeWidth={2} />
        : <ArrowUpRight  size={24} color={colors.brand}   strokeWidth={2} />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const H_PAD = 24;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingVertical: spacing.md,
  },
  navBackBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -6,
  },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: typography.md, fontWeight: typography.semibold, color: colors.textPrimary,
  },

  scroll: { paddingTop: spacing.sm },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  heroAvatar: {
    width: 52, height: 52, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroAmount: {
    fontSize: typography.xxl, fontWeight: typography.bold,
    color: colors.textPrimary, letterSpacing: -1,
  },
  heroSub: { fontSize: typography.sm, color: colors.textSecondary },

  refWrap: { alignSelf: 'stretch', marginTop: spacing.md },

  // ── Summary (boxed — single summary artefact per DECISIONS.md #144) ──
  summaryWrap: { paddingHorizontal: H_PAD, marginBottom: spacing.lg },

  // ── Sections (flat per DECISIONS.md #144) ──
  section: {
    paddingHorizontal: H_PAD,
    paddingBottom: spacing.xl,
    marginBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sectionLast: {
    paddingBottom: 0,
    marginBottom: spacing.lg,
    borderBottomWidth: 0,
  },
  sectionLabel: {
    fontSize: typography.xs, color: colors.textSecondary,
    fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },

  // ── Failed refund banner ──
  refundBanner: {
    backgroundColor: colors.failedSubtle,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.failed + '33',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginHorizontal: H_PAD,
    marginBottom: spacing.md,
  },
  refundText: { fontSize: typography.sm, color: colors.failed, lineHeight: 20 },

  // ── Sticky footer ──
  stickyFooter: {
    paddingHorizontal: H_PAD,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  supportBtnText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },

  // ── Not found ──
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: typography.base, color: colors.textMuted },
});
