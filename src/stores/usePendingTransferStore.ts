import { create } from 'zustand';
import type { Contact } from './types';

export type PendingTransfer = {
  contact: Contact;
  sendWalletId: string;
  sendAmount: number;
  receiveCurrency: string;
};

type State = {
  pending: PendingTransfer | null;
  setPending: (t: PendingTransfer) => void;
  clear: () => void;
};

export const usePendingTransferStore = create<State>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}));
