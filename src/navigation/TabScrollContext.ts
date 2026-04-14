import { createContext, useContext } from 'react';

export const TabScrollContext = createContext(0);
export const useTabScrollReset = () => useContext(TabScrollContext);
