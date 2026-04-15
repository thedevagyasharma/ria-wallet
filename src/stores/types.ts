export type CardType = 'physical' | 'virtual' | 'single-use';
export type CardNetwork = 'Visa' | 'Mastercard';
export type TransactionStatus = 'pending' | 'completed' | 'failed';
export type TransactionType = 'send' | 'receive';

export type Card = {
  id: string;
  walletId: string;
  name: string;
  color: string;
  last4: string;
  network: CardNetwork;
  cardholderName: string;
  expiry: string;
  cvv: string;
  fullNumber: string;
  frozen: boolean;
  type: CardType;
};

export type Wallet = {
  id: string;
  currency: string;
  balance: number;
  isPrimary: boolean;
  nickname?: string;
};

export type Transaction = {
  id: string;
  walletId: string;
  type: TransactionType;
  recipientName: string;
  amount: number;           // negative = outgoing, positive = incoming
  currency: string;
  date: Date;
  status: TransactionStatus;
  note?: string;
};

export type Contact = {
  id: string;
  name: string;
  phone: string;
  flag: string;
  lastSentCurrency: string;
  lastSentAmount: number;
};
