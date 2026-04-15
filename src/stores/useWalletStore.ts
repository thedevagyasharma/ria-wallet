import { create } from 'zustand';
import type { Wallet, Transaction } from './types';
import { MOCK_WALLETS, MOCK_TRANSACTIONS } from '../data/mockData';

type WalletStore = {
  wallets: Wallet[];
  transactions: Transaction[];
  activeWalletId: string;

  setActiveWallet: (id: string) => void;
  addWallet: (wallet: Wallet) => void;
  addTransaction: (tx: Transaction) => void;
  getWalletTransactions: (walletId: string) => Transaction[];
  deductBalance: (walletId: string, amount: number) => void;
  setPrimary: (id: string) => void;
  setNickname: (id: string, nickname: string) => void;
};

export const useWalletStore = create<WalletStore>((set, get) => ({
  wallets: MOCK_WALLETS,
  transactions: MOCK_TRANSACTIONS,
  activeWalletId: MOCK_WALLETS.find((w) => w.isPrimary)!.id,

  setActiveWallet: (id) => set({ activeWalletId: id }),

  addWallet: (wallet) =>
    set((state) => ({ wallets: [...state.wallets, wallet] })),

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
}));
