import { createContext, useContext, useMemo, useState } from 'react';

const TabContext = createContext(null);

export function TabProvider({ children }) {
  const [tab, setTab] = useState('dash');
  const value = useMemo(() => ({ tab, setTab }), [tab]);
  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTab() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTab must be used inside TabProvider');
  return ctx;
}
