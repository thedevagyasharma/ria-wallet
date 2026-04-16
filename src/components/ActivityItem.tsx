import React from 'react';

import { colors } from '../theme';
import TransactionRow from './TransactionRow';
import CardTransactionRow from './CardTransactionRow';
import type { Transaction, Wallet } from '../stores/types';

const WALLET_ACCENTS: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};

function walletAccent(currency: string, override?: string) {
  return override ?? WALLET_ACCENTS[currency] ?? colors.brand;
}

export default function ActivityItem({
  tx,
  wallets,
  onPress,
}: {
  tx: Transaction;
  wallets: Wallet[];
  onPress: () => void;
}) {
  if (tx.cardId) {
    return <CardTransactionRow tx={tx} onPress={onPress} />;
  }
  const wallet = wallets.find((w) => w.id === tx.walletId);
  return (
    <TransactionRow
      tx={tx}
      accentColor={walletAccent(tx.currency, wallet?.accentColor)}
      onPress={onPress}
    />
  );
}
