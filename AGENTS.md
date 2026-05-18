# AGENTS.md for CC Café

CC Café is a monolithic Electron + Next.js desktop app for The Sims 4. The active runtime lives in `app/`.

## Project Structure

```
CC Café/
└── app/                      # Electron main process + Next.js frontend
    ├── main/                 # Electron main process, IPC, services, core DBPF logic
    ├── prisma/               # SQLite schema and generated client
    └── src/                  # Frontend app, components, hooks, services
```

Reference `README.md` for current setup and feature notes.
Update `README.md` after significant changes.

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4
- Main Process: Electron 42, Node.js, SQLite with Prisma
- Core: s4mm-extracted DBPF logic
- Tools: ESLint, Prettier, npm, electron-builder

## Commands

Always run from `app/`.

```bash
npm install
npx prisma generate
npx prisma db push
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Testing

- Run `npm run lint`
- Run `npm test`
- Run `npm run build`
- Manually launch the app and verify CurseForge, mod import, fake detection, tools, and settings flows

## Git Workflow

1. `git pull origin main --rebase`
2. `git checkout -b <type>/<scope>`
3. Implement changes in small commits.
4. Lint and test before commit.
5. Push the branch and open a PR to `main`.

Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

## Code Style

- English only for code, comments, commits, and docs.
- TypeScript strict mode everywhere.
- Prefer functional React components and hooks.
- Use Zod validation in the main process.
- Avoid direct HTTP calls from components; use `app/src/lib/apiClient.ts`.
- Validate all user input.

## Boundaries

- Do not commit without lint and tests.
- Do not push to `main`.
- Respect environment variables.
- Report blockers instead of guessing.

