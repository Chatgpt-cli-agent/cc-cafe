import type { ProfileMod } from '@/types/profile';

export function getModSelectionKey(mod: ProfileMod): string {
  return mod.isLocal && mod.localModId
    ? `local:${mod.localModId}`
    : `mod:${String(mod.modId)}`;
}
