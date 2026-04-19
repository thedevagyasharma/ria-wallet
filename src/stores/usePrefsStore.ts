import { create } from 'zustand';

export type Discoverability = 'everyone' | 'contacts' | 'nobody';
export type WalletActionsLayout = 'default' | 'quick';

type PrefsStore = {
  hideBalances: boolean;
  discoverability: Discoverability;
  hiddenCurrencies: string[];
  walletActionsLayout: WalletActionsLayout;
  toggleHideBalances: () => void;
  setDiscoverability: (value: Discoverability) => void;
  toggleCurrencyVisibility: (currency: string) => void;
  toggleWalletActionsLayout: () => void;
};

export const usePrefsStore = create<PrefsStore>((set) => ({
  hideBalances: false,
  discoverability: 'contacts',
  hiddenCurrencies: [],
  walletActionsLayout: 'quick',
  toggleHideBalances: () => set((s) => ({ hideBalances: !s.hideBalances })),
  setDiscoverability: (value) => set({ discoverability: value }),
  toggleCurrencyVisibility: (currency) =>
    set((s) => ({
      hiddenCurrencies: s.hiddenCurrencies.includes(currency)
        ? s.hiddenCurrencies.filter((c) => c !== currency)
        : [...s.hiddenCurrencies, currency],
    })),
  toggleWalletActionsLayout: () =>
    set((s) => ({
      walletActionsLayout: s.walletActionsLayout === 'default' ? 'quick' : 'default',
    })),
}));
