import { create } from 'zustand';

// Shared tab state for the custom 4-tab navigator in RootNavigator. The tab
// navigator itself still owns the horizontal slide animation, but the active
// index lives here so any screen (e.g. AddCardReview's Done button) can jump
// to a specific tab via setActiveTabIdx.
type TabStore = {
  activeTabIdx: number;
  setActiveTabIdx: (idx: number) => void;
};

export const useTabStore = create<TabStore>((set) => ({
  activeTabIdx: 0,
  setActiveTabIdx: (idx) => set({ activeTabIdx: idx }),
}));
