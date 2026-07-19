const { ArchiveUtil } = require('../../core2/ArchiveUtil');

export interface ArchiveListResult {
  files: string[];
  simsFiles: string[];
  containsSimsFiles: boolean;
}

/**
 * Port of the S4MM 2.0 archive helper (utils/ArchiveUtil.js). Adds RAR
 * support (via node-unrar-js) next to the existing ZIP handling so archives
 * from mod sites can be inspected and extracted during import.
 */
export class ArchiveService {
  async listContents(archivePath: string): Promise<ArchiveListResult> {
    const files: string[] = await ArchiveUtil.getFileListFromArchive(archivePath);
    const simsFiles: string[] = ArchiveUtil.filterSimsFiles(files);
    return {
      files,
      simsFiles,
      containsSimsFiles: simsFiles.length > 0,
    };
  }

  async extractFile(archivePath: string, internalPath: string): Promise<Buffer> {
    return ArchiveUtil.extractFileFromArchive(archivePath, internalPath);
  }

  async extractAll(archivePath: string, outputDir: string): Promise<string[]> {
    return ArchiveUtil.extractAllFromArchive(archivePath, outputDir);
  }
}

export const archiveService = new ArchiveService();
