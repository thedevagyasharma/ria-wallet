import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../theme';
import { formatAmount } from '../data/currencies';
import StatusChip from './StatusChip';
import { alpha } from '../utils/color';
import type { Transaction } from '../stores/types';

const H_PAD = 24;

const date_fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export default function TransactionRow({
  tx,
  onPress,
}: {
  tx: Transaction;
  onPress: () => void;
}) {
  const isCredit = tx.amount > 0;
  const isFailed = tx.status === 'failed';
  const formatted = formatAmount(Math.abs(tx.amount), tx.currency);
  const date = date_fmt.format(tx.date);

  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
  const showChip = tx.status === 'failed' || tx.status === 'pending';

  // Semantic direction colors (green=incoming, red=outgoing). Failed rows
  // go gray so a red icon doesn't get mistaken for "outgoing" at a glance.
  const iconColor = isFailed
    ? colors.textMuted
    : isCredit
      ? colors.success
      : colors.failed;
  const iconBg = isFailed ? colors.surfaceHigh : alpha(iconColor, 0.12);

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={1.8} />
      </View>

      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isFailed && styles.muted]} numberOfLines={1}>
            {tx.recipientName}
          </Text>
          {showChip && <StatusChip status={tx.status} />}
        </View>
        <Text style={styles.metaText}>{date}</Text>
      </View>

      <Text style={[styles.amount, isFailed ? styles.muted : isCredit ? styles.credit : styles.debit]}>
        {isCredit ? '+' : '−'}{formatted}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: H_PAD,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowPressed: { backgroundColor: colors.surface },

  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  middle: { flex: 1, minWidth: 0 },
  name: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
    marginBottom: 3,
  },
  muted: { color: colors.textMuted },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: typography.xs, color: colors.textMuted, marginTop: 2 },

  amount: { fontSize: typography.base, fontWeight: typography.semibold },
  credit: { color: colors.success },
  debit:  { color: colors.failed },
});
