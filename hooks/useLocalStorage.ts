import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

function getStorageValue<T>(key: string, defaultValue: T): T {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error("Failed to parse localStorage value", error);
        return defaultValue;
      }
    }
  }
  return defaultValue;
}

// FIX: Imported `Dispatch` and `SetStateAction` types from 'react' to resolve 'React' namespace error.
export const useLocalStorage = <T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState(() => {
    return getStorageValue(key, defaultValue);
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Failed to set localStorage value", error);
    }
  }, [key, value]);

  return [value, setValue];
};