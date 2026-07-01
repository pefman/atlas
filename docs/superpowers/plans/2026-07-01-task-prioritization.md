# Task Prioritization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable CEO to assign priority (high/medium/low) to subtasks during decomposition and execute them in priority order.

**Architecture:** Add a `priority` column to `subtasks`, update CEO prompt to request priority, modify executor to order subtasks by priority, and display priority badges in the frontend.

**Tech Stack:** TypeScript, Express, SQLite (better-sqlite3), React 19, shadcn/ui, Base UI v1.6.0

## Global Constraints

- Use Base UI `render` prop (not `asChild`) for custom elements
- Follow existing theme colors from `src/index.css`
- No new dependencies allowed
- Priority values: `'high'`, `'medium'`, `'low'` (lowercase)
- Default priority: `'medium'`
- Re-decomposition updates all priorities (CEO re-prioritizes everything)

## Migration Strategy

Since `priority` uses a default value of `'medium'`, no data migration is needed. Existing subtasks will automatically get `'medium'` priority.

---

### Task 1: Database Migration - Add Priority Column

**Files:**
- Modify: `server/db.ts` (line 41-53, subtasks table definition)

**Steps:**

- [ ] **Step 1: Add priority column to subtasks table definition**

In `server/db.ts`, add `priority TEXT NOT NULL DEFAULT 'medium'` to the subtasks table:

```typescript
CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'backlog',
  assigned_by TEXT NOT NULL DEFAULT 'ceo',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

**Note:** Since this uses `CREATE TABLE IF NOT EXISTS`, on a fresh database the column will be created. For existing databases, the migration will be handled by the application starting (the column won't exist yet, so it will be added).

- [ ] **Step 2: Commit**

```bash
git add server/db.ts
git commit -m "db: add priority column to subtasks"
```

### Task 2: Backend - Update CEO Prompt and Executor

**Files:**
- Modify: `server/db.ts` (CEO system prompt, lines 105-123)
- Modify: `server/executor.ts` (decomposeTask and executeTask functions)

**Interfaces:**
- Consumes: CEO role system prompt from `server/db.ts`
- Produces: Subtasks with priority field, executed in priority order

**Steps:**

- [ ] **Step 1: Update CEO system prompt in `server/db.ts`**

Replace the CEO prompt (lines 105-123) with:

```typescript
insertRole.run('ceo', 'Task orchestrator and manager', 
  'You are the CEO of Atlas, a task management AI system. Your job is to:\n' +
  '1. Analyze incoming tasks and break them into 3-5 clear subtasks\n' +
  '2. Assign each subtask to the most appropriate agent based on their expertise\n' +
  '3. Prioritize subtasks based on importance and dependencies\n\n' +
  'Available agents:\n' +
  '- researcher: gathers information, analyzes data\n' +
  '- writer: creates content, documents, reports\n' +
  '- reviewer: validates outputs, ensures quality\n\n' +
  'When decomposing, return JSON with:\n' +
  '{\n' +
  '  "subtasks": [\n' +
  '    {"title": "...", "description": "...", "role": "researcher|writer|reviewer", "priority": "high|medium|low"}\n' +
  '  ]\n' +
  '}\n\n' +
  'Rules:\n' +
  '- Each subtask should be actionable and complete\n' +
  '- Assign based on agent expertise\n' +
  '- Prioritize logical flow between subtasks\n' +
  '- Use "high" for critical path items, "medium" for standard work, "low" for nice-to-have\n' +
  '- Re-prioritize all subtasks when decomposing (existing and new)');
```

- [ ] **Step 2: Update `decomposeTask` in `server/executor.ts` to read priority**

In the subtask insertion loop (around line 70-76), read `st.priority`:

```typescript
const result = db.prepare(`
  INSERT INTO subtasks (task_id, title, description, role_id, assigned_by, priority)
  VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?), 'ceo', ?)
`).run(task.id, st.title, st.description, st.role, st.priority || 'medium');
```

- [ ] **Step 3: Update `executeTask` in `server/executor.ts` to order by priority**

Change the subtask fetch (around line 115) to order by priority:

```typescript
let subtasks = db.prepare(`
  SELECT * FROM subtasks 
  WHERE task_id = ? 
  ORDER BY 
    CASE priority 
      WHEN 'high' THEN 1 
      WHEN 'medium' THEN 2 
      WHEN 'low' THEN 3 
      ELSE 2 
    END ASC,
    created_at ASC
`).all(task.id) as any[];
```

- [ ] **Step 4: Commit**

```bash
git add server/db.ts server/executor.ts
git commit -m "feat: add priority to CEO decomposition and execution order"
```

### Task 3: Frontend - Update Types and Display Priority

**Files:**
- Modify: `src/types/index.ts` (Subtask interface)
- Modify: `src/components/kanban/KanbanCard.tsx` (display priority badge)
- Modify: `src/components/tasks/TaskDetail.tsx` (display priority in subtask list)

**Interfaces:**
- Consumes: `Subtask` type from `src/types/index.ts`
- Produces: Priority badge on Kanban cards and task detail

**Steps:**

- [ ] **Step 1: Add priority to Subtask type in `src/types/index.ts`**

Add `priority` field to the Subtask interface:

```typescript
export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  description: string;
  role_id: number;
  status: TaskStatus;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Add priority badge to KanbanCard in `src/components/kanban/KanbanCard.tsx`**

Add priority badge next to the title. Use these colors:
- high: `bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800`
- medium: `bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800`
- low: `bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800`

Add after the title line (around line 45):

```typescript
{isTask && (
  <>
    <Badge variant="secondary" className="text-xs shrink-0">Role #{(item as Task).role_id}</Badge>
    <Badge variant="secondary" className={`text-xs shrink-0 ${priorityColors[item.priority]}`}>
      {item.priority}
    </Badge>
  </>
)}
```

Update the `priorityColors` object to include lowercase keys:

```typescript
const priorityColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
};
```

- [ ] **Step 3: Add priority to TaskDetail subtask list in `src/components/tasks/TaskDetail.tsx`**

In the subtask list (around lines 370-388), add priority badge:

```typescript
<CardHeader>
  <CardTitle className="text-base flex items-center justify-between">
    <span className="flex items-center gap-2">
      {getStatusIcon(subtask.status)}
      {subtask.title}
      <Badge variant="secondary" className={priorityColors[subtask.priority]}>
        {subtask.priority}
      </Badge>
    </span>
    <Badge variant="secondary">{subtask.status}</Badge>
  </CardTitle>
</CardHeader>
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/kanban/KanbanCard.tsx src/components/tasks/TaskDetail.tsx
git commit -m "feat: display priority on Kanban cards and task detail"
```

### Task 4: Test and Verify

**Files:**
- No new files
- Verify: Existing execution logs, Kanban view, TaskDetail view

**Steps:**

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: No new errors (pre-existing errors in data-table.tsx and task-table-columns.tsx are unrelated).

- [ ] **Step 2: Test decomposition with priority**

1. Create a new task in the dashboard
2. Execute the task (CEO will decompose with priority)
3. Check that subtasks have priority values in the database:
   ```bash
   sqlite3 data/tasks.db "SELECT title, priority FROM subtasks WHERE task_id = <taskId>;"
   ```

- [ ] **Step 3: Verify execution order**

1. Create a task with multiple subtasks
2. Execute it
3. Check execution logs show subtasks executed in priority order (high first, then medium, then low)

- [ ] **Step 4: Verify frontend display**

1. Check Kanban cards show priority badges with correct colors
2. Check TaskDetail shows priority badges in subtask list
3. Verify both light and dark modes work correctly

- [ ] **Step 5: Commit final changes**

```bash
git add -A
git commit -m "test: verify priority feature works end-to-end"
```

## Success Criteria

- [ ] CEO returns priority in decomposition JSON
- [ ] Subtasks execute in priority order (high → medium → low)
- [ ] Priority badge displays on Kanban cards with correct colors
- [ ] Priority badge displays on TaskDetail subtask list
- [ ] Existing subtasks default to 'medium' priority
- [ ] Re-decomposition updates all priorities
