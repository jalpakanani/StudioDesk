import { useEffect, useState } from 'react';
import { readStudioDisplayName } from '../utils/studioDisplayName';

/**
 * Live-updates when Settings saves or another tab changes localStorage.
 */
export function useStudioDisplayName() {
  const [name, setName] = useState(() => readStudioDisplayName());

  useEffect(() => {
    function sync() {
      setName(readStudioDisplayName());
    }
    window.addEventListener('desk-studio-name-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('desk-studio-name-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return name;
}
