import fs from 'fs/promises';
import path from 'path';

/**
 * Recursively collects files below rootPath matching the given extensions
 * (lowercase, with leading dot). Shared helper for the S4MM 2.0 tool ports.
 */
export async function walkFiles(rootPath: string, extensions: string[]): Promise<string[]> {
  const results: string[] = [];

  const walk = async (currentPath: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (extensions.some((ext) => lower.endsWith(ext))) {
          results.push(fullPath);
        }
      }
    }
  };

  await walk(rootPath);
  return results;
}

export async function walkPackageFiles(rootPath: string): Promise<string[]> {
  return walkFiles(rootPath, ['.package']);
}
