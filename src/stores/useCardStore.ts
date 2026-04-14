import { create } from 'zustand';
import type { Card } from './types';
import { MOCK_CARDS } from '../data/mockData';

type CardStore = {
  cards: Card[];
  addCard: (card: Card) => void;
  removeCard: (cardId: string) => void;
  toggleFreeze: (cardId: string) => void;
  getWalletCards: (walletId: string) => Card[];
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

  getWalletCards: (walletId) =>
    get().cards.filter((c) => c.walletId === walletId),
}));
