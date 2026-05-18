![banner.png](assets/banner.png)

CC Café is an open-source Sims 4 mod manager built as a monolithic Electron + Next.js desktop app.

## What It Does

- CurseForge browse, creators, downloads, and updates
- Local mod import and profile management
- Fake mod detection and reporting
- S4MM-style tools for duplicate scans, CC package analysis, ID conflict checks, polygon scans, empty folder cleanup, and pack disable commands
- Sims Log Enabler installation and game log viewing

## Repository Layout

```
CC Café/
├── app/       # Electron + Next.js application
├── assets/    # Repo-level artwork and banner assets
├── scripts/   # Small repo helpers
└── updates/   # Update manifest output placeholder
```

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer

## Setup

```bash
cd app
npm install
```

## Build Guide

From the `app/` folder:

```bash
npm install
npx prisma generate
npx prisma db push
```

Run the app in development:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run checks locally:

```bash
npm test
npm run lint
```

Package the desktop app:

```bash
npm run release
```

## Development Notes

- The app runtime is Electron-based.
- The repo is set up for branch-protected `main` with GitHub Actions verification.
- Keep changes on feature branches and merge through pull requests.

## Notes

- The top-level `updates/` folder is kept for release artifacts and manifest output.

