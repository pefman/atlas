# Atlas — Agent Instructions

## Running

```bash
npm install
npm run dev        # frontend (5173) + backend (3101) via concurrently
npm run build      # tsc --noEmit && vite build → dist/
npm run preview    # serves dist/ only, no backend
```

`npm run dev` runs `tsx server/index.ts` (Express on **3101**) and `vite` (5173). Vite proxies `/api` to `http://127.0.0.1:3101`. Vite binds `0.0.0.0` with `strictPort: true`.

## Architecture

- **Frontend**: `src/` — React 19 + Vite + TypeScript + shadcn/ui v4 (Base UI, **no `asChild` prop**). Entry: `src/main.tsx` wraps `<App />` in `ThemeProvider` → `ErrorBoundary` → `<KanbanStreamProvider>` → `<Router>`.
- **Backend**: `server/` — Express 5. Entry: `server/index.ts`. Scheduler starts on boot via `scheduler.start()`. Health: `GET /api/health`.
- **Database**: `server/db.ts` creates SQLite at `data/tasks.db` on first run (WAL mode, FK enabled). Auto-seeds 7 canonical roles.
- **Scheduler**: `server/scheduler.ts` — `Scheduler` class with priority queues (high/medium/low). CEO worker polls every 5s for `status='in_progress' AND ceo_status='idle'`. Subtask retry: `MAX_ATTEMPTS=3`, backoff capped at 5min. Decomposition retry: `DECOMP_MAX_ATTEMPTS=3`, backoff capped at 30s.
- **Progress recomputation**: `server/lib/taskProgress.ts` — `recomputeTaskStatus(taskId)` sets task to `review` if any subtask failed, `done` if all succeeded.
- **AI providers**: `server/ai/` — `OllamaProvider` (default), `OpenAIProvider`. Configured via Settings, stored in `settings` table.
- **Event bus**: `server/events.ts` — emits `notification`, `task_decomposed`, `task_decomposing`, `subtask_start`, `subtask_complete`, `subtask_failed`, `task_completed`, `task_status_changed` for SSE streams.

## Frontend routes

| Path | Component |
|------|-----------|
| `/`, `/kanban` | `KanbanPage` |
| `/tasks` | `DashboardPage` |
| `/projects` | `ProjectsPage` |
| `/repos` | `ReposPage` |
| `/messages` | `MessagesPage` |
| `/agents` | `AgentsPage` |
| `/settings` | `SettingsPage` |
| `/task/:id` | `TaskDetailPage` |
| `/subtask/:id` | `SubtaskDetailPage` |
| `/agent/:id` | `AgentDetailPage` |

## API routes (all under `/api/`)

| Prefix | File | Notes |
|--------|------|-------|
| `tasks`, `subtasks` | `routes/tasks.ts`, `routes/subtasks.ts` | CRUD + status updates |
| `execute`, `execute/subtask` | `routes/execute.ts`, `routes/executeSubtask.ts` | Task/subtask execution |
| `roles` | `routes/roles.ts` | List canonical roles |
| `agents` | `routes/agents.ts` | Agent CRUD + assigned work |
| `settings` | `routes/settings.ts` | AI provider config |
| `notifications` | `routes/notifications.ts` | CRUD notifications |
| `notifications/stream` | `routes/notificationsStream.ts` | SSE notifications |
| `kanban/stream` | `routes/kanbanStream.ts` | SSE kanban updates |
| `activity` | `routes/activity.ts` | Recent execution logs |
| `metrics` | `routes/metrics.ts` | Subtask counts, success rate, token usage |
| `messages/threads` | `routes/messages.ts` | Thread CRUD + reply + status |
| `projects` | `routes/projects.ts` | Project CRUD + `ls` (folder picker) + `cwd` |
| `repos` | `routes/repos.ts` | Repo CRUD + `/:id/keys` (public key management) |

## Key conventions

- **shadcn/ui v4** uses Base UI (`@base-ui/react`) — **no `asChild` prop**.
- TypeScript path alias: `@/*` → `./src/*` (both `tsconfig.json` and Vite).
- Tailwind v4 with `@tailwindcss/postcss`. CSS imports use `@import "tailwindcss"`. CSS variables in **oklch**.
- `rsc: false` in `components.json` — client-rendered, no Server Components.
- **Server uses `tsx` (not `tsc`)**. `tsc --noEmit` only type-checks `src/`.
- `better-sqlite3` is **synchronous** (`.get()`, `.run()`, `.all()`).
- `cn()` in `src/lib/utils.ts` wraps `clsx` + `twMerge`.
- `tsconfig.json` allows unused vars (`noUnusedLocals: false`).
- Server has `unhandledRejection` / `uncaughtException` handlers that `process.exit(1)`.
- `setInterval(() => {}, 60000)` keepalive in `server/index.ts:62` prevents Node from exiting.

## Typecheck / build

```bash
npx tsc --noEmit    # frontend only (server excluded by tsconfig include)
npm run build        # tsc --noEmit && vite build
```

## Database

Tables: `roles`, `tasks`, `subtasks`, `outputs`, `execution_logs`, `settings`, `notifications`, `agent_stats`, `projects`, `project_repos`, `project_repo_public_keys`, `message_threads`, `messages`.

- `tasks.status`: `backlog` → `in_progress` → `done` / `review` (if any subtask failed) / `failed`.
- `tasks.ceo_status`: `idle`, `decomposing`, `decomposed`, `error`.
- `subtasks.status`: `backlog` → `in_progress` → `done` / `failed` / `review`.
- `subtasks.assigned_by` defaults to `'ceo'`.
- `execution_logs.step_type`: `assign`, `execute`. `step` tracks retry attempt.
- `agent_stats`: per-role token usage and call counts.
- `project_repo_public_keys`: repo SSH/GPG keys (name, public_key, key_type).
- `message_threads`: conversations with agents (status: `open`, `awaiting_user`, `awaiting_agent`, `resolved`).
- `messages`: per-thread messages with `sender_type` (`user` / `agent`).
- `data/` is gitignored — delete `data/tasks.db` to reset.
- DB auto-migrates: adds `priority` column to `tasks` if missing.

## OpenAI endpoint quirk

`OpenAIProvider` normalizes the endpoint URL: if it doesn't end with `/v1`, the path `/v1/chat/completions` is appended automatically. Same for `/v1/models`.
