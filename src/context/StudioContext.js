import { createContext, useContext } from 'react';
import { useStudioStore } from '../hooks/useStudioStore';

const StudioContext = createContext(null);

export function StudioProvider({ children, useCloud = false, syncUserId = null }) {
  const value = useStudioStore({ useCloud, syncUserId });
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
  return ctx;
}
