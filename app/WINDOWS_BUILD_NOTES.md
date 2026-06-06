# Windows Build Notes

## Packaged Prisma and dotenv runtime dependencies

If the packaged Windows app opens with a main-process error like this:

```text
Cannot find module '.prisma/client/default'
```

or later fails because `dotenv` is missing, the Electron package is missing runtime files that are generated or installed under `node_modules`.

The real app folder is:

```powershell
C:\Users\jmoor\SimsWorld\Batuu\cc-cafe\app
```

Build from that folder only:

```powershell
npm run release:win
```

Do not run the build from the repository root, and do not use `npm run make`.

## Required package.json settings

`npm run build` must run Prisma generation before packaging:

```json
"build": "prisma generate && next build && tsc -p tsconfig.main.json && powershell -Command \"Copy-Item electron/core/*.js dist-main/core/ -Force\""
```

Electron Builder must include and unpack Prisma and dotenv runtime files:

```json
"asarUnpack": [
  "assets/tools/**/*.exe",
  "**/node_modules/.prisma/**",
  "**/node_modules/@prisma/client/**",
  "**/node_modules/dotenv/**"
],
"extraResources": [
  {
    "from": "node_modules/.prisma",
    "to": "app.asar.unpacked/node_modules/.prisma"
  },
  {
    "from": "node_modules/dotenv",
    "to": "app.asar.unpacked/node_modules/dotenv"
  }
],
"files": [
  "dist/**",
  "dist-main/**/*",
  "out/**/*",
  "assets/**/*",
  "public/**/*",
  "prisma/**/*",
  "node_modules/.prisma/**",
  "node_modules/@prisma/client/**",
  "node_modules/dotenv/**",
  "package.json"
]
```

## Clean rebuild

```powershell
cd C:\Users\jmoor\SimsWorld\Batuu\cc-cafe\app
Remove-Item -Recurse -Force .\dist-build -ErrorAction SilentlyContinue
npm install
npx prisma generate
npm run release:win
```

## Required verification

After the build, these must return `True`:

```powershell
Test-Path ".\dist-build\win-unpacked\resources\app.asar.unpacked\node_modules\.prisma\client\default.js"
Test-Path ".\dist-build\win-unpacked\resources\app.asar.unpacked\node_modules\.prisma\client\index.js"
Test-Path ".\dist-build\win-unpacked\resources\app.asar.unpacked\node_modules\dotenv"
```

After installing `dist-build\CC Cafe Setup 0.5.0.exe`, these must also return `True`:

```powershell
Test-Path "C:\Users\jmoor\AppData\Local\Programs\CC Cafe\resources\app.asar.unpacked\node_modules\.prisma\client\default.js"
Test-Path "C:\Users\jmoor\AppData\Local\Programs\CC Cafe\resources\app.asar.unpacked\node_modules\.prisma\client\index.js"
Test-Path "C:\Users\jmoor\AppData\Local\Programs\CC Cafe\resources\app.asar.unpacked\node_modules\dotenv"
```

If any of those checks return `False`, the packaged app can still crash even if it works in development.
