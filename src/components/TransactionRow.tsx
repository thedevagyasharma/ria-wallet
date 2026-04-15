import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, typography, spacing, radius } from '../theme';
import { formatAmount, getCurrency } from '../data/currencies';
import StatusChip from './StatusChip';
import type { Transaction } from '../stores/types';

const H_PAD = 24;

export default function TransactionRow({
  tx,
  onPress,
}: {
  tx: Transaction;
  onPress: () => void;
}) {
  const isCredit = tx.amount > 0;
  const formatted = formatAmount(Math.abs(tx.amount), tx.currency);
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(tx.date);
  const currency = getCurrency(tx.currency);

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.txRow, pressed && styles.txRowPressed]}
    >
      <View style={styles.txAvatar}>
        <Text style={styles.txAvatarText}>{tx.recipientName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.txMiddle}>
        <Text style={styles.txName}>{tx.recipientName}</Text>
        <View style={styles.txMeta}>
          <StatusChip status={tx.status} />
          <Text style={styles.txDate}>{date}</Text>
          <Text style={styles.txCurrencyFlag}>{currency.flag}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: isCredit ? colors.success : colors.textPrimary }]}>
        {isCredit ? '+' : '−'}{formatted}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: H_PAD,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  txRowPressed: {
    backgroundColor: colors.surface,
  },
  txAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txAvatarText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
  },
  txMiddle: { flex: 1 },
  txName: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
    marginBottom: 3,
  },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  txDate: { fontSize: typography.xs, color: colors.textMuted },
  txCurrencyFlag: { fontSize: 11, lineHeight: 14 },
  txAmount: { fontSize: typography.base, fontWeight: typography.semibold },
});
