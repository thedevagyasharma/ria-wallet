import { create } from 'zustand';

type PrefsStore = {
  hideBalances: boolean;
  appLockEnabled: boolean;
  defaultSendCurrency: string;
  toggleHideBalances: () => void;
  toggleAppLock: () => void;
  setDefaultSendCurrency: (currency: string) => void;
};

export const usePrefsStore = create<PrefsStore>((set) => ({
  hideBalances: false,
  appLockEnabled: false,
  defaultSendCurrency: 'USD',
  toggleHideBalances: () => set((s) => ({ hideBalances: !s.hideBalances })),
  toggleAppLock: () => set((s) => ({ appLockEnabled: !s.appLockEnabled })),
  setDefaultSendCurrency: (currency) => set({ defaultSendCurrency: currency }),
}));
