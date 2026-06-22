const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'electron', 'core');
const targetDir = path.join(__dirname, '..', 'dist-main', 'core');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.js'));
for (const file of files) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
}

console.log(`Copied ${files.length} core JS file(s) to ${targetDir}`);
