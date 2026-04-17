import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Bottom tabs
export type TabParamList = {
  Wallets: undefined;
  ActivityTab: undefined;
  Send: undefined;
  Cards: undefined;
  Profile: undefined;
};

// Root stack (tabs + modals)
export type RootStackParamList = {
  Main: undefined;
  // Wallet flows
  CurrencyPicker: undefined;
  WalletReview: { currency: string };
  WalletSuccess: { currency: string; walletId: string };
  // Card flows
  CardList: { walletId: string; initialCardIndex?: number };
  CardSettings: { cardId: string; scrollTo?: 'limits' };
  AddCardType: { walletId: string };
  AddCardName: { walletId: string; cardType: string };
  AddCardColor: { walletId: string; cardType: string; name: string };
  AddCardReview: { cardId: string };
  SingleUseCreating: { walletId: string };
  // Wallet settings
  WalletSettings: { walletId: string };
  // Activity
  Activity: { walletId: string };
  TransactionDetail: { txId: string; mode?: 'detail' | 'receipt' };
  // Send money
  SendMoney: { walletId?: string; contactName?: string; prefillSendAmount?: number };
  // Receive money
  ReceiveMoney: { walletId: string };
};

export type RootStackProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;
