# Atlas — Agent Instructions

## Running the app

```bash
npm install
npm run dev        # frontend (5173) + backend (3001) concurrently
npm run build      # tsc && vite build → dist/
npm run preview    # serve dist/
```

`npm run dev` starts two processes: `tsx server/index.ts` (Express on 3001) and `vite` (dev server on 5173). The Vite dev server proxies `/api` to the Express backend.

## Architecture

- **Frontend**: `src/` — React 18 + Vite + TypeScript. Entry: `src/main.tsx` → `App.tsx`.
- **Backend**: `server/` — Express 5. Entry: `server/index.ts`.
- **Database**: `server/db.ts` initializes SQLite at `data/tasks.db` on first run (auto-creates tables and seed roles).
- **Execution engine**: `server/executor.ts` — orchestrates task → subtask decomposition and AI calls.
- **AI providers**: `server/ai/` — `OllamaProvider` (default), `OpenAIProvider`. Configured via Settings page, stored in SQLite `settings` table.

## Routes (frontend)

| Path | Component |
|------|-----------|
| `/` | `DashboardPage` |
| `/kanban` | `KanbanPage` |
| `/settings` | `SettingsPage` |
| `/task/:id` | `TaskDetail` |

## API routes (backend)

All prefixed with `/api/`: `tasks`, `subtasks`, `settings`, `execute`, `execute/subtask`, `roles`. See `server/routes/`.

## Key conventions

- **shadcn/ui v4.12** uses Base UI (`@base-ui/react`) — **no `asChild` prop**. Use `NavLink` with matching sidebar CSS classes instead.
- TypeScript path alias: `@/*` → `./src/*` (both `tsconfig.json` and Vite alias).
- Tailwind v4 with `@tailwindcss/postcss`. CSS imports in `src/index.css` use `@import "tailwindcss"` syntax.
- `rsc: false` in `components.json` — this is a client-rendered app, no Server Components.
- Database auto-seeds 4 roles on first run: `planner`, `researcher`, `writer`, `reviewer`.
- `.env` is gitignored; no env vars are required (settings UI persists to SQLite).

## Build / typecheck

```bash
npx tsc --noEmit    # typecheck only
npm run build        # typecheck + Vite production build
```

## Database

SQLite WAL mode, foreign keys enabled. Tables live in `server/db.ts`. The `data/` directory is gitignored — delete `data/tasks.db` to reset state.
