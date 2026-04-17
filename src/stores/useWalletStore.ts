import { create } from 'zustand';
import type { Wallet, Transaction } from './types';
import { MOCK_WALLETS, MOCK_TRANSACTIONS } from '../data/mockData';

type WalletStore = {
  wallets: Wallet[];
  transactions: Transaction[];
  activeWalletId: string;
  // One-shot signal Wallets reads after a wallet is created: scrolls the
  // carousel to the new wallet. Set when the user taps Done on WalletSuccess
  // (not when addWallet runs) so the scroll fires exactly when the screen
  // returns to focus.
  justAddedWalletId: string | null;

  setActiveWallet: (id: string) => void;
  addWallet: (wallet: Wallet) => void;
  markJustAddedWallet: (walletId: string) => void;
  clearJustAddedWalletId: () => void;
  addTransaction: (tx: Transaction) => void;
  getWalletTransactions: (walletId: string) => Transaction[];
  deductBalance: (walletId: string, amount: number) => void;
  setPrimary: (id: string) => void;
  setNickname: (id: string, nickname: string) => void;
  setAccentColor: (id: string, color: string) => void;
};

export const useWalletStore = create<WalletStore>((set, get) => ({
  wallets: MOCK_WALLETS,
  transactions: MOCK_TRANSACTIONS,
  activeWalletId: MOCK_WALLETS.find((w) => w.isPrimary)!.id,
  justAddedWalletId: null,

  setActiveWallet: (id) => set({ activeWalletId: id }),

  addWallet: (wallet) =>
    set((state) => ({ wallets: [...state.wallets, wallet] })),

  markJustAddedWallet: (walletId) => set({ justAddedWalletId: walletId }),
  clearJustAddedWalletId: () => set({ justAddedWalletId: null }),

  addTransaction: (tx) =>
    set((state) => ({ transactions: [tx, ...state.transactions] })),

  getWalletTransactions: (walletId) => {
    const { transactions } = get();
    if (walletId === 'all') return transactions;
    return transactions.filter((t) => t.walletId === walletId);
  },

  deductBalance: (walletId, amount) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === walletId ? { ...w, balance: w.balance - amount } : w
      ),
    })),

  setPrimary: (id) =>
    set((state) => ({
      wallets: state.wallets.map((w) => ({ ...w, isPrimary: w.id === id })),
    })),

  setNickname: (id, nickname) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === id ? { ...w, nickname } : w
      ),
    })),

  setAccentColor: (id, color) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === id ? { ...w, accentColor: color } : w
      ),
    })),
}));
