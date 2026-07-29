import { describe, expect, it } from 'vitest';

import { getModSelectionKey } from '@/lib/utils/modSelection';
import type { ProfileMod } from '@/types/profile';

describe('getModSelectionKey', () => {
  it('keeps CurseForge and local identifiers in separate namespaces', () => {
    expect(getModSelectionKey({ modId: 42, isLocal: false } as ProfileMod)).toBe('mod:42');
    expect(getModSelectionKey({ isLocal: true, localModId: '42' } as ProfileMod)).toBe('local:42');
  });

  it('uses string mod identifiers without losing their value', () => {
    expect(getModSelectionKey({ modId: 'imported-7' } as ProfileMod)).toBe('mod:imported-7');
  });
});
