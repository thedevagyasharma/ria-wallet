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
  setContactless: (cardId: string, value: boolean) => void;
  setSpendingLimit: (cardId: string, period: 'daily' | 'weekly' | 'monthly', limit: number | null) => void;
  replaceSpendingLimits: (cardId: string, limits: { daily?: number; weekly?: number; monthly?: number }) => void;
  getWalletCards: (walletId: string) => Card[];
  regenerateCardDetails: (cardId: string) => void;
  // Prototype-only
  setExpired: (cardId: string, value: boolean) => void;
  setFreezeSimulateError: (cardId: string, value: boolean) => void;
};

export const useCardStore = create<CardStore>((set, get) => ({
  cards: MOCK_CARDS,
  justAddedCardId: null,

  addCard: (card) =>
    set((state) => ({ cards: [...state.cards, card] })),

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

  setContactless: (cardId, value) =>
    set((state) => ({
      cards: state.cards.map((c) => c.id === cardId ? { ...c, contactless: value } : c),
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

  regenerateCardDetails: (cardId) =>
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.id !== cardId) return c;
        const fullNumber = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String((now.getFullYear() + 3) % 100).padStart(2, '0');
        return {
          ...c,
          fullNumber,
          last4: fullNumber.slice(-4),
          cvv: String(Math.floor(100 + Math.random() * 900)),
          expiry: `${month}/${year}`,
        };
      }),
    })),

  setExpired: (cardId, value) =>
    set((state) => ({
      cards: state.cards.map((c) => c.id === cardId ? { ...c, expired: value } : c),
    })),

  setFreezeSimulateError: (cardId, value) =>
    set((state) => ({
      cards: state.cards.map((c) => c.id === cardId ? { ...c, freezeSimulateError: value } : c),
    })),
}));
