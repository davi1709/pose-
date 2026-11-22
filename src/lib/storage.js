import { useEffect, useState } from 'react';

/** useState persisted to localStorage (fails silently in private modes / sandboxed frames). */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep in memory */
    }
  }, [key, value]);
  return [value, setValue];
}
