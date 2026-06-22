const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const coreSource = path.join(rootDir, 'electron', 'core');
const coreTarget = path.join(rootDir, 'dist-main', 'core');
fs.mkdirSync(coreTarget, { recursive: true });
const coreFiles = fs.readdirSync(coreSource).filter((f) => f.endsWith('.js'));
for (const file of coreFiles) {
  fs.copyFileSync(path.join(coreSource, file), path.join(coreTarget, file));
}
console.log(`Copied ${coreFiles.length} core JS file(s) to ${coreTarget}`);

const prismaSource = path.join(rootDir, 'electron', 'generated', 'prisma');
const prismaTarget = path.join(rootDir, 'dist-main', 'generated', 'prisma');
if (fs.existsSync(prismaSource)) {
  copyDir(prismaSource, prismaTarget);
  console.log(`Copied generated Prisma client to ${prismaTarget}`);
} else {
  console.warn(`Generated Prisma client not found at ${prismaSource}; run prisma generate`);
  process.exit(1);
}

const schemaSource = path.join(rootDir, 'prisma', 'schema.prisma');
const schemaTarget = path.join(prismaTarget, 'schema.prisma');
fs.copyFileSync(schemaSource, schemaTarget);
console.log(`Copied schema.prisma to ${schemaTarget}`);
