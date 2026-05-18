/**
 * Vitest global test setup
 */

import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: vi.fn(),
    },
  },
  writable: true,
});
