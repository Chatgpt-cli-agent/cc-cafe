import { describe, expect, it } from 'vitest';
import { detectModSource } from '@/lib/modSource';

describe('mod download source', () => {
  it('reads Patreon from a folder and Tumblr from a file name', () => {
    expect(detectModSource({ relativePath: 'Patreon/creator/hair.package' })).toMatchObject({
      label: 'Patreon',
      evidence: 'folder',
    });
    expect(detectModSource({ relativePath: 'CC/bangs_tumblr.package' })).toMatchObject({
      label: 'Tumblr',
      evidence: 'filename',
    });
  });

  it('prefers a link stored in the file over the folder name', () => {
    const bytes = new TextEncoder().encode('credits https://creator.tumblr.com/post/1');
    expect(
      detectModSource({
        relativePath: 'Patreon/hair.package',
        bytes,
      })
    ).toMatchObject({ label: 'Tumblr', evidence: 'link' });
  });

  it('returns nothing when the file does not mention a site', () => {
    expect(detectModSource({ relativePath: 'CC/random_hair.package' })).toBeNull();
  });
});
