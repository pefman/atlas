# Atlas — Agent Instructions

## Running the app

```bash
npm install
npm run dev        # frontend (5173) + backend (3001) concurrently
npm run build      # tsc && vite build → dist/
npm run preview    # serve dist/
```

`npm run dev` concurrently runs `tsx server/index.ts` (Express on 3001) and `vite` (dev server on 5173). Vite proxies `/api` to Express.

## Architecture

- **Frontend**: `src/` — React 19 + Vite + TypeScript + shadcn/ui. Entry: `src/main.tsx` wraps `<App />` in `ThemeProvider` → `ErrorBoundary`.
- **Backend**: `server/` — Express 5. Entry: `server/index.ts`. Runs the CEO background worker on boot.
- **Database**: `server/db.ts` creates SQLite at `data/tasks.db` on first run (WAL mode, foreign keys enabled). Auto-seeds 5 roles: `planner`, `researcher`, `writer`, `reviewer`, `ceo`.
- **Execution engine**: `server/executor.ts` — orchestrates task → subtask decomposition and AI calls. The CEO worker polls every 5 s for backlog tasks.
- **AI providers**: `server/ai/` — `OllamaProvider` (default), `OpenAIProvider`. Configured via Settings page, stored in SQLite `settings` table. Subtask execution retries up to 3 steps.

## Frontend routes

| Path | Component |
|------|-----------|
| `/` | `DashboardPage` |
| `/kanban` | `KanbanPage` |
| `/settings` | `SettingsPage` |
| `/task/:id` | `TaskDetail` (rendered inside `App.tsx`, not via React Router) |

## API routes

All prefixed with `/api/`: `tasks`, `subtasks`, `settings`, `execute`, `execute/subtask`, `roles`, `agents`. See `server/routes/`.

## Key conventions

- **shadcn/ui v4.12** uses Base UI (`@base-ui/react`) — **no `asChild` prop**. Use `NavLink` with matching sidebar CSS classes instead.
- TypeScript path alias: `@/*` → `./src/*` (both `tsconfig.json` and Vite alias).
- Tailwind v4 with `@tailwindcss/postcss`. CSS imports in `src/index.css` use `@import "tailwindcss"` syntax. CSS variables are defined in **oklch** (not HSL).
- `rsc: false` in `components.json` — client-rendered, no Server Components.
- **Server uses `tsx` (not `tsc`)**. `tsc --noEmit` only type-checks `src/` — server code is outside `tsconfig.json`'s `include`.
- `better-sqlite3` provides a **synchronous** API (`.get()`, `.run()`, `.all()`), not promise-based.
- `cn()` in `src/lib/utils.ts` wraps `clsx` + `twMerge` for class merging.
- No test framework or lint tool configured.

## Build / typecheck

```bash
npx tsc --noEmit    # typecheck frontend only
npm run build        # typecheck + Vite production build
```

## Database

Tables: `roles`, `tasks`, `subtasks`, `outputs`, `execution_logs`, `settings`.

- `tasks.ceo_status` tracks decomposition state (`idle`, `decomposing`, `decomposed`, `error`).
- `subtasks.assigned_by` defaults to `'ceo'` (set by the executor).
- `execution_logs.step_type`: `decompose`, `assign`, `execute`, `review`.
- `data/` is gitignored — delete `data/tasks.db` to reset state.

## OpenAI endpoint quirk

`OpenAIProvider` normalizes the endpoint URL: if it doesn't end with `/v1`, the path `/v1/chat/completions` is appended automatically. Same for `/v1/models`.
