# Notifications, Create Task & Drag-and-Drop Design

**Date:** 2026-07-01
**Status:** Approved
**File:** `docs/superpowers/specs/2026-07-01-notifications-create-task-drag-drop-design.md`

## Overview

Three features to enhance the Atlas task management system:
1. **Notification system** — CEO/agents can message the user when unsure, delivered via SSE
2. **Create task** — Add tasks directly from the Kanban board with title, description, priority, and role
3. **Drag-and-drop** — Drag tasks and subtasks between Kanban columns with optimistic UI updates

## Current State

- Kanban board displays tasks/subtasks in 4 columns: Backlog, In Progress, Review, Done
- No way to create tasks from Kanban (only via Dashboard)
- No drag-and-drop (status changes require clicking buttons)
- No communication channel between agents and user

## Design

### Feature 1: Notification System

**Database:**
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  task_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

**Backend API:**
- `GET /api/notifications` — fetch all notifications (new endpoint)
- `PATCH /api/notifications/:id/read` — mark as read (new endpoint)
- `GET /api/notifications/stream` — SSE endpoint for real-time push (new endpoint)
- `POST /api/notifications` — internal: insert notification (used by CEO/agents)

**SSE Events:**
- Event type: `notification`
- Data: JSON with notification object

**Frontend:**
- Bell icon in header (top-right) with unread count badge
- Dropdown showing recent 10 notifications
- Click notification → mark as read, navigate to task if task_id present
- Auto-refresh every 30s as fallback if SSE fails

**Agent Escalation Flow:**
1. Agent encounters issue → calls `ceo.query(message)` via executor
2. CEO reviews query → decides to notify user
3. CEO inserts notification: `INSERT INTO notifications (sender_role, message, task_id) VALUES ('ceo', msg, task_id)`
4. Server emits SSE event
5. Frontend updates dropdown in real-time

### Feature 2: Create Task

**UI:**
- "Create Task" button in Kanban board header (top-right, next to bell icon)
- Modal dialog with form fields:
  - Title (required, text input)
  - Description (required, textarea)
  - Priority (dropdown: high/medium/low, default: medium)
  - Role (dropdown: researcher/writer/reviewer, default: researcher)
- On submit: POST to `/api/tasks`, then CEO auto-decomposes

**API:**
```typescript
POST /api/tasks
Body: { title, description, priority, role_id }
Response: { id, title, description, role_id, status: 'backlog', ceo_status: 'idle', ... }
```

**Backend Logic:**
- Validate required fields
- Insert task with status='backlog', ceo_status='idle'
- CEO worker picks up new backlog task on next poll (5s interval)
- CEO decomposes as usual, assigning subtasks with priorities

### Feature 3: Drag-and-Drop

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable` (v7.x, React 18+ compatible)

**Implementation:**
- Wrap KanbanBoard in `DndContext`
- Make each task/subtask card draggable via `useSortable`
- On `onDragEnd`:
  1. Optimistic UI update (move card to new column immediately)
  2. PATCH request to update status
  3. If fails: revert card to original position, show error toast

**API:**
```typescript
PATCH /api/tasks/:id
Body: { status: 'backlog' | 'in_progress' | 'review' | 'done' }

PATCH /api/subtasks/:id
Body: { status: 'backlog' | 'in_progress' | 'review' | 'done' }
```

**Frontend Components:**
- `KanbanDndProvider` — wraps board with DndContext, handles drag events
- `DraggableTaskCard` — wraps existing KanbanCard with drag handlers
- `DraggableSubtaskCard` — wraps existing SubtaskCard with drag handlers

**Error Handling:**
- API failure → revert optimistic update, show toast: "Failed to move task. Please try again."
- Network timeout → retry once after 1s, then revert

## Files to Modify

| File | Change |
|------|--------|
| `server/db.ts` | Add notifications table schema |
| `server/routes/notifications.ts` | New: notification API endpoints |
| `server/events.ts` | Add notification event emission |
| `server/routes/executeStream.ts` | SSE endpoint for notifications |
| `server/routes/tasks.ts` | Add priority field to task creation |
| `server/executor.ts` | Add `notifyUser()` method for CEO |
| `src/types/index.ts` | Add Notification interface |
| `src/components/notifications/NotificationBell.tsx` | New: bell icon with dropdown |
| `src/components/notifications/NotificationProvider.tsx` | New: SSE consumer |
| `src/components/kanban/CreateTaskDialog.tsx` | New: create task modal |
| `src/components/kanban/KanbanDndProvider.tsx` | New: drag-and-drop wrapper |
| `src/components/kanban/KanbanBoard.tsx` | Integrate notifications, create button, DnD |

## Migration

No data migration needed — `notifications` table is new. Existing data unaffected.

## Success Criteria

- [ ] Notifications table exists with correct schema
- [ ] CEO can send notifications to user
- [ ] Agents can escalate to CEO (via executor)
- [ ] SSE delivers notifications in real-time
- [ ] Bell icon shows unread count
- [ ] Dropdown shows recent notifications with task links
- [ ] Create Task button opens modal on Kanban board
- [ ] Form validates required fields
- [ ] Task created with selected priority and role
- [ ] CEO auto-decomposes new task
- [ ] Tasks are draggable between columns
- [ ] Subtasks are draggable between columns
- [ ] Optimistic UI updates on drop
- [ ] API failure reverts UI and shows error toast

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| SSE connection drops | Fallback polling every 30s |
| Drag-and-drop library conflicts | Use v7.x, test with existing Base UI components |
| Optimistic update race conditions | Server validates status transitions |
| Notification spam | Rate limit: max 1 notification per agent per 5 minutes |
