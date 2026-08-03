![banner.png](assets/banner.png)

CC Café is an open-source Sims 4 mod manager built as a monolithic Electron + Next.js desktop app.

## What It Does

- CurseForge browse, creators, downloads, and updates
- Local mod import and profile management
- Fake mod detection and reporting
- S4MM-style tools for duplicate scans, CC package analysis, ID conflict checks, polygon scans, empty folder cleanup, and pack disable commands
- Sims Log Enabler installation and game log viewing
- Create Studio foundation for persistent AI-assisted Sims 4 CC production projects

## Create Studio Foundation

Create Studio is the beginning of a structured AI production workspace for Sims 4 custom content. The current foundation focuses on safe, static Build/Buy décor and provides:

- A project wizard for prompts, object categories, swatch counts, notes, and reference images
- Per-project workspaces stored in CC Café application data rather than the Sims 4 Mods folder
- Project manifests and folders for references, briefs, concepts, models, textures, Sims output, previews, reports, and logs
- An eight-stage production pipeline covering creative direction, concept art, 3D generation, Blender processing, texturing, Sims packaging, QA, and publishing
- Persistent stage status, progress, failure state, and approval gates
- A working Creative Director stage that writes an asset brief for creator approval
- Browser-preview persistence through local storage when Electron APIs are unavailable

The model-generation, Blender automation, texturing, and Sims package workers are intentionally represented as explicit later integrations. The foundation does not yet claim to produce a finished `.package` file.

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
- Electron main-process code lives in `app/electron/`.
- The repo is set up for branch-protected `main` with GitHub Actions verification.
- Keep changes on feature branches and merge through pull requests.

## Notes

- The top-level `updates/` folder is kept for release artifacts and manifest output placeholder.
