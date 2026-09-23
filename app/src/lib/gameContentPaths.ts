import { getCompatStorageItem, setCompatStorageItem } from '@/lib/utils/storageCompat';

export const INZOI_CONTENT_PATH_KEY = 'cccafe_inzoi_content_path';
export const PARALIVES_MODS_PATH_KEY = 'cccafe_paralives_mods_path';

export type ContentPathGame = 'inzoi' | 'paralives';

export function contentPathKey(gameId: string): string | null {
  if (gameId === 'inzoi') return INZOI_CONTENT_PATH_KEY;
  if (gameId === 'paralives') return PARALIVES_MODS_PATH_KEY;
  return null;
}

async function encryptPath(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode('cccafe-settings'));
  const key = await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(data));
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  let binary = '';
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

async function decryptPath(encryptedData: string): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode('cccafe-settings'));
    const key = await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['decrypt']);
    const binary = atob(encryptedData);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) },
      key,
      combined.slice(12)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function readStoredContentRoot(gameId: ContentPathGame): Promise<string> {
  const stored = getCompatStorageItem(contentPathKey(gameId) ?? '');
  if (!stored) return '';
  return (await decryptPath(stored)) ?? '';
}

export async function writeStoredContentRoot(gameId: ContentPathGame, folder: string): Promise<void> {
  const key = contentPathKey(gameId);
  if (!key) return;
  setCompatStorageItem(key, await encryptPath(folder));
}
