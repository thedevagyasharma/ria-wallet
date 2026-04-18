import { create } from 'zustand';

export type Discoverability = 'everyone' | 'contacts' | 'nobody';
export type WalletActionsLayout = 'default' | 'quick';

type PrefsStore = {
  hideBalances: boolean;
  appLockEnabled: boolean;
  defaultSendCurrency: string;
  discoverability: Discoverability;
  hiddenCurrencies: string[];
  walletActionsLayout: WalletActionsLayout;
  toggleHideBalances: () => void;
  toggleAppLock: () => void;
  setDefaultSendCurrency: (currency: string) => void;
  setDiscoverability: (value: Discoverability) => void;
  toggleCurrencyVisibility: (currency: string) => void;
  toggleWalletActionsLayout: () => void;
};

export const usePrefsStore = create<PrefsStore>((set) => ({
  hideBalances: false,
  appLockEnabled: false,
  defaultSendCurrency: 'USD',
  discoverability: 'contacts',
  hiddenCurrencies: [],
  walletActionsLayout: 'quick',
  toggleHideBalances: () => set((s) => ({ hideBalances: !s.hideBalances })),
  toggleAppLock: () => set((s) => ({ appLockEnabled: !s.appLockEnabled })),
  setDefaultSendCurrency: (currency) => set({ defaultSendCurrency: currency }),
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
