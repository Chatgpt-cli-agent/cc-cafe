import path from 'path';
import axios from 'axios';
import { walkFiles } from './walkPackages';
import { modsIndexService } from './ModsIndexService';

const { Fingerprint } = require('../../core2/Fingerprint');

const CURSEFORGE_FINGERPRINT_URL = 'https://api.curseforge.com/v1/fingerprints';
const BATCH_SIZE = 100;

export interface FingerprintedFile {
  path: string;
  name: string;
  fingerprint: number;
}

export interface FingerprintMatch {
  fingerprint: number;
  modId: number;
  fileId: number;
  fileName: string;
  displayName: string;
  downloadUrl: string | null;
}

export interface FingerprintScanResult {
  files: FingerprintedFile[];
  fileCount: number;
}

export interface FingerprintMatchResult {
  matches: FingerprintMatch[];
  unmatchedFingerprints: number[];
}

/**
 * Port of the S4MM 2.0 CurseForge fingerprint pipeline (utils/Fingerprint.js +
 * curseforge.controller.js). Computes MurmurHash2-based CurseForge fingerprints
 * for local files and resolves them to CurseForge mods via the fingerprints API.
 */
export class FingerprintService {
  computeForFile(filePath: string): number {
    return Fingerprint.computeFile(filePath);
  }

  async scanFolder(rootPath: string): Promise<FingerprintScanResult> {
    const indexed = await modsIndexService.listFingerprintedFiles(rootPath);
    if (indexed) {
      return { files: indexed, fileCount: indexed.length };
    }

    const files = await walkFiles(rootPath, ['.package', '.ts4script', '.zip', '.rar']);
    const results: FingerprintedFile[] = [];

    for (const filePath of files) {
      try {
        const fingerprint = Fingerprint.computeFile(filePath);
        if (typeof fingerprint === 'number' && fingerprint > 0) {
          results.push({
            path: path.dirname(filePath),
            name: path.basename(filePath),
            fingerprint,
          });
        }
      } catch (error) {
        console.error('[FingerprintService] Failed to fingerprint', filePath, error);
      }
    }

    return { files: results, fileCount: files.length };
  }

  async matchFingerprints(apiKey: string, fingerprints: number[]): Promise<FingerprintMatchResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('CurseForge API key is required');
    }

    const matches: FingerprintMatch[] = [];
    const unmatched: number[] = [];
    const unique = Array.from(new Set(fingerprints.filter((value) => Number.isFinite(value) && value > 0)));

    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);
      try {
        const response = await axios.post(
          CURSEFORGE_FINGERPRINT_URL,
          { fingerprints: batch },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'x-api-key': apiKey,
            },
            timeout: 30000,
          }
        );

        const data = response.data?.data;
        const exactMatches: any[] = data?.exactMatches ?? [];
        const matchedSet = new Set<number>();

        for (const match of exactMatches) {
          const file = match?.file;
          if (!file) continue;
          matchedSet.add(Number(file.fileFingerprint));
          matches.push({
            fingerprint: Number(file.fileFingerprint),
            modId: Number(match.id),
            fileId: Number(file.id),
            fileName: String(file.fileName ?? ''),
            displayName: String(file.displayName ?? file.fileName ?? ''),
            downloadUrl: file.downloadUrl ?? null,
          });
        }

        for (const fingerprint of batch) {
          if (!matchedSet.has(fingerprint)) {
            unmatched.push(fingerprint);
          }
        }
      } catch (error: any) {
        console.error('[FingerprintService] Fingerprint match batch failed:', error?.message);
        unmatched.push(...batch);
      }
    }

    return { matches, unmatchedFingerprints: unmatched };
  }
}

export const fingerprintService = new FingerprintService();
