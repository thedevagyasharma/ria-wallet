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
import { getCurrency, formatAmount } from '../../data/currencies';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { TransactionStatus } from '../../stores/types';
import { StepRow } from '../../components/TransferSteps';
import type { Step } from '../../components/TransferSteps';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Build steps from transaction status ─────────────────────────────────────

function buildSteps(status: TransactionStatus, firstName: string): Step[] {
  if (status === 'completed') {
    return [
      { label: 'Transfer initiated',                  sub: 'Confirmed — funds reserved', status: 'done' },
      { label: 'Processing transfer',                  sub: 'Completed',                  status: 'done' },
      { label: `${firstName} received funds`,          sub: 'Delivered',                  status: 'done' },
    ];
  }
  if (status === 'pending') {
    return [
      { label: 'Transfer initiated',                  sub: 'Confirmed — funds reserved', status: 'done'    },
      { label: 'Processing transfer',                  sub: 'In progress…',               status: 'active'  },
      { label: `${firstName} receives funds`,          sub: 'Awaiting delivery',          status: 'pending' },
    ];
  }
  // failed
  return [
    { label: 'Transfer initiated',                    sub: 'Confirmed — funds reserved', status: 'done'    },
    { label: 'Processing transfer',                   sub: 'Failed — transfer rejected', status: 'failed'  },
    { label: `${firstName} receives funds`,           sub: 'Not delivered',              status: 'pending' },
  ];
}

// ─── Status badge config ──────────────────────────────────────────────────────

function statusConfig(status: TransactionStatus) {
  if (status === 'completed') return {
    label: 'COMPLETED', color: colors.success, bg: colors.successSubtle, border: colors.success,
  };
  if (status === 'pending') return {
    label: 'IN PROGRESS', color: colors.pending, bg: colors.pendingSubtle, border: colors.pending,
  };
  return {
    label: 'FAILED', color: colors.failed, bg: colors.failedSubtle, border: colors.failed,
  };
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({
  label, value, mono, valueColor,
}: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[
        styles.detailValue,
        mono        && styles.detailValueMono,
        valueColor  ? { color: valueColor } : undefined,
      ]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TransactionDetailScreen({ route }: RootStackProps<'TransactionDetail'>) {
  const { txId } = route.params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, wallets } = useWalletStore();

  const tx = transactions.find((t) => t.id === txId);

  if (!tx) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Transaction not found.</Text>
        </View>
      </View>
    );
  }

  const wallet   = wallets.find((w) => w.id === tx.walletId);
  const currency = getCurrency(tx.currency);
  const firstName   = tx.recipientName.split(' ')[0];
  const isCredit    = tx.amount > 0;
  const formattedAmount = formatAmount(Math.abs(tx.amount), tx.currency);
  const txRef = `#${tx.id.replace(/\D/g, '').padStart(8, '0').slice(0, 8)}`;
  const dateStr = new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(tx.date);

  const badge = statusConfig(tx.status);
  const steps = buildSteps(tx.status, firstName);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.navTitle}>Transaction Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: (tx.status === 'failed' ? 80 : 0) + insets.bottom + spacing.xxl },
        ]}
      >
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={[
            styles.directionAvatar,
            { backgroundColor: isCredit ? colors.successSubtle : colors.surface },
          ]}>
            {isCredit
              ? <ArrowDownLeft size={24} color={colors.success} strokeWidth={2} />
              : <ArrowUpRight  size={24} color={colors.brand}   strokeWidth={2} />
            }
          </View>

          <Text style={styles.heroAmount}>{isCredit ? '+' : '−'}{formattedAmount}</Text>
          <Text style={styles.heroSub}>
            {isCredit ? `Received from ${tx.recipientName}` : `Sent to ${tx.recipientName}`}
          </Text>

          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
            <Text style={[styles.badgeLabel, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* ── Failed — refund notice (top, before cards) ─────────────── */}
        {tx.status === 'failed' && (
          <View style={styles.refundBanner}>
            <Text style={styles.refundText}>
              Your funds were not deducted. If you believe this is an error, use the button below to contact support.
            </Text>
          </View>
        )}

        {/* ── Details card ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <DetailRow label="Date"       value={dateStr} />
          <View style={styles.rowDivider} />
          <DetailRow label="Reference"  value={txRef} mono />
          <View style={styles.rowDivider} />
          <DetailRow
            label="Wallet"
            value={`${currency.flag} ${tx.currency}${wallet?.nickname ? ` · ${wallet.nickname}` : ''}`}
          />
          {tx.note && tx.status !== 'failed' && (
            <>
              <View style={styles.rowDivider} />
              <DetailRow label="Note" value={tx.note} />
            </>
          )}
          {tx.status === 'failed' && (
            <>
              <View style={styles.rowDivider} />
              <DetailRow
                label="Reason"
                value={tx.note ?? 'Transfer rejected by payment network'}
                valueColor={colors.failed}
              />
            </>
          )}
        </View>

        {/* ── Tracking card ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transfer status</Text>
          <View style={styles.stepsWrap}>
            {steps.map((step, i) => (
              <StepRow key={i} step={step} isLast={i === steps.length - 1} />
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── Sticky footer — failed only ────────────────────────────── */}
      {tx.status === 'failed' && (
        <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <SecondaryButton onPress={() => {}} style={styles.supportBtn}>
            <LifeBuoy size={16} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.supportBtnText}>Contact support</Text>
          </SecondaryButton>
        </View>
      )}
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
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -6,
  },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: typography.base, fontWeight: typography.semibold, color: colors.textPrimary,
  },

  scroll: { paddingHorizontal: H_PAD, paddingTop: spacing.md },

  // ── Hero ──
  hero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  directionAvatar: {
    width: 52, height: 52, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroAmount: {
    fontSize: typography.xxl, fontWeight: typography.bold,
    color: colors.textPrimary, letterSpacing: -1,
  },
  heroSub: { fontSize: typography.sm, color: colors.textSecondary },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderRadius: radius.full, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 5,
    marginTop: spacing.xs,
  },
  badgeDot: { width: 6, height: 6, borderRadius: radius.full },
  badgeLabel: { fontSize: typography.xs, fontWeight: typography.bold, letterSpacing: 1 },

  // ── Card ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.xs, color: colors.textMuted,
    fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md, paddingBottom: spacing.sm,
  },

  // ── Detail rows ──
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
  },
  rowDivider: { height: 1, backgroundColor: colors.borderSubtle },
  detailLabel: { fontSize: typography.base, color: colors.textSecondary, flexShrink: 0 },
  detailValue: {
    fontSize: typography.base, color: colors.textPrimary,
    fontWeight: typography.medium, textAlign: 'right', flex: 1,
  },
  detailValueMono: {
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary, fontWeight: typography.regular,
  },

  // ── Steps ──
  stepsWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },

  // ── Failed refund banner ──
  refundBanner: {
    backgroundColor: colors.failedSubtle,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.failed + '33',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
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
