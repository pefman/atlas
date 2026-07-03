# Plan: Message CEO without task link

## Problem

The compose form in `src/pages/MessagesPage.tsx` makes it non-obvious that users can message any agent (including the CEO) without linking a task. The "Relevant task" dropdown is `disabled={!assignedWork}`, so when an agent has no assigned work (common for CEO), the user can't even see the "No task link" option.

The backend already supports task-less threads (`validateRoleTaskLink` at `server/routes/messages.ts:72-74` returns `{ valid: true }` when neither taskId nor subtaskId is provided). The scheduler (`server/scheduler.ts:200-222`) picks up threads regardless of `task_id`.

## Changes

### `src/pages/MessagesPage.tsx`

1. **Remove `disabled={!assignedWork}` from the task Select** (line 665):
   - Before: `disabled={!assignedWork}`
   - After: no disabled prop (always enabled)

2. **Update SheetDescription** (line 634):
   - Before: "Start a conversation with an agent and optionally link task context."
   - After: "Start a conversation with an agent. A task link is optional — leave it blank to message without context."

3. **Add hint text below the task select** (after line 677):
   - Add a small text element: "No task? That's fine — the agent will reply based on your message alone."

## Files to modify

- `src/pages/MessagesPage.tsx` (3 small changes)

## Files that need no changes

- `server/routes/messages.ts` — already accepts `task_id = NULL`
- `server/scheduler.ts` — already picks up threads with or without task link
- No database migrations needed
