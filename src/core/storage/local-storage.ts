import type { StateStorage } from 'zustand/middleware';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const localStorageStateStorage: StateStorage = {
  getItem: (name) => {
    return getLocalStorage()?.getItem(name) ?? null;
  },

  setItem: (name, value) => {
    getLocalStorage()?.setItem(name, value);
  },

  removeItem: (name) => {
    getLocalStorage()?.removeItem(name);
  },
};
