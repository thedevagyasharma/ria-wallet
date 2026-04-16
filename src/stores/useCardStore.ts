import { create } from 'zustand';
import type { Card } from './types';
import { MOCK_CARDS } from '../data/mockData';

type CardStore = {
  cards: Card[];
  addCard: (card: Card) => void;
  removeCard: (cardId: string) => void;
  toggleFreeze: (cardId: string) => void;
  changePin: (cardId: string, pin: string) => void;
  setOnlineTransactions: (cardId: string, value: boolean) => void;
  setSpendingLimit: (cardId: string, period: 'daily' | 'weekly' | 'monthly', limit: number | null) => void;
  replaceSpendingLimits: (cardId: string, limits: { daily?: number; weekly?: number; monthly?: number }) => void;
  getWalletCards: (walletId: string) => Card[];
  // Prototype-only
  setExpired: (cardId: string, value: boolean) => void;
  setFreezeSimulateError: (cardId: string, value: boolean) => void;
};

export const useCardStore = create<CardStore>((set, get) => ({
  cards: MOCK_CARDS,

  addCard: (card) =>
    set((state) => ({ cards: [...state.cards, card] })),

  removeCard: (cardId) =>
    set((state) => ({ cards: state.cards.filter((c) => c.id !== cardId) })),

  toggleFreeze: (cardId) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, frozen: !c.frozen } : c
      ),
    })),

  changePin: (cardId, pin) =>
    set((state) => ({
      cards: state.cards.map((c) => c.id === cardId ? { ...c, pin } : c),
    })),

  setOnlineTransactions: (cardId, value) =>
    set((state) => ({
      cards: state.cards.map((c) => c.id === cardId ? { ...c, onlineTransactions: value } : c),
    })),

  setSpendingLimit: (cardId, period, limit) =>
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.id !== cardId) return c;
        const prev = c.spendingLimits ?? {};
        const next = { ...prev };
        if (limit == null) {
          delete next[period];
        } else {
          next[period] = limit;
        }
        return { ...c, spendingLimits: next };
      }),
    })),

  replaceSpendingLimits: (cardId, limits) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, spendingLimits: limits } : c
      ),
    })),

  getWalletCards: (walletId) =>
    get().cards.filter((c) => c.walletId === walletId),

  setExpired: (cardId, value) =>
    set((state) => ({
      cards: state.cards.map((c) => c.id === cardId ? { ...c, expired: value } : c),
    })),

  setFreezeSimulateError: (cardId, value) =>
    set((state) => ({
      cards: state.cards.map((c) => c.id === cardId ? { ...c, freezeSimulateError: value } : c),
    })),
}));
