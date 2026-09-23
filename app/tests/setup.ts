/**
 * Vitest global test setup
 */

import '@testing-library/jest-dom/vitest';

// Node 26 exposes an unusable localStorage placeholder unless a storage file
// is configured. Give jsdom-backed tests the browser storage they expect.
const testStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => testStorage.get(key) ?? null,
    setItem: (key: string, value: string) => testStorage.set(key, String(value)),
    removeItem: (key: string) => testStorage.delete(key),
    clear: () => testStorage.clear(),
    key: (index: number) => Array.from(testStorage.keys())[index] ?? null,
    get length() { return testStorage.size; },
  },
  configurable: true,
});

Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: vi.fn(),
    },
  },
  writable: true,
});
