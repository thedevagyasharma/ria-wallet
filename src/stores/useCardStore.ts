import { create } from 'zustand';
import type { Card } from './types';
import { MOCK_CARDS } from '../data/mockData';

type CardStore = {
  cards: Card[];
  // One-shot signal the Wallets screen reads after a card is added: scrolls
  // to the card's wallet and runs the land-in animation on the new front card.
  // Set explicitly when the user finishes the add flow (AddCardReview's Done)
  // so the animation fires at the right moment — not when addCard runs, which
  // happens earlier in the flow while Wallets is still hidden.
  justAddedCardId: string | null;
  addCard: (card: Card) => void;
  markJustAdded: (cardId: string) => void;
  clearJustAddedCardId: () => void;
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
  justAddedCardId: null,

  // Prepend so the newest card sits at index 0 — front of the stack preview
  // and first card in the WalletCardList carousel. Matches newest-first
  // ordering used across the app (activity, etc.).
  addCard: (card) =>
    set((state) => ({ cards: [card, ...state.cards] })),

  markJustAdded: (cardId) => set({ justAddedCardId: cardId }),
  clearJustAddedCardId: () => set({ justAddedCardId: null }),

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
