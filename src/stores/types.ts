export type CardCategory =
  | 'groceries'
  | 'fuel'
  | 'coffee'
  | 'streaming'
  | 'music'
  | 'shopping'
  | 'food_delivery'
  | 'delivery'
  | 'software'
  | 'dining'
  | 'travel'
  | 'transport'
  | 'other';

export type CardType = 'physical' | 'virtual' | 'single-use';
export type CardNetwork = 'Visa' | 'Mastercard';
export type CardFinish = 'plastic' | 'metallic';
export type TransactionStatus = 'pending' | 'completed' | 'failed';
export type TransactionType = 'send' | 'receive';

export type Card = {
  id: string;
  walletId: string;
  name: string;
  color: string;
  branded?: boolean;
  finish?: CardFinish;
  last4: string;
  network: CardNetwork;
  cardholderName: string;
  expiry: string;
  cvv: string;
  fullNumber: string;
  frozen: boolean;
  type: CardType;
  pin?: string;
  onlineTransactions?: boolean;
  spendingLimits?: {
    daily?: number;
    weekly?: number;
    monthly?: number;
  };
  /** Controls pill contrast on the card face. 'inverted' = white pill (for dark/blue cards). */
  badgeTheme?: 'default' | 'inverted';
  // Prototype-only flags
  expired?: boolean;
  freezeSimulateError?: boolean;
};

export type Wallet = {
  id: string;
  currency: string;
  balance: number;
  isPrimary: boolean;
  nickname?: string;
  accentColor?: string;
};

export type Transaction = {
  id: string;
  walletId: string;
  cardId?: string;          // set when the transaction was made via a specific card
  type: TransactionType;
  recipientName: string;
  amount: number;           // negative = outgoing, positive = incoming
  currency: string;
  date: Date;
  status: TransactionStatus;
  note?: string;
  ref?: string;             // payment reference number (card transactions)
  category?: CardCategory;  // spending category (card transactions only)
};

export type Contact = {
  id: string;
  name: string;
  phone: string;
  flag: string;
  lastSentCurrency: string;
  lastSentAmount: number;
};
