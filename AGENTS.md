# Atlas — Agent Instructions

## Running the app

```bash
npm install
npm run dev        # frontend (5173) + backend (3101) concurrently
npm run build      # tsc && vite build → dist/
npm run preview    # serves frontend only, no backend
```

`npm run dev` concurrently runs `tsx server/index.ts` (Express on **3101**) and `vite` (dev server on 5173). Vite proxies `/api` to `http://127.0.0.1:3101`. Vite dev server binds `0.0.0.0` with `strictPort: true`.

## Architecture

- **Frontend**: `src/` — React 19 + Vite + TypeScript + shadcn/ui (Base UI, no `asChild` prop). Entry: `src/main.tsx` wraps `<App />` in `ThemeProvider` → `ErrorBoundary` → `<KanbanStreamProvider>` → `<Router>` (react-router-dom).
- **Backend**: `server/` — Express 5. Entry: `server/index.ts`. Scheduler starts on boot via `scheduler.start()`. Health check at `GET /api/health`.
- **Database**: `server/db.ts` creates SQLite at `data/tasks.db` on first run (WAL mode, foreign keys enabled). Auto-seeds 7 canonical roles: `ceo`, `product_manager`, `tech_lead`, `frontend_developer`, `backend_developer`, `qa_engineer`, `seo_specialist`.
- **Scheduler**: `server/scheduler.ts` — `Scheduler` class with priority queues (high/medium/low). CEO worker polls every 5 s for `status='in_progress' AND ceo_status='idle'` tasks. Subtask retry: `MAX_ATTEMPTS=3`, exponential backoff capped at 5 min. Decomposition retry: `DECOMP_MAX_ATTEMPTS=3`, backoff capped at 30s. AI providers loaded via static `import()` (OllamaProvider, OpenAIProvider).
- **Progress recomputation**: `server/lib/taskProgress.ts` — `recomputeTaskStatus(taskId)` checks if all subtasks are terminal (`done`, `failed`, `review`). Sets task to `review` if any failed, `done` if all succeeded. Emits `task_status_changed` event.
- **AI providers**: `server/ai/` — `OllamaProvider` (default), `OpenAIProvider`. Configured via Settings page, stored in SQLite `settings` table.
- **Event bus**: `server/events.ts` — `execEventBus` emits `notification`, `task_decomposed`, `task_decomposing`, `subtask_start`, `subtask_complete`, `subtask_failed`, `task_completed`, `task_status_changed` for real-time SSE streams.

## Frontend routes (react-router-dom)

| Path | Component |
|------|-----------|
| `/` | `KanbanPage` |
| `/kanban` | `KanbanPage` |
| `/tasks` | `DashboardPage` |
| `/settings` | `SettingsPage` |
| `/task/:id` | `TaskDetail` (via `useParams`) |
| `/subtask/:id` | `SubtaskDetail` |
| `/agent/:id` | `AgentDetail` (fetches from `/api/agents/:id`) |

`App.tsx` also manages an inline agent view via sidebar `selectedAgent` state. `AIStatusIndicator` component renders globally.

## API routes

All prefixed with `/api/`:
- `tasks`, `subtasks`, `settings`, `roles`, `agents`
- `execute` — task execution endpoints
- `execute/subtask` — subtask execution endpoints
- `notifications`, `notifications/stream` — SSE notifications
- `kanban/stream` — SSE kanban updates
- `activity` — GET `/api/activity` returns recent execution logs (joins roles, subtasks, tasks)
- `metrics` — GET `/api/metrics` returns subtask counts, success rate, token usage, call counts, tasks done today

## Key conventions

- **shadcn/ui v4.12** uses Base UI (`@base-ui/react`) — **no `asChild` prop**.
- TypeScript path alias: `@/*` → `./src/*` (both `tsconfig.json` and Vite).
- Tailwind v4 with `@tailwindcss/postcss`. CSS imports in `src/index.css` use `@import "tailwindcss"` syntax. CSS variables are defined in **oklch**.
- `rsc: false` in `components.json` — client-rendered, no Server Components.
- **Server uses `tsx` (not `tsc`)**. `tsc --noEmit` only type-checks `src/` — server code is outside `tsconfig.json`'s `include`.
- `better-sqlite3` provides a **synchronous** API (`.get()`, `.run()`, `.all()`), not promise-based.
- `cn()` in `src/lib/utils.ts` wraps `clsx` + `twMerge` for class merging.
- `tsconfig.json` has `noUnusedLocals: false` and `noUnusedParameters: false` — unused vars are allowed.
- No test framework or lint tool configured.
- Server has unhandled rejection / uncaught exception handlers that `process.exit(1)` on error.
- `setInterval(() => {}, ...)` keepalive in `server/index.ts:56` prevents Node from exiting.

## Build / typecheck

```bash
npx tsc --noEmit    # typecheck frontend only (server code excluded)
npm run build        # tsc --noEmit && vite build (production)
```

## Database

Tables: `roles`, `tasks`, `subtasks`, `outputs`, `execution_logs`, `settings`, `notifications`, `agent_stats`.

- `tasks.status`: `backlog` → `in_progress` → `done` / `review` (if any subtask failed) / `failed`.
- `tasks.ceo_status`: `idle`, `decomposing`, `decomposed`, `error`.
- `subtasks.status`: `backlog` → `in_progress` → `done` / `failed` / `review`.
- `subtasks.assigned_by` defaults to `'ceo'` (set by the scheduler).
- `execution_logs.step_type`: `assign`, `execute`. `step` tracks retry attempt number.
- `agent_stats` tracks per-role token usage and call counts.
- `notifications` stores system notifications with `is_read` flag.
- `data/` is gitignored — delete `data/tasks.db` to reset state.
- DB auto-migrates: adds `priority` column to `tasks` if missing.

## OpenAI endpoint quirk

`OpenAIProvider` normalizes the endpoint URL: if it doesn't end with `/v1`, the path `/v1/chat/completions` is appended automatically. Same for `/v1/models`.
