import fs from 'fs';
import os from 'os';
import path from 'path';
import { walkFiles } from './walkPackages';

const { Pack } = require('../../core2/DBPFReader');
const { SimsImageUtil } = require('../../core2/SimsImageUtil');

const GFX_TYPE = 0x62ecc59a;
const LOADING_SCREEN_INSTANCE_HI = 0x432d1d2a;
const LOADING_SCREEN_INSTANCE_LO = 0xddffc6d8;
const MAIN_MENU_INSTANCE_HI = 0x6d20ab71;
const MAIN_MENU_INSTANCE_LO = 0x641b1539;

export interface LoadingScreenOptions {
  showTips?: boolean;
  tipsColor?: string;
}

export interface CreatorPackageInfo {
  path: string;
  name: string;
  kind: 'loading-screen' | 'main-menu';
  active: boolean;
}

export interface CreatorScanResult {
  items: CreatorPackageInfo[];
  fileCount: number;
}

export interface RandomizeChange {
  oldFileName: string;
  newFileName: string;
  oldFilePath: string;
  newFilePath: string;
}

export interface RandomizeResult {
  onChanges: RandomizeChange[];
  offChanges: RandomizeChange[];
}

/**
 * Port of the S4MM 2.0 loading screen and main menu creator tools
 * (tools/loadingscreen.tool.js, tools/mainmenu.tool.js, utils/SimsImageUtil.js).
 * Builds loading screen / main menu override packages out of a user image
 * using the S4MM GFX template buffers shipped in core2/files.
 */
export class CreatorToolsService {
  private templatePath(fileName: string): string {
    const file = path.join(__dirname, '..', '..', 'core2', 'files', fileName);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing template asset: ${file}`);
    }
    return file;
  }

  private async prepareImage(imagePath: string): Promise<string> {
    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }

    const tmpFolder = path.join(os.tmpdir(), 'cc-cafe-creator');
    fs.mkdirSync(tmpFolder, { recursive: true });
    const resized = path.join(tmpFolder, `input_${Date.now()}.png`);
    const result = await SimsImageUtil.resizeImageTo(imagePath, resized, 1920, 1080);
    if (!result) {
      throw new Error('Failed to resize image to 1920x1080');
    }
    return resized;
  }

  async createLoadingScreen(outputPath: string, imagePath: string, options?: LoadingScreenOptions): Promise<{ file: string }> {
    const pre = this.templatePath('img_loading_pre.bnry');
    const post = this.templatePath('img_loading_post.bnry');
    const image = await this.prepareImage(imagePath);

    await SimsImageUtil.createLoadingScreenPackage(outputPath, image, pre, post, {
      showTips: options?.showTips ?? true,
      tipsColor: options?.tipsColor ?? '#FFFFFF',
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Loading screen package was not created');
    }
    return { file: outputPath };
  }

  async createMainMenu(outputPath: string, imagePath: string): Promise<{ file: string }> {
    const pre = this.templatePath('main_menu_pre.bnry');
    const post = this.templatePath('main_menu_post.bnry');
    const fade = this.templatePath('main_menu_fade.png');
    const image = await this.prepareImage(imagePath);
    const tmpFolder = path.join(os.tmpdir(), 'cc-cafe-creator');

    await SimsImageUtil.createMainMenuPackage(outputPath, image, pre, post, fade, {}, tmpFolder);

    if (!fs.existsSync(outputPath)) {
      throw new Error('Main menu package was not created');
    }
    return { file: outputPath };
  }

  /**
   * Finds loading screen / main menu override packages in the mods folder by
   * looking for the GFX resource instance the game uses for each override.
   * Files renamed with an "OFF" suffix are reported as inactive, matching the
   * S4MM randomizer convention.
   */
  async scanCreatorPackages(rootPath: string): Promise<CreatorScanResult> {
    const allFiles = await walkFiles(rootPath, ['.package', '.packageoff']);
    const items: CreatorPackageInfo[] = [];

    for (const filePath of allFiles) {
      try {
        const pack = new Pack(filePath);
        pack.checkFile();
        if (pack.error) continue;
        pack.calculateIndexList();

        for (const entry of pack.index_List || []) {
          if (entry.r_type !== GFX_TYPE) continue;

          const active = !filePath.toLowerCase().endsWith('off');
          if (entry.i_hi === LOADING_SCREEN_INSTANCE_HI && entry.i_lo === LOADING_SCREEN_INSTANCE_LO) {
            items.push({ path: path.dirname(filePath), name: path.basename(filePath), kind: 'loading-screen', active });
            break;
          }
          if (entry.i_hi === MAIN_MENU_INSTANCE_HI && entry.i_lo === MAIN_MENU_INSTANCE_LO) {
            items.push({ path: path.dirname(filePath), name: path.basename(filePath), kind: 'main-menu', active });
            break;
          }
        }
      } catch {
        // Unreadable packages are skipped.
      }
    }

    return { items, fileCount: allFiles.length };
  }

  /**
   * Port of the S4MM loading screen randomizer: turns all listed files "off"
   * by appending OFF to the filename, then randomly enables one.
   */
  randomize(filePaths: string[]): RandomizeResult {
    const existing = filePaths.filter((filePath) => fs.existsSync(filePath));
    const onFiles = existing.filter((filePath) => !filePath.toLowerCase().endsWith('off'));
    const offFiles = existing.filter((filePath) => filePath.toLowerCase().endsWith('off'));

    const onChanges: RandomizeChange[] = [];
    const offChanges: RandomizeChange[] = [];

    if (existing.length === 0 || (offFiles.length === 0 && onFiles.length === 1)) {
      return { onChanges, offChanges };
    }

    for (const filePath of onFiles) {
      const newFilePath = `${filePath}OFF`;
      fs.renameSync(filePath, newFilePath);
      offChanges.push({
        oldFileName: path.basename(filePath),
        newFileName: path.basename(newFilePath),
        oldFilePath: filePath,
        newFilePath,
      });
    }

    const candidates = offFiles.length > 0 ? offFiles : offChanges.map((change) => change.newFilePath);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    if (selected) {
      const newFilePath = selected.toLowerCase().endsWith('off') ? selected.slice(0, -3) : selected;
      if (selected.toLowerCase() !== newFilePath.toLowerCase() && fs.existsSync(selected) && !fs.existsSync(newFilePath)) {
        fs.renameSync(selected, newFilePath);
        onChanges.push({
          oldFileName: path.basename(selected),
          newFileName: path.basename(newFilePath),
          oldFilePath: selected,
          newFilePath,
        });
      }
    }

    const turnedOn = new Set(onChanges.map((change) => change.oldFilePath));
    return {
      onChanges,
      offChanges: offChanges.filter((change) => !turnedOn.has(change.newFilePath)),
    };
  }
}

export const creatorToolsService = new CreatorToolsService();
