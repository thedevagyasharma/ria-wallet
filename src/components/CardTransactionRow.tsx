import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '../theme';
import { formatAmount } from '../data/currencies';
import { CATEGORY_META } from '../utils/cardCategories';
import StatusChip from './StatusChip';
import type { Transaction } from '../stores/types';

const H_PAD = 24;

const datetime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default function CardTransactionRow({
  tx,
  onPress,
  hideDivider,
}: {
  tx: Transaction;
  onPress: () => void;
  hideDivider?: boolean;
}) {
  const isCredit = tx.amount > 0;
  const formatted = formatAmount(Math.abs(tx.amount), tx.currency);
  const isFailed = tx.status === 'failed';
  const meta = CATEGORY_META[tx.category ?? 'other'];
  const { Icon, iconColor, bgColor } = meta;

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.row, hideDivider && styles.rowNoDivider, pressed && styles.rowPressed]}
    >
      {/* Category icon */}
      <View style={[
        styles.icon,
        { backgroundColor: isFailed ? colors.surfaceHigh : bgColor },
      ]}>
        <Icon
          size={18}
          color={isFailed ? colors.textMuted : iconColor}
          strokeWidth={1.8}
        />
      </View>

      <View style={styles.middle}>
        <Text style={[styles.merchant, isFailed && styles.textMuted]} numberOfLines={1}>
          {tx.recipientName}
        </Text>
        <View style={styles.meta}>
          {isFailed && <StatusChip status="failed" />}
          <Text style={styles.metaText}>{datetime.format(tx.date)}</Text>
        </View>
      </View>

      <Text style={[styles.amount, isFailed ? styles.textMuted : isCredit ? styles.credit : styles.debit]}>
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
  rowNoDivider: { borderBottomWidth: 0 },

  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  middle: { flex: 1, minWidth: 0 },
  merchant: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
    marginBottom: 3,
  },
  textMuted: { color: colors.textMuted },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: typography.xs, color: colors.textMuted },
  metaDot: { fontSize: typography.xs, color: colors.textMuted },

  amount: { fontSize: typography.base, fontWeight: typography.semibold },
  credit: { color: colors.success },
  debit:  { color: colors.failed },
});
