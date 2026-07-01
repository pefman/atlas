# Fix Kanban View - Show Main Tasks

## Problem
The kanban view only shows subtasks, not main tasks. When users create tasks, they expect to see them in the kanban view alongside subtasks.

## Solution
Update the kanban components to display both main tasks and subtasks, organized by status columns.

## Implementation Plan

### 1. Update KanbanBoard.tsx
- Fetch both tasks and subtasks
- Filter items by status for each column
- Add handlers for task clicks and pickup actions

### 2. Update KanbanColumn.tsx
- Accept both `tasks` and `subtasks` props
- Display tasks section with header
- Display subtasks section (existing)
- Show counts for both

### 3. Update KanbanCard.tsx or Create TaskCard.tsx
- Create separate card component for tasks with:
  - Task title and description
  - Role badge
  - "Pick Up" button for backlog tasks
  - Click handler to navigate to task detail
- Reuse existing KanbanCard for subtasks

### 4. Add API Endpoints (if needed)
- `/api/tasks/:id/pickup` - PATCH endpoint to move task from backlog to in_progress
- Already exists in server/routes/tasks.ts

## Files to Modify
- `src/components/kanban/KanbanBoard.tsx`
- `src/components/kanban/KanbanColumn.tsx`
- `src/components/kanban/KanbanCard.tsx` (or create new `TaskCard.tsx`)

## Verification
- Create a new task
- Navigate to /kanban
- Verify task appears in "Backlog" column
- Click task to navigate to detail page
- Verify subtasks appear under their parent task (if any)
