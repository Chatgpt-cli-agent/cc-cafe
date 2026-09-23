import fs from 'fs';
import path from 'path';

const { ArchiveUtil } = require('../../core2/ArchiveUtil');

export interface ArchiveEntry {
  name: string;
  internalPath: string;
  size: number;
}

export interface ArchiveListResult {
  files: ArchiveEntry[];
  simsFiles: ArchiveEntry[];
  containsSimsFiles: boolean;
}

/**
 * Port of the S4MM 2.0 archive helper (utils/ArchiveUtil.js). Adds RAR
 * support (via node-unrar-js) next to the existing ZIP handling so archives
 * from mod sites can be inspected and extracted during import.
 */
export class ArchiveService {
  async listContents(archivePath: string): Promise<ArchiveListResult> {
    const files: ArchiveEntry[] = await ArchiveUtil.getFileListFromArchive(archivePath);
    const simsFiles: ArchiveEntry[] = ArchiveUtil.filterSimsFiles(files);
    return {
      files,
      simsFiles,
      containsSimsFiles: simsFiles.length > 0,
    };
  }

  async extractFile(archivePath: string, internalPath: string): Promise<Buffer> {
    return ArchiveUtil.extractFileFromArchive(archivePath, internalPath);
  }

  async extractAll(archivePath: string, outputDir: string): Promise<{ extractedFiles: string[] }> {
    fs.mkdirSync(outputDir, { recursive: true });
    await ArchiveUtil.extractAllFromArchive(archivePath, outputDir);

    const extractedFiles: string[] = [];
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else extractedFiles.push(fullPath);
      }
    };
    walk(outputDir);
    return { extractedFiles };
  }
}

export const archiveService = new ArchiveService();
