import React from 'react';

import TransactionRow from './TransactionRow';
import CardTransactionRow from './CardTransactionRow';
import type { Transaction } from '../stores/types';

export default function ActivityItem({
  tx,
  onPress,
}: {
  tx: Transaction;
  onPress: () => void;
}) {
  if (tx.cardId) {
    return <CardTransactionRow tx={tx} onPress={onPress} />;
  }
  return <TransactionRow tx={tx} onPress={onPress} />;
}
