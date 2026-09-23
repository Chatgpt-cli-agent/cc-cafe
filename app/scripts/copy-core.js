/**
 * Copies non-TypeScript runtime assets into dist-main after tsc compilation:
 * - electron/core: legacy S4MM 1.x DBPF reader modules (plain JS)
 * - electron/core2: S4MM 2.0 DBPF reader modules (plain JS) and template
 *   assets in core2/files (proto schema, GFX template buffers, cover images)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distMain = path.join(root, 'dist-main');

const folders = ['electron/core', 'electron/core2'];

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  // TypeScript sources are compiled by tsc; copy everything else.
  if (src.endsWith('.ts')) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const folder of folders) {
  const src = path.join(root, folder);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(distMain, folder.replace(/^electron\//, ''));
  copyRecursive(src, dest);
  console.log(`[copy-core] Copied ${folder} -> ${path.relative(root, dest)}`);
}
