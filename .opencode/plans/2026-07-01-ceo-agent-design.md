# Design: CEO Agent with Task Decomposition

**Date:** 2026-07-01  
**Status:** Approved  
**Approach:** Approach 1 - Separate CEO Agent

---

## Overview

Add a dedicated `ceo` role that orchestrates task decomposition and execution. When a user creates a task, the CEO automatically analyzes it and breaks it into subtasks assigned to appropriate agents. Active agents display real-time status in the left sidebar.

**Key Principles:**
- CEO is the orchestrator, not an executor
- Agents are visible and manageable in the UI
- Progress is transparent (Jira-like visibility)
- Full CRUD for agents including prompts

---

## Architecture

### Core Concept

```
User creates task → CEO agent receives task → CEO decomposes into subtasks → 
Subtasks assigned to appropriate agents → Agents execute sequentially → 
CEO monitors progress → Task marked complete
```

### Data Flow

1. **Task Creation**
   - User creates task via UI
   - API stores task with status `pending_decomposition`
   - Executor detects new task and calls CEO agent

2. **CEO Decomposition**
   - CEO analyzes task using AI
   - Returns JSON with subtasks and role assignments
   - Executor creates subtasks in database
   - Task status changes to `in_progress`

3. **Subtask Execution**
   - Subtasks execute sequentially (existing logic)
   - Each subtask assigned to appropriate agent
   - Agent status updates in real-time

4. **Completion**
   - All subtasks done → task marked complete
   - CEO logs completion in execution logs

---

## Database Schema

### New Fields

**`roles` table:**
- No changes needed (already has `name`, `description`, `system_prompt`)

**`tasks` table:**
- Add `decomposed_at` TIMESTAMP (when CEO finished decomposition)
- Add `ceo_status` VARCHAR (default: 'idle')

**`subtasks` table:**
- Add `assigned_by` VARCHAR (default: 'ceo')

**`execution_logs` table:**
- Add `step_type` VARCHAR (values: 'decompose', 'assign', 'execute', 'review')

### Seed Data

Add `ceo` role to initial seed:
```sql
INSERT INTO roles (name, description, system_prompt) VALUES (
  'ceo',
  'Task orchestrator and manager',
  '[CEO system prompt - see below]'
);
```

---

## CEO Agent Design

### System Prompt

```
You are the CEO of Atlas, a task management AI system. Your job is to:
1. Analyze incoming tasks and break them into 3-5 clear subtasks
2. Assign each subtask to the most appropriate agent based on their expertise
3. Monitor execution and ensure quality

Available agents:
- researcher: gathers information, analyzes data
- writer: creates content, documents, reports
- reviewer: validates outputs, ensures quality

When decomposing, return JSON with:
{
  "subtasks": [
    {"title": "...", "description": "...", "role": "researcher|writer|reviewer"}
  ]
}

Rules:
- Each subtask should be actionable and complete
- Assign based on agent expertise
- Prioritize logical flow between subtasks
```

### Decomposition Logic

```typescript
async function decomposeTask(task: Task): Promise<Subtask[]> {
  const systemPrompt = await getRoleSystemPrompt('ceo');
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Task: ${task.title}\nDescription: ${task.description}` }
  ];
  
  const response = await aiProvider.chat(messages);
  const parsed = parseJSON(response);
  
  return parsed.subtasks.map(sub => ({
    title: sub.title,
    description: sub.description,
    role_id: getRoleId(sub.role),
    status: 'backlog'
  }));
}
```

---

## Agent Status States

| State | Description | Color |
|-------|-------------|-------|
| `idle` | Not working on anything | Blue (🔵) |
| `decomposing` | CEO is breaking down a task | Blue (🔵) |
| `executing` | Actively working on a subtask | Green (🟢) |
| `reviewing` | Checking output quality | Yellow (🟡) |
| `completed` | Finished current work | Gray (⚪) |
| `error` | Encountered an error | Red (🔴) |

---

## UI Components

### Left Sidebar - Agents Section

```
┌─ Agents ──────────────────────────┐
│ 🔵 CEO        Idle                │
│ 🟢 Researcher Executing: "Write   │
│              report on X"         │
│ 🟡 Writer   Reviewing output...   │
│ ⚪ Reviewer Idle                  │
└───────────────────────────────────┘
```

**Behavior:**
- Click agent → opens detail panel
- Real-time status updates (polling or WebSocket)
- Agents involved in current tasks slightly highlighted
- Status message shows current work (if any)

### Agent Detail Panel

**Content:**
- Agent name
- Description
- System prompt (editable)
- Current status
- Current task (if any) with progress
- List of completed tasks (optional)

**Actions:**
- Edit agent (name, description, prompt)
- Delete agent (with confirmation)
- View execution history

### Task Detail View

**Decomposition Progress:**
- "CEO is analyzing task..." (animated dots)
- Once decomposed: show subtask list

**Subtask List:**
- Each subtask shows:
  - Title
  - Assigned agent (with avatar/icon)
  - Status (backlog, in_progress, review, done)
  - Progress bar (if applicable)

**Execution Logs:**
- Per-subtask logs (existing)
- CEO decomposition step visible
- Assignment decisions visible

---

## API Endpoints

### Existing Endpoints (Modified)

**`POST /api/tasks`**
- No changes needed (task creation works)

**`POST /api/execute/task`**
- Modified to trigger CEO decomposition automatically

### New Endpoints

**`GET /api/agents`**
- Returns all agents with current status
- Response: `[{ id, name, description, status, current_task }]`

**`GET /api/agents/:id`**
- Returns agent details
- Response: `{ id, name, description, system_prompt, status, current_task }`

**`PUT /api/agents/:id`**
- Update agent (name, description, prompt)
- Body: `{ name?, description?, system_prompt? }`

**`DELETE /api/agents/:id`**
- Delete agent (with confirmation)
- Returns success or error if agent has active tasks

**`GET /api/agents/status`**
- Returns all agents with real-time status
- Response: `[{ id, name, status, current_task }]`

---

## Error Handling

### CEO Decomposition Failures

1. **AI Response Parse Error**
   - Log error
   - Create single fallback subtask with role `researcher`
   - Notify user via toast

2. **Network Timeout**
   - Retry once after 5 seconds
   - If fails again, mark task as `error` and notify user

3. **Invalid Role Assignment**
   - Validate role exists in database
   - If invalid, default to `researcher`
   - Log warning

### Agent Execution Failures

- Existing logic (3 retries, then mark as `review`)
- CEO logs failure in execution logs
- User can manually re-run or edit subtask

---

## Testing Strategy

### Unit Tests

1. **CEO Decomposition**
   - Test JSON parsing
   - Test role assignment validation
   - Test fallback behavior

2. **Status Updates**
   - Test status transitions
   - Test concurrent updates

### Integration Tests

1. **Task Creation Flow**
   - Create task → auto-decompose → verify subtasks

2. **Agent Management**
   - Create, edit, delete agents
   - Verify persistence

### Manual Testing

1. **UI Updates**
   - Verify real-time status updates
   - Test agent detail panel
   - Verify progress indicators

---

## Implementation Phases

### Phase 1: Backend Foundation
- Add `ceo` role to seed data
- Add new fields to database schema
- Implement CEO decomposition logic in executor
- Add new API endpoints for agents

### Phase 2: UI Components
- Create agents section in left sidebar
- Implement agent detail panel
- Add status indicators and animations
- Wire up real-time updates

### Phase 3: Integration
- Connect task creation to CEO decomposition
- Update task detail view with subtask list
- Add progress tracking
- Test end-to-end flow

---

## Success Criteria

- [ ] CEO agent decomposes tasks automatically
- [ ] Subtasks assigned to appropriate agents
- [ ] Agents visible in sidebar with real-time status
- [ ] Agent detail panel shows prompt and current work
- [ ] Full CRUD for agents
- [ ] Progress visible throughout task lifecycle
- [ ] Error handling for decomposition failures
- [ ] No breaking changes to existing functionality

---

## Open Questions

1. **WebSocket vs Polling:** Should we use WebSocket for real-time updates or poll every 2-3 seconds?
   - Recommendation: Start with polling (simpler), upgrade to WebSocket if needed

2. **Concurrent Tasks:** Should CEO handle multiple tasks simultaneously or queue them?
   - Recommendation: Queue tasks (one CEO at a time) for simplicity

3. **Agent History:** Should we show completed tasks for each agent?
   - Recommendation: Yes, but only in agent detail panel (not sidebar)
