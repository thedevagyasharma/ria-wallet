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
import Chip from './Chip';
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
    case 'completed':  return { label: 'COMPLETE',    color: colors.success, bg: colors.successSubtle };
    case 'pending':    return { label: 'PENDING', color: colors.brand, bg: colors.brandSubtle };
    case 'failed':     return { label: 'FAILED',      color: colors.failed,  bg: colors.failedSubtle  };
    case 'inProgress': return { label: 'PENDING', color: colors.brand, bg: colors.brandSubtle };
  }
}

export function StatusBadge({ variant }: { variant: BadgeVariant }) {
  const cfg = statusConfig(variant);
  return <Chip label={cfg.label} color={cfg.color} bg={cfg.bg} />;
}

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

// ─── P2P summary (flat rows) ─────────────────────────────────────────────────

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={listStyles.row}>
      <Text style={[rowStyles.label, bold && summaryStyles.boldLabel]}>{label}</Text>
      <Text style={[rowStyles.value, bold && summaryStyles.boldValue]}>{value}</Text>
    </View>
  );
}

export function TxSummaryCard({ tx }: { tx: Transaction }) {
  if (tx.fee === undefined || tx.receivedAmount === undefined || !tx.receiveCurrency) return null;

  const total    = Math.abs(tx.amount);
  const sendPart = total - tx.fee;
  const rateLine = tx.rate !== undefined
    ? `1 ${tx.currency} = ${tx.rate.toFixed(4)} ${tx.receiveCurrency}`
    : undefined;
  const firstName = tx.recipientName.split(' ')[0];

  return (
    <View>
      <SummaryRow label="You sent" value={formatAmount(sendPart, tx.currency)} />
      <View style={listStyles.divider} />
      <SummaryRow label="Transfer fee" value={formatAmount(tx.fee, tx.currency)} />
      <View style={listStyles.divider} />
      <SummaryRow label="Total deducted" value={formatAmount(total, tx.currency)} bold />
      <View style={listStyles.divider} />
      <SummaryRow
        label={`${firstName} receives`}
        value={`${formatAmount(tx.receivedAmount, tx.receiveCurrency)} ${tx.receiveCurrency}`}
      />
      {rateLine && (
        <>
          <View style={listStyles.divider} />
          <View style={summaryStyles.footnote}>
            <Text style={summaryStyles.footnoteText}>{rateLine}</Text>
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
  tx, wallet, card,
}: { tx: Transaction; wallet?: Wallet; card?: Card }) {
  const dateStr = new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(tx.date);

  const currency = getCurrency(tx.currency);
  const cardMeta = tx.category ? CATEGORY_META[tx.category] : undefined;
  const walletValue = `${tx.currency}${wallet?.nickname ? ` · ${wallet.nickname}` : ''}`;
  const isP2P = !isCardTx(tx);

  const showNote   = !!tx.note && tx.status !== 'failed';

  const rows: React.ReactNode[] = [];
  if (isP2P)      rows.push(<FlatRow key="recipient" label="Recipient" value={tx.recipientName} />);
  rows.push(<FlatRow key="date" label="Date" value={dateStr} />);
  rows.push(<FlatRow key="wallet" label="Wallet" value={walletValue} flagCode={currency.flag} />);
  if (card)       rows.push(<FlatRow key="card"     label="Card"     value={`${card.name} •••• ${card.last4}`} />);
  if (cardMeta)   rows.push(<FlatRow key="category" label="Category" value={cardMeta.label} />);
  if (showNote)   rows.push(<FlatRow key="note"     label="Note"     value={tx.note!} />);

  return (
    <View>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {row}
          {i < rows.length - 1 && <View style={listStyles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

function FlatRow({
  label, value, flagCode, valueColor,
}: {
  label: string; value: string;
  flagCode?: string; valueColor?: string;
}) {
  return (
    <View style={listStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      {flagCode ? (
        <View style={rowStyles.valueWithFlag}>
          <FlagIcon code={flagCode} size={14} />
          <Text style={[rowStyles.valueFlagged, valueColor ? { color: valueColor } : undefined]}>
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

function fmtStepTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

/** Maps an eta label string to a millisecond offset from txDate. */
function etaOffsetMs(eta?: string): number {
  if (!eta || eta === 'Instant') return 0;
  if (eta === 'Within minutes')  return 15 * 60_000;
  if (eta.includes('1–2 hours')) return 90 * 60_000;
  return 60 * 60_000; // fallback: 1 hour
}

export function buildTimelineSteps(
  status: TransactionStatus,
  firstName: string,
  txDate?: Date,
  eta?: string,
): Step[] {
  const t0 = txDate ? fmtStepTime(txDate) : undefined;
  const t1 = txDate ? fmtStepTime(new Date(txDate.getTime() + 2 * 60_000)) : undefined;
  const t2 = txDate ? fmtStepTime(new Date(txDate.getTime() + 5 * 60_000)) : undefined;

  if (status === 'completed') {
    return [
      { label: 'Transfer initiated',            sub: 'Confirmed — funds reserved', status: 'done', time: t0 },
      { label: 'Processing transfer',           sub: 'Completed',                  status: 'done', time: t1 },
      { label: `${firstName} received funds`,   sub: 'Delivered',                  status: 'done', time: t2 },
    ];
  }
  if (status === 'pending') {
    const etaDate = txDate ? new Date(txDate.getTime() + etaOffsetMs(eta)) : undefined;
    const deliverySub = etaDate
      ? `Est. arrival: ${fmtStepTime(etaDate)}`
      : 'Awaiting delivery';
    return [
      { label: 'Transfer initiated',            sub: 'Confirmed — funds reserved', status: 'done',    time: t0 },
      { label: 'Processing transfer',           sub: 'In progress…',               status: 'active',  time: t1 },
      { label: `${firstName} receives funds`,   sub: deliverySub,                  status: 'pending' },
    ];
  }
  // failed
  return [
    { label: 'Transfer initiated',            sub: 'Confirmed — funds reserved', status: 'done',   time: t0 },
    { label: 'Processing transfer',           sub: 'Failed — transfer rejected', status: 'failed', time: t1 },
    { label: `${firstName} receives funds`,   sub: 'Not delivered',              status: 'pending' },
  ];
}

export function TxTimeline({
  status, firstName, txDate, eta,
}: { status: TransactionStatus; firstName: string; txDate?: Date; eta?: string }) {
  const steps = buildTimelineSteps(status, firstName, txDate, eta);
  return (
    <View style={timelineStyles.wrap}>
      {steps.map((step, i) => (
        <StepRow key={i} step={step} isLast={i === steps.length - 1} nextStatus={steps[i + 1]?.status} />
      ))}
    </View>
  );
}

const timelineStyles = StyleSheet.create({
  wrap: { paddingBottom: spacing.md },
});

const rowStyles = StyleSheet.create({
  label: { fontSize: typography.base, color: colors.textSecondary, flexShrink: 0 },
  value: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium, textAlign: 'right', flex: 1 },
  valueFlagged: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  valueWithFlag: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flex: 1 },
});

const summaryStyles = StyleSheet.create({
  boldLabel: { color: colors.textPrimary, fontWeight: typography.semibold },
  boldValue: { fontSize: typography.lg, fontWeight: typography.bold, letterSpacing: -0.5 },
  footnote: { paddingVertical: spacing.sm, alignItems: 'center' },
  footnoteText: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.medium },
});
