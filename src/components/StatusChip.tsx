import React from 'react';
import { colors } from '../theme';
import Chip from './Chip';
import type { TransactionStatus } from '../stores/types';

const config: Record<TransactionStatus, { label: string; color: string; bg: string }> = {
  completed: { label: 'Complete', color: colors.success, bg: colors.successSubtle },
  pending:   { label: 'Pending',  color: colors.brand,   bg: colors.brandSubtle },
  failed:    { label: 'Failed',   color: colors.failed,  bg: colors.failedSubtle },
};

export default function StatusChip({ status }: { status: TransactionStatus }) {
  const { label, color, bg } = config[status];
  return <Chip label={label} color={color} bg={bg} size="sm" />;
}
