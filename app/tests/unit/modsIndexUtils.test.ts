import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  MAX_FINGERPRINT_BYTES,
  MOD_INDEX_FILE_TYPE,
  calcMfolder,
  classifyModIndexFile,
  fileKindToType,
  shouldFingerprint,
} from '../../electron/services/s4mm/modsIndexUtils';

describe('modsIndexUtils', () => {
  it('classifies package, script, and archive extensions', () => {
    expect(classifyModIndexFile('Hair.package')).toBe('package');
    expect(classifyModIndexFile('Hair.packageOFF')).toBe('package');
    expect(classifyModIndexFile('script.ts4script')).toBe('script');
    expect(classifyModIndexFile('script.ts4scriptoff')).toBe('script');
    expect(classifyModIndexFile('bundle.zip')).toBe('other');
    expect(classifyModIndexFile('bundle.rar')).toBe('other');
    expect(classifyModIndexFile('notes.txt')).toBeNull();
  });

  it('maps kinds to S4MM file type integers', () => {
    expect(fileKindToType('package')).toBe(MOD_INDEX_FILE_TYPE.PACKAGE);
    expect(fileKindToType('script')).toBe(MOD_INDEX_FILE_TYPE.SCRIPT);
    expect(fileKindToType('other')).toBe(MOD_INDEX_FILE_TYPE.OTHER);
  });

  it('computes relative mfolder with forward slashes', () => {
    const root = path.join('Users', 'me', 'Mods');
    const nested = path.join(root, 'CAS', 'Hair');
    expect(calcMfolder(root, nested)).toBe('CAS/Hair');
    expect(calcMfolder(root, root)).toBe('');
  });

  it('skips fingerprinting oversized files and resource.cfg', () => {
    expect(shouldFingerprint(1024, 'mod.package')).toBe(true);
    expect(shouldFingerprint(MAX_FINGERPRINT_BYTES, 'mod.package')).toBe(false);
    expect(shouldFingerprint(10, 'Resource.cfg')).toBe(false);
    expect(shouldFingerprint(0, 'mod.package')).toBe(false);
  });
});
