import { create } from 'zustand';

export type Discoverability = 'everyone' | 'contacts' | 'nobody';
export type WalletActionsLayout = 'default' | 'quick';

type PrefsStore = {
  hideBalances: boolean;
  hideBalancesByDefault: boolean;
  discoverability: Discoverability;
  hiddenCurrencies: string[];
  walletActionsLayout: WalletActionsLayout;
  setHideBalances: (value: boolean) => void;
  toggleHideBalances: () => void;
  toggleHideBalancesByDefault: () => void;
  setDiscoverability: (value: Discoverability) => void;
  toggleCurrencyVisibility: (currency: string) => void;
  toggleWalletActionsLayout: () => void;
};

export const usePrefsStore = create<PrefsStore>((set) => ({
  hideBalances: false,
  hideBalancesByDefault: false,
  discoverability: 'contacts',
  hiddenCurrencies: [],
  walletActionsLayout: 'quick',
  setHideBalances: (value) => set({ hideBalances: value }),
  toggleHideBalances: () => set((s) => ({ hideBalances: !s.hideBalances })),
  toggleHideBalancesByDefault: () =>
    set((s) => {
      const next = !s.hideBalancesByDefault;
      return { hideBalancesByDefault: next, hideBalances: next };
    }),
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
