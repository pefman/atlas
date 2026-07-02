# Atlas: Fix Execution Logic + Better Overview

## Context

Atlas is a React 19 + Express + SQLite app where an AI "CEO" decomposes tasks into role-assigned subtasks, and a single-threaded scheduler (`server/scheduler.ts`) executes them via LLM calls (Ollama/OpenAI), streaming updates over SSE to a kanban board. The user asked to (A) make sure the execution logic is sound and (B) improve the overview UI.

Exploration confirmed the core works, but there are real correctness bugs: subtasks retry **forever** on error (no `failed` terminal state — a bad subtask burns API calls indefinitely and its task never completes), a re-entrancy race breaks the single-thread guarantee, failed subtasks **render as "done"** on the board, a CEO decomposition error permanently strands a task, and completion rules differ between the scheduler and the REST routes. The overview also lacks failure visibility, a global activity view, filters, and useful metrics.

Plan is 3 phases, each shippable alone. Phase 1 = backend correctness, Phase 2 = truthful/live UI, Phase 3 = overview improvements.

---

## Phase 1 — Execution logic correctness (backend)

All in `server/` unless noted.

### 1.1 Refactor scheduler loop — `server/scheduler.ts`
Fixes: re-entrancy race (line 255 sets `processing=false` before recursing; concurrent `enqueue` can start a 2nd chain → two simultaneous LLM calls), deleted-subtask crash (line 208 uses `subtask.task_id` unguarded after optional-chaining at 202), leaked retry timers (single shared `this.retryTimeout` at line 250).
- Replace `processing` flag + tail recursion with a drain loop:
  ```ts
  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (!this.stopped) {
        const item = this.dequeue();
        if (!item) break;
        await this.executeItem(item);
      }
    } finally { this.draining = false; }
  }
  ```
  `enqueue()` pushes then `void this.drain()`.
- In `executeItem`: re-fetch subtask row; if missing (task deleted), log and skip.
- Replace `retryTimeout` with `retryTimers = new Map<number, NodeJS.Timeout>()` keyed by subtask id; `stop()` clears all.
- Add `removeTask(taskId)`: drop queued items for that task + clear their timers. Call from `routes/tasks.ts` DELETE.

### 1.2 Bounded retries + `failed` terminal state — `scheduler.ts`
- `MAX_ATTEMPTS = 3`. Increment `failureCount` in the catch block only (fixes off-by-one step logging at line 198).
- On final failure: `UPDATE subtasks SET status='failed'`, emit `subtask_failed` (declared in `server/events.ts` but currently **never emitted**), then run shared completion (1.3).
- No schema migration needed — `subtasks.status` has no CHECK constraint in `server/db.ts`.

### 1.3 One completion function — new `server/lib/taskProgress.ts`
Fixes divergent rules: scheduler counts `NOT IN ('done','failed')` (`scheduler.ts:264`); `routes/subtasks.ts:76` and `routes/tasks.ts:139` use `NOT IN ('done','review')`.
- `recomputeTaskStatus(taskId)`: all subtasks terminal & none failed → task `done` + emit `task_completed`; all terminal but some `failed` → task `review` (needs human) + emit `task_status_changed`.
- Use from scheduler, `routes/subtasks.ts` PATCH, and the manual-done guard in `routes/tasks.ts`.
- **Decision baked in:** failed work lands in the existing **Review** column with red styling — no 5th column (Review is currently never produced by the scheduler; "failed, needs a human" is exactly what it's for).

### 1.4 CEO error recovery — `scheduler.ts:184`, `routes/tasks.ts`
Currently `ceo_status='error'` is permanent (task stranded; no reset route).
- Auto-retry decomposition up to 3× with backoff (in-memory attempts map; reset `ceo_status='idle'` so the 5s worker re-picks it).
- Add `POST /api/tasks/:id/redecompose` to reset manually. Emit `task_decomposing` when decomposition starts (used by the status pill in Phase 2).

### 1.5 Provider hardening — `server/ai/ollama.ts`, `server/ai/openai.ts`, `scheduler.getProvider`
- Ollama `chat()` currently has **no timeout** — a hung model blocks the whole queue. Add `AbortSignal.timeout(120_000)`; raise OpenAI's 30s → 120s (shared const).
- Make provider imports static; remove the duplicate `getProvider()` call in `processNextBacklog` (`scheduler.ts:135` + `:144`).

### 1.6 Cleanup + safety
- Delete `server/executor.ts` — dead code (never imported), already diverged from the scheduler.
- `routes/settings.ts` GET currently returns the API key in plaintext: return `has_api_key: boolean` instead; PUT keeps stored key when field is blank. Adjust `src/components/settings/SettingsForm.tsx` to show a "key saved" placeholder.
- `routes/subtasks.ts`: add `POST /api/subtasks/:id/retry` (failed → backlog, re-enqueue with failureCount 0); accept `'failed'` in PATCH validStatuses.
- Bonus fix: `server/routes/agents.ts:11` — `t.status = 'in_progress' > 0` parses as `t.status = 1` (always false), so every agent always shows idle. Derive status from `subtasks` with `EXISTS(... status='in_progress')`.

### Phase 1 verification
`npm run dev`; `curl -N localhost:3101/api/kanban/stream` to watch events. Point Settings at a nonexistent model → create task → drag to In Progress → expect exactly 3 attempts in `execution_logs`, subtask `failed`, `subtask_failed` event, parent task → `review`. Delete a task mid-retry → no further logs for its subtasks. `curl localhost:3101/api/settings` → no plaintext key. Fix model, `POST /api/subtasks/:id/retry` → completes, task → done.

---

## Phase 2 — Truthful, live overview (frontend)

### 2.1 `failed` in types — `src/types/index.ts`
`export type SubtaskStatus = TaskStatus | 'failed'`; `Subtask.status: SubtaskStatus`. (Tasks never fail — don't widen `TaskStatus`.)

### 2.2 Fix lying board state — `src/components/kanban/KanbanBoard.tsx`
- **Bug:** `subtask_failed` handler maps subtask to `'done'` (line 49) — failures render as success. Map to `'failed'`; show failed subtasks in the Review column, sorted to top.
- **Bug:** `subtask_complete` handler (lines 39-43) marks the parent **task** done whenever any single subtask completes. Remove that block — task status only changes on `task_completed`/`task_status_changed` events.
- `KanbanCard.tsx`: failed → destructive border + "Failed" badge + Retry button (`POST /api/subtasks/:id/retry`); task with `ceo_status='error'` → "Decompose failed — Retry" button (`/redecompose`).

### 2.3 One shared SSE connection — new `src/contexts/KanbanStreamContext.tsx`
Today 3 separate EventSources (board inline, `useAIStatus`, NotificationProvider) and no reconnect handling.
- Provider owns the single `EventSource('/api/kanban/stream')`; exposes `connected`, `reconnectCount`, and `useKanbanEvent(name, handler)` (handlers via refs). Mount in `src/App.tsx`.
- Server (`server/routes/kanbanStream.ts`): send initial `connected` event + `:heartbeat` comment every 25s (cleared on close).
- Migrate KanbanBoard (delete inline effect), `useAIStatus`, SubtaskDetail. NotificationProvider keeps its own stream (different endpoint). Delete stale `src/hooks/useEventSource.ts` (payload types wrong, unused by board).

### 2.4 Fix stuck AI status pill — `src/hooks/useAIStatus.ts`
Rewrite on the context: `task_decomposing` → decomposing; `subtask_start` → executing; `subtask_complete`/`subtask_failed`/`task_completed` → idle when the tracked Set of active subtask ids empties (no refetching). Drop unreachable `reviewing` state from `AIStatusIndicator.tsx`.

### 2.5 Disconnected banner + refetch on reconnect — `src/pages/KanbanPage.tsx`
`!connected` → amber "Live updates disconnected — reconnecting…"; on reconnect, refetch board data.

### 2.6 Live SubtaskDetail — `src/components/tasks/SubtaskDetail.tsx`
Currently fetches once on mount. Subscribe to `subtask_start/complete/failed` for its id → refetch outputs/logs.

### 2.7 Real drag overlay + cross-client moves
- `KanbanDndProvider.tsx:48` renders literal "Dragging..." — render the actual card via a `renderOverlay` prop.
- PATCH routes emit `task_status_changed`/`subtask_status_changed` (declared in `KANBAN_EVENTS`, never emitted) so other open boards see manual moves; board subscribes.

### Phase 2 verification
Two browser windows: drag in one → other updates live. Force a failure → red Failed card in Review, Retry re-runs it. Kill server → banner; restart → clears + refetches. DevTools Network shows exactly one `/api/kanban/stream`.

---

## Phase 3 — Better overview (independently shippable items, in value order)

### 3.1 Activity feed (collapsible side panel on the kanban page)
- New `server/routes/activity.ts`: `GET /api/activity?limit=50` — execution_logs ⋈ subtasks/roles/tasks, newest first, normalized `{time, role, action, subtask_id, task_id, title}`.
- New `src/components/activity/ActivityFeed.tsx`: initial fetch + live prepend via `useKanbanEvent`; rows link to detail pages. Toggle in board header.

### 3.2 Metrics strip (replace the 3 tiles in `KanbanBoard.tsx`)
- New `GET /api/metrics`: subtask counts by status, success rate, tokens in/out + calls from `agent_stats`, tasks done today.
- Tiles: Total, Active, Done, **Failed** (red when >0), Success rate, Tokens. Plain tiles; no charts yet (YAGNI).

### 3.3 Board filters + search (`KanbanBoard.tsx` toolbar)
Client-side: text search, Selects for parent task / role / priority. Subtask cards get a parent-task chip linking to `/task/:id` (biggest cheap scanability win — tasks and subtasks are visually interleaved today).

### 3.4 Agent detail as a real route
`src/App.tsx` currently swaps the whole `<Routes>` block on `selectedAgent` state (no URL, back button broken). Add `/agent/:id` using the existing `src/components/agents/AgentDetailPage.tsx`; sidebar navigates.

### Explicitly cut (YAGNI)
Charts/dashboard page, cost accounting, multi-worker concurrency, subtask dependency DAG, automated QA-review agent, WebSockets, sidebar SSE (2s poll is fine locally).

### Sequencing
1 → 2 → 3 strictly (2 needs Phase 1's `failed` status + new events; 3.1/3.2 need Phase 2's shared stream context). Phase 3 items are independent.
