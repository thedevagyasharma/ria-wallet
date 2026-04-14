import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import type { TransactionStatus } from '../stores/types';

const config: Record<TransactionStatus, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: colors.success,  bg: colors.successSubtle },
  pending:   { label: 'Pending',   color: colors.pending,  bg: colors.pendingSubtle },
  failed:    { label: 'Failed',    color: colors.failed,   bg: colors.failedSubtle },
};

export default function StatusChip({ status }: { status: TransactionStatus }) {
  const { label, color, bg } = config[status];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    letterSpacing: 0.2,
  },
});
