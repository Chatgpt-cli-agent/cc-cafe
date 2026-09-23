import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface LinuxBuildConfiguration {
  executableArgs?: string[];
  mimeTypes?: string[];
  protocols?: Array<{ schemes?: string[] }>;
}

interface BuildConfiguration {
  fileAssociations?: unknown[];
  protocols?: Array<{ schemes?: string[] }>;
  linux?: LinuxBuildConfiguration;
}

interface PackageConfiguration {
  build?: BuildConfiguration;
}

const packageConfiguration = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as PackageConfiguration;

describe('desktop protocol associations', () => {
  it('does not register or accept TSR CC Manager links', () => {
    const build = packageConfiguration.build ?? {};
    const linux = build.linux ?? {};
    const declaredSchemes = [...(build.protocols ?? []), ...(linux.protocols ?? [])]
      .flatMap((protocol) => protocol.schemes ?? [])
      .map((scheme) => scheme.toLowerCase());
    const mimeTypes = (linux.mimeTypes ?? []).map((mimeType) => mimeType.toLowerCase());

    expect(declaredSchemes).not.toContain('tsrcc');
    expect(mimeTypes).not.toContain('x-scheme-handler/tsrcc');
    expect(build.fileAssociations ?? []).toHaveLength(0);
    expect(linux.executableArgs).toEqual(['%f']);
    expect(linux.executableArgs).not.toContain('%u');
    expect(linux.executableArgs).not.toContain('%U');
  });
});
