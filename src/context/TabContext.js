import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const TabContext = createContext(null);

export function TabProvider({ children }) {
  const [tab, setTab] = useState('dash');
  const [navFocus, setNavFocus] = useState(null);
  const clearNavFocus = useCallback(() => setNavFocus(null), []);
  const value = useMemo(
    () => ({ tab, setTab, navFocus, setNavFocus, clearNavFocus }),
    [tab, navFocus, clearNavFocus]
  );
  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTab() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTab must be used inside TabProvider');
  return ctx;
}
