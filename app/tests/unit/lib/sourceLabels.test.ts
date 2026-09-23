import { describe, expect, it } from 'vitest';
import { chosenSlot, sanitizeSourceLabels } from '@/lib/sourceLabels';

describe('custom Patreon and Tumblr labels', () => {
  it('keeps a custom label and icon for each slot', () => {
    expect(
      sanitizeSourceLabels({
        patreon: { label: '  Paid ', icon: 'gift' },
        tumblr: { label: '', icon: 'nope' },
      })
    ).toEqual({
      patreon: { label: 'Paid', icon: 'gift' },
      tumblr: { label: 'Tumblr', icon: 'tumblr' },
    });
  });

  it('uses a manual choice ahead of a detected site', () => {
    expect(chosenSlot({ 'hair.package': 'tumblr' }, 'hair.package', 'Patreon')).toBe('tumblr');
    expect(chosenSlot({ 'hair.package': 'none' }, 'hair.package', 'Patreon')).toBeNull();
    expect(chosenSlot({}, 'hair.package', 'Tumblr')).toBe('tumblr');
  });
});
