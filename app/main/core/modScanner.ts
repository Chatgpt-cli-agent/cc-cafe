import * as path from 'path';
import * as fs from 'fs';
const { Pack } = require('./DBPFReader');

export interface ModDetails {
  name: string;
  hasThumbnails: boolean;
  thumbnailCount: number;
  resourceCount: number;
}

/**
 * Service to scan Sims 4 .package files using the s4mm core logic
 */
export class ModScanner {
  /**
   * Scans a .package file and returns details
   * @param filePath Path to the .package file
   */
  async scanPackage(filePath: string): Promise<ModDetails> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      const pack = new Pack(filePath);
      
      // Basic check
      const isValid = pack.checkFile();
      if (!isValid) {
        throw new Error('Invalid DBPF file');
      }

      // Read index
      pack.calculateIndexList();
      
      const resources = pack.indexList || [];
      
      // Check for thumbnails (Type 0x3C1D8799 or similar)
      const thumbnails = resources.filter((res: any) => 
        res.type === 0x3C1D8799 || // Thumbnail
        res.type === 0x00B2D882    // Icon
      );

      return {
        name: path.basename(filePath),
        hasThumbnails: thumbnails.length > 0,
        thumbnailCount: thumbnails.length,
        resourceCount: resources.length
      };
    } catch (error: any) {
      console.error(`Error scanning package ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extracts thumbnails from a .package file
   * @param filePath Path to the .package file
   * @param outputDir Directory to save thumbnails
   */
  async extractThumbnails(filePath: string, outputDir: string): Promise<string[]> {
    const pack = new Pack(filePath);
    pack.calculateIndexList();
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Call the legacy exportThumnails method
    await pack.exportThumnails(outputDir, true, false);
    
    // Return list of files in outputDir
    return fs.readdirSync(outputDir).map(file => path.join(outputDir, file));
  }
}

export const modScanner = new ModScanner();
