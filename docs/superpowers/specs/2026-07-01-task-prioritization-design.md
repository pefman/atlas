# Task Prioritization Design

**Date:** 2026-07-01
**Status:** Approved
**File:** `docs/superpowers/specs/2026-07-01-task-prioritization-design.md`

## Overview

Enable the CEO agent to assign priority (high/medium/low) to subtasks during decomposition, and execute subtasks in priority order rather than creation order.

## Current State

- CEO prompt asks for `{title, description, role}` — no priority
- `subtasks` table has no priority column
- Subtasks execute in database insert order
- Tasks picked up by CEO worker in FIFO order by `created_at`

## Design

### 1. Database: Add `priority` to `subtasks`

```sql
ALTER TABLE subtasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
```

Values: `'high'`, `'medium'`, `'low'`

### 2. CEO Prompt Update

Update CEO system prompt in `server/db.ts:105-123` to include priority:

```json
{
  "subtasks": [
    {"title": "...", "description": "...", "role": "researcher|writer|reviewer", "priority": "high|medium|low"}
  ]
}
```

### 3. Executor Changes

**`server/executor.ts`:**
- `decomposeTask()`: Read `st.priority` from CEO response, insert into `subtasks`
- `executeTask()`: Fetch subtasks ordered by priority:
  ```sql
  SELECT * FROM subtasks WHERE task_id = ? ORDER BY 
    CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END ASC,
    created_at ASC
  ```

### 4. Frontend Changes

**Types (`src/types/index.ts`):**
- Add `priority: 'high' | 'medium' | 'low'` to `Subtask` interface

**KanbanCard (`src/components/kanban/KanbanCard.tsx`):**
- Display priority badge next to title
- Colors: high=red, medium=amber, low=blue

**TaskDetail (`src/components/tasks/TaskDetail.tsx`):**
- Show priority in subtask list

### 5. Behavior: Re-decomposition

When CEO re-decomposes a task (adds more subtasks), all subtasks (existing and new) should be re-prioritized by the CEO. The existing subtasks will have their priority updated by the new decomposition.

## Files to Modify

| File | Change |
|------|--------|
| `server/db.ts` | Add priority column (migration), update CEO prompt |
| `server/executor.ts` | Read priority, order by priority |
| `src/types/index.ts` | Add priority to Subtask type |
| `src/components/kanban/KanbanCard.tsx` | Display priority badge |
| `src/components/tasks/TaskDetail.tsx` | Display priority in subtask list |

## Migration

Since `priority` has a default value of `'medium'`, no data migration is needed. Existing subtasks will automatically get `'medium'` priority.

## Success Criteria

- CEO returns priority in decomposition JSON
- Subtasks execute in priority order (high → medium → low)
- Priority displays on Kanban cards and task detail
- Re-decomposition updates all priorities
- Existing subtasks default to 'medium' priority
