/**
 * Copies non-TypeScript runtime assets into dist-main after tsc compilation.
 * electron/core holds the legacy S4MM DBPF reader modules (plain JS).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'electron/core');
const dest = path.join(root, 'dist-main/core');

function copyRecursive(from, to) {
  const stats = fs.statSync(from);
  if (stats.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
    return;
  }
  if (from.endsWith('.ts')) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(src)) {
  console.warn('[copy-core] electron/core not found; skipping');
  process.exit(0);
}

copyRecursive(src, dest);
console.log('[copy-core] Copied electron/core -> dist-main/core');
