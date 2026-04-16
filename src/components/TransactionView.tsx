/**
 * Shared sections used by SendSuccessScreen and TransactionDetailScreen so
 * both render the same structure for all transaction variants
 * (p2p in/out, card in/out).
 *
 *   StatusBadge    — pill rendering status (completed/pending/failed/custom)
 *   RefCopyRow     — reference display with copy affordance
 *   TxSummaryCard  — P2P breakdown (send → fee → total → received, with rate)
 *   TxDetailsCard  — date / wallet / card / category / note / reason
 *   TxTimeline     — P2P progression timeline (wraps TransferSteps)
 *   buildTimelineSteps / statusConfig — helpers
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Copy } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../theme';
import { getCurrency, formatAmount } from '../data/currencies';
import { CATEGORY_META } from '../utils/cardCategories';
import FlagIcon from './FlagIcon';
import { StepRow, type Step } from './TransferSteps';
import type { Card, Transaction, TransactionStatus, Wallet } from '../stores/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const isCardTx = (tx: Transaction) => !!tx.cardId;
export const isIncoming = (tx: Transaction) => tx.amount > 0;

/** Fallback ref for legacy transactions that weren't stored with one. */
export function getTxRef(tx: Transaction): string {
  if (tx.ref) return tx.ref;
  const digits = tx.id.replace(/\D/g, '').padStart(6, '0').slice(-6);
  return `RIA-${digits}`;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

type BadgeVariant = TransactionStatus | 'inProgress';

export function statusConfig(variant: BadgeVariant) {
  switch (variant) {
    case 'completed':  return { label: 'COMPLETED',   color: colors.success, bg: colors.successSubtle };
    case 'pending':    return { label: 'PENDING',     color: colors.pending, bg: colors.pendingSubtle };
    case 'failed':     return { label: 'FAILED',      color: colors.failed,  bg: colors.failedSubtle  };
    case 'inProgress': return { label: 'IN PROGRESS', color: colors.pending, bg: colors.pendingSubtle };
  }
}

export function StatusBadge({ variant }: { variant: BadgeVariant }) {
  const cfg = statusConfig(variant);
  return (
    <View style={[badgeStyles.badge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
      <View style={[badgeStyles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[badgeStyles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderRadius: radius.full, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 5,
  },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  label: { fontSize: typography.xs, fontWeight: typography.bold, letterSpacing: 1 },
});

// ─── Reference + copy ─────────────────────────────────────────────────────────

export function RefCopyRow({ refValue }: { refValue: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Pressable onPress={onCopy} style={refStyles.row}>
      <Text style={refStyles.label}>Ref</Text>
      <Text style={refStyles.value}>{refValue}</Text>
      <View style={refStyles.btn}>
        {copied
          ? <Check size={12} color={colors.success} strokeWidth={2.5} />
          : <Copy  size={12} color={colors.brand}   strokeWidth={2} />}
        <Text style={[refStyles.btnText, copied && { color: colors.success }]}>
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </View>
    </Pressable>
  );
}

const refStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  label:   { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  value:   { fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.semibold, flex: 1, fontVariant: ['tabular-nums'] },
  btn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btnText: { fontSize: typography.xs, color: colors.brand, fontWeight: typography.semibold },
});

// ─── P2P summary card ─────────────────────────────────────────────────────────

export function TxSummaryCard({ tx }: { tx: Transaction }) {
  // Only render when we have the P2P breakdown data.
  if (tx.fee === undefined || tx.receivedAmount === undefined || !tx.receiveCurrency) return null;

  const total    = Math.abs(tx.amount);
  const sendPart = total - tx.fee;
  const rateLine = tx.rate !== undefined
    ? `1 ${tx.currency} = ${tx.rate.toFixed(4)} ${tx.receiveCurrency}`
    : undefined;
  const firstName = tx.recipientName.split(' ')[0];

  return (
    <View style={cardStyles.card}>
      <Row label="You sent"     value={formatAmount(sendPart, tx.currency)} />
      <Divider />
      <Row label="Transfer fee" value={formatAmount(tx.fee, tx.currency)} />
      <View style={cardStyles.totalDivider} />
      <View style={cardStyles.totalRow}>
        <Text style={cardStyles.totalLabel}>Total deducted</Text>
        <Text style={cardStyles.totalValue}>{formatAmount(total, tx.currency)}</Text>
      </View>
      <Divider />
      <Row
        label={`${firstName} receives`}
        value={`${formatAmount(tx.receivedAmount, tx.receiveCurrency)} ${tx.receiveCurrency}`}
      />
      {rateLine && (
        <>
          <Divider />
          <View style={cardStyles.footnote}>
            <Text style={cardStyles.footnoteText}>{rateLine}</Text>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Details card ─────────────────────────────────────────────────────────────

/**
 * Flat details list (per DECISIONS.md #144 — no gray container, rows separated
 * by inset hairlines). The caller is responsible for the section wrapper and
 * label; this just renders the rows.
 */
export function TxDetailsList({
  tx, wallet, card, flat = true,
}: { tx: Transaction; wallet?: Wallet; card?: Card; flat?: boolean }) {
  const dateStr = new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(tx.date);

  const currency = getCurrency(tx.currency);
  const cardMeta = tx.category ? CATEGORY_META[tx.category] : undefined;

  const walletValue = `${tx.currency}${wallet?.nickname ? ` · ${wallet.nickname}` : ''}`;

  const showNote   = !!tx.note && tx.status !== 'failed';
  const showReason = tx.status === 'failed';

  const rows: React.ReactNode[] = [
    <FlatRow key="date"   label="Date"   value={dateStr} flat={flat} />,
    <FlatRow key="wallet" label="Wallet" value={walletValue} flagCode={currency.flag} flat={flat} />,
  ];
  if (card)       rows.push(<FlatRow key="card"     label="Card"     value={`${card.name} •••• ${card.last4}`} flat={flat} />);
  if (cardMeta)   rows.push(<FlatRow key="category" label="Category" value={cardMeta.label} flat={flat} />);
  if (showNote)   rows.push(<FlatRow key="note"     label="Note"     value={tx.note!} flat={flat} />);
  if (showReason) rows.push(<FlatRow key="reason"   label="Reason"   value={tx.note ?? 'Transfer rejected by payment network'} valueColor={colors.failed} flat={flat} />);

  const wrapStyle = flat ? undefined : cardStyles.card;
  return (
    <View style={wrapStyle}>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {row}
          {i < rows.length - 1 && <View style={flat ? listStyles.divider : cardStyles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

function FlatRow({
  label, value, flagCode, valueColor, flat,
}: {
  label: string; value: string;
  flagCode?: string; valueColor?: string; flat: boolean;
}) {
  return (
    <View style={flat ? listStyles.row : rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      {flagCode ? (
        <View style={rowStyles.valueWithFlag}>
          <FlagIcon code={flagCode} size={14} />
          <Text style={[rowStyles.value, valueColor ? { color: valueColor } : undefined]}>
            {value}
          </Text>
        </View>
      ) : (
        <Text style={[rowStyles.value, valueColor ? { color: valueColor } : undefined]}>
          {value}
        </Text>
      )}
    </View>
  );
}

const listStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: spacing.md, gap: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle },
});

// ─── P2P timeline ─────────────────────────────────────────────────────────────

/**
 * Should the tracking timeline be shown for this transaction?
 * Only meaningful for OUTGOING P2P transfers:
 *  - card transactions are instantaneous authorizations (no multi-step journey)
 *  - incoming transactions: we didn't observe the sender's end of the flow,
 *    so "Transfer initiated → Processing → you received" reads hollow.
 */
export function shouldShowTimeline(tx: Transaction): boolean {
  return !isCardTx(tx) && !isIncoming(tx);
}

export function buildTimelineSteps(
  status: TransactionStatus,
  firstName: string,
): Step[] {
  if (status === 'completed') {
    return [
      { label: 'Transfer initiated',            sub: 'Confirmed — funds reserved', status: 'done' },
      { label: 'Processing transfer',           sub: 'Completed',                  status: 'done' },
      { label: `${firstName} received funds`,   sub: 'Delivered',                  status: 'done' },
    ];
  }
  if (status === 'pending') {
    return [
      { label: 'Transfer initiated',            sub: 'Confirmed — funds reserved', status: 'done'    },
      { label: 'Processing transfer',           sub: 'In progress…',               status: 'active'  },
      { label: `${firstName} receives funds`,   sub: 'Awaiting delivery',          status: 'pending' },
    ];
  }
  // failed
  return [
    { label: 'Transfer initiated',            sub: 'Confirmed — funds reserved', status: 'done'    },
    { label: 'Processing transfer',           sub: 'Failed — transfer rejected', status: 'failed'  },
    { label: `${firstName} receives funds`,   sub: 'Not delivered',              status: 'pending' },
  ];
}

export function TxTimeline({
  status, firstName,
}: { status: TransactionStatus; firstName: string }) {
  const steps = buildTimelineSteps(status, firstName);
  return (
    <View style={timelineStyles.wrap}>
      {steps.map((step, i) => (
        <StepRow key={i} step={step} isLast={i === steps.length - 1} />
      ))}
    </View>
  );
}

const timelineStyles = StyleSheet.create({
  wrap: { paddingBottom: spacing.md },
});

// ─── Shared Row primitive ─────────────────────────────────────────────────────

function Row({
  label, value, flagCode, valueColor,
}: { label: string; value: string; flagCode?: string; valueColor?: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      {flagCode ? (
        <View style={rowStyles.valueWithFlag}>
          <FlagIcon code={flagCode} size={14} />
          <Text style={[rowStyles.value, valueColor ? { color: valueColor } : undefined]}>
            {value}
          </Text>
        </View>
      ) : (
        <Text style={[rowStyles.value, valueColor ? { color: valueColor } : undefined]}>
          {value}
        </Text>
      )}
    </View>
  );
}

function Divider() {
  return <View style={cardStyles.divider} />;
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
  },
  label: { fontSize: typography.base, color: colors.textSecondary, flexShrink: 0 },
  value: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium, textAlign: 'right', flex: 1 },
  valueWithFlag: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flex: 1 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    marginBottom: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle },
  totalDivider: { height: 2, backgroundColor: colors.border },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surfaceHigh,
  },
  totalLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  totalValue: { fontSize: typography.lg,   color: colors.textPrimary, fontWeight: typography.bold, letterSpacing: -0.5 },
  footnote:   { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' },
  footnoteText: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.medium },
});
