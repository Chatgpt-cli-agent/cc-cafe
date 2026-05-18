'use client';

const CURRENT_PREFIX = 'cccafe_';
const LEGACY_PREFIX = ['sims', 'forge_'].join('');

export function getCompatStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const current = localStorage.getItem(key);
  if (current !== null) {
    return current;
  }

  if (key.startsWith(CURRENT_PREFIX)) {
    const legacyKey = `${LEGACY_PREFIX}${key.slice(CURRENT_PREFIX.length)}`;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      return legacy;
    }
  }

  return null;
}

export function setCompatStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(key, value);

  if (key.startsWith(CURRENT_PREFIX)) {
    localStorage.setItem(`${LEGACY_PREFIX}${key.slice(CURRENT_PREFIX.length)}`, value);
  }
}

export function removeCompatStorageItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(key);

  if (key.startsWith(CURRENT_PREFIX)) {
    localStorage.removeItem(`${LEGACY_PREFIX}${key.slice(CURRENT_PREFIX.length)}`);
  }
}

export function getCompatSessionStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const current = sessionStorage.getItem(key);
  if (current !== null) {
    return current;
  }

  if (key.startsWith(CURRENT_PREFIX)) {
    const legacyKey = `${LEGACY_PREFIX}${key.slice(CURRENT_PREFIX.length)}`;
    const legacy = sessionStorage.getItem(legacyKey);
    if (legacy !== null) {
      sessionStorage.setItem(key, legacy);
      return legacy;
    }
  }

  return null;
}

export function setCompatSessionStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(key, value);

  if (key.startsWith(CURRENT_PREFIX)) {
    sessionStorage.setItem(`${LEGACY_PREFIX}${key.slice(CURRENT_PREFIX.length)}`, value);
  }
}
