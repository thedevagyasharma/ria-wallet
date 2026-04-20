import React from 'react';

import TransactionRow from './TransactionRow';
import CardTransactionRow from './CardTransactionRow';
import type { Transaction } from '../stores/types';

export default function ActivityItem({
  tx,
  onPress,
  hideDivider,
}: {
  tx: Transaction;
  onPress: () => void;
  hideDivider?: boolean;
}) {
  if (tx.cardId) {
    return <CardTransactionRow tx={tx} onPress={onPress} hideDivider={hideDivider} />;
  }
  return <TransactionRow tx={tx} onPress={onPress} hideDivider={hideDivider} />;
}
