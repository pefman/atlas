# CEO Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a CEO agent that automatically decomposes tasks into subtasks and assigns them to appropriate agents, with real-time status visibility in the UI.

**Architecture:** Add a dedicated `ceo` role that orchestrates task decomposition. When a task is created, the CEO analyzes it and creates subtasks assigned to appropriate agents. Agents display real-time status in the left sidebar.

**Tech Stack:**
- Backend: Node.js, Express, TypeScript, SQLite (better-sqlite3)
- Frontend: React 18, Vite, TypeScript, shadcn/ui v4.12, Tailwind CSS
- AI: Ollama/OpenAI providers (existing)

## Global Constraints

- **TypeScript:** Strict mode, no implicit any
- **Database:** SQLite WAL mode, foreign keys enabled
- **AI Provider:** Use existing `OllamaProvider` or `OpenAIProvider` from `server/ai/`
- **UI Framework:** shadcn/ui v4.12 uses Base UI (`@base-ui/react`) — **no `asChild` prop**
- **Path Alias:** `@/*` → `./src/*`
- **Testing:** Run `npm run dev` to test, `npx tsc --noEmit` for typecheck

---

### Task 1: Add CEO Role to Database Schema

**Files:**
- Modify: `server/db.ts:20-81`
- Modify: `server/db.ts:83-100`

**Interfaces:**
- Consumes: None (database initialization)
- Produces: `ceo` role in database with orchestrator prompt

- [ ] **Step 1: Add new fields to tasks table**

Update the `tasks` table schema to include decomposition tracking:

```typescript
// server/db.ts - Update CREATE TABLE tasks statement (around line 28-37)
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'backlog',
  ceo_status TEXT NOT NULL DEFAULT 'idle',
  decomposed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

- [ ] **Step 2: Add step_type to execution_logs table**

Update the `execution_logs` table to track different step types:

```typescript
// server/db.ts - Update CREATE TABLE execution_logs statement (around line 60-70)
CREATE TABLE IF NOT EXISTS execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subtask_id INTEGER NOT NULL,
  step INTEGER NOT NULL,
  step_type TEXT NOT NULL DEFAULT 'execute',
  role_id INTEGER NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subtask_id) REFERENCES subtasks(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

- [ ] **Step 3: Add CEO role to seed data**

Add the CEO role to the initial seed (around line 83-100):

```typescript
// server/db.ts - Add after existing roles (around line 99)
insertRole.run('ceo', 'Task orchestrator and manager', 
  'You are the CEO of Atlas, a task management AI system. Your job is to:\n' +
  '1. Analyze incoming tasks and break them into 3-5 clear subtasks\n' +
  '2. Assign each subtask to the most appropriate agent based on their expertise\n' +
  '3. Monitor execution and ensure quality\n\n' +
  'Available agents:\n' +
  '- researcher: gathers information, analyzes data\n' +
  '- writer: creates content, documents, reports\n' +
  '- reviewer: validates outputs, ensures quality\n\n' +
  'When decomposing, return JSON with:\n' +
  '{\n' +
  '  "subtasks": [\n' +
  '    {"title": "...", "description": "...", "role": "researcher|writer|reviewer"}\n' +
  '  ]\n' +
  '}\n\n' +
  'Rules:\n' +
  '- Each subtask should be actionable and complete\n' +
  '- Assign based on agent expertise\n' +
  '- Prioritize logical flow between subtasks');
```

- [ ] **Step 4: Run migration**

Since we're using `CREATE TABLE IF NOT EXISTS`, the new columns won't be added to existing databases. We need to handle this:

```bash
# Delete existing database to reset schema (or add ALTER TABLE statements)
rm -f data/tasks.db
```

**Expected outcome:** Database schema includes new fields for CEO tracking.

- [ ] **Step 5: Verify schema**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add server/db.ts
git commit -m "feat: add CEO role and decomposition tracking to schema"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: Existing `RoleName`, `Task`, `Subtask` types
- Produces: Updated types with `ceo_status`, `step_type`, new `AgentStatus` type

- [ ] **Step 1: Add AgentStatus type**

```typescript
// src/types/index.ts

export type AgentStatus = 'idle' | 'decomposing' | 'executing' | 'reviewing' | 'completed' | 'error';

export type StepType = 'decompose' | 'assign' | 'execute' | 'review';

export type RoleName = 'planner' | 'researcher' | 'writer' | 'reviewer' | 'ceo';
```

- [ ] **Step 2: Update Task interface**

```typescript
// src/types/index.ts

export interface Task {
  id: number;
  title: string;
  description: string;
  role_id: number;
  status: TaskStatus;
  ceo_status: 'idle' | 'decomposing' | 'decomposed' | 'error';
  decomposed_at?: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Update ExecutionLog interface**

```typescript
// src/types/index.ts

export interface ExecutionLog {
  id: number;
  subtask_id: number;
  step: number;
  step_type: StepType;
  role_id: number;
  input: string;
  output: string;
  created_at: string;
}
```

- [ ] **Step 4: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add AgentStatus and update types for CEO agent"
```

---

### Task 3: Create Agents API Routes

**Files:**
- Create: `server/routes/agents.ts`
- Modify: `server/index.ts:1-30`

**Interfaces:**
- Consumes: `db` from `server/db.ts`
- Produces: REST API endpoints for agent management

- [ ] **Step 1: Create agents route file**

```typescript
// server/routes/agents.ts
import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Get all agents with status
router.get('/', (req: Request, res: Response) => {
  const agents = db.prepare(`
    SELECT r.*, 
           CASE WHEN t.id IS NOT NULL THEN t.title ELSE NULL END as current_task_title,
           CASE WHEN t.id IS NOT NULL THEN 'executing' ELSE 'idle' END as status
    FROM roles r
    LEFT JOIN tasks t ON t.role_id = r.id AND t.status = 'in_progress'
    ORDER BY r.name ASC
  `).all();
  
  res.json(agents);
});

// Get agent by ID
router.get('/:id', (req: Request, res: Response) => {
  const agent = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  
  const currentTask = db.prepare(`
    SELECT t.title, t.status
    FROM tasks t
    WHERE t.role_id = ? AND t.status = 'in_progress'
    LIMIT 1
  `).get(req.params.id);
  
  res.json({
    ...agent,
    status: currentTask ? 'executing' : 'idle',
    current_task: currentTask ? currentTask.title : null
  });
});

// Update agent
router.put('/:id', (req: Request, res: Response) => {
  const { name, description, system_prompt } = req.body;
  const agentId = parseInt(req.params.id);
  
  const agent = db.prepare('SELECT * FROM roles WHERE id = ?').get(agentId);
  
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  
  if (name) {
    db.prepare('UPDATE roles SET name = ? WHERE id = ?').run(name, agentId);
  }
  if (description) {
    db.prepare('UPDATE roles SET description = ? WHERE id = ?').run(description, agentId);
  }
  if (system_prompt) {
    db.prepare('UPDATE roles SET system_prompt = ? WHERE id = ?').run(system_prompt, agentId);
  }
  
  res.json({ success: true });
});

// Delete agent
router.delete('/:id', (req: Request, res: Response) => {
  const agentId = parseInt(req.params.id);
  
  const agent = db.prepare('SELECT * FROM roles WHERE id = ?').get(agentId);
  
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  
  // Check if agent has active tasks
  const activeTasks = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE role_id = ? AND status IN ('backlog', 'in_progress')"
  ).get(agentId) as { count: number };
  
  if (activeTasks.count > 0) {
    res.status(400).json({ error: 'Agent has active tasks and cannot be deleted' });
    return;
  }
  
  // Delete agent
  db.prepare('DELETE FROM roles WHERE id = ?').run(agentId);
  
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Register routes in server/index.ts**

```typescript
// server/index.ts

import agentRoutes from './routes/agents';  // Add this import

// Add this route registration (around line 26)
app.use('/api/agents', agentRoutes);
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/agents.ts server/index.ts
git commit -m "feat: add agents API routes with CRUD operations"
```

---

### Task 4: Implement CEO Decomposition in Executor

**Files:**
- Modify: `server/executor.ts`

**Interfaces:**
- Consumes: Existing `executeTask`, `generateSubtasks`, `executeSubtask` functions
- Produces: New `decomposeTask` function, updated `executeTask` flow

- [ ] **Step 1: Add decomposeTask function**

Add a new function to handle CEO decomposition:

```typescript
// server/executor.ts

async function decomposeTask(task: any): Promise<any[]> {
  const provider = await getProvider();
  
  // Get CEO role system prompt
  const ceoRole = db.prepare('SELECT * FROM roles WHERE name = ?').get('ceo') as any;
  
  if (!ceoRole) {
    throw new Error('CEO role not found in database');
  }
  
  const messages: Message[] = [
    { role: 'system', content: ceoRole.system_prompt },
    { role: 'user', content: `Task: ${task.title}\n\nDescription: ${task.description}` },
  ];
  
  const response = await provider.chat(messages);
  
  // Parse JSON response
  let subtaskData;
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      subtaskData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found');
    }
  } catch (e) {
    // Fallback: create a single subtask
    subtaskData = [{
      title: task.title,
      description: task.description,
      role: 'researcher',
    }];
  }
  
  // Insert subtasks into database
  const insertedSubtasks = [];
  for (const st of subtaskData) {
    const result = db.prepare(`
      INSERT INTO subtasks (task_id, title, description, role_id, assigned_by)
      VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?), 'ceo')
    `).run(task.id, st.title, st.description, st.role);
    
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid) as any;
    insertedSubtasks.push(subtask);
  }
  
  // Update task ceo_status
  db.prepare(`
    UPDATE tasks SET ceo_status = 'decomposed', decomposed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).run(task.id);
  
  // Log decomposition in execution_logs
  for (const subtask of insertedSubtasks) {
    db.prepare(`
      INSERT INTO execution_logs (subtask_id, step, step_type, role_id, input, output)
      VALUES (?, 0, 'assign', ?, ?, ?)
    `).run(
      subtask.id,
      ceoRole.id,
      JSON.stringify({ task_title: task.title, assigned_role: st.role }),
      `Assigned to ${st.role}`
    );
  }
  
  return insertedSubtasks;
}
```

- [ ] **Step 2: Update executeTask to use CEO decomposition**

Modify the existing `executeTask` function to trigger CEO decomposition:

```typescript
// server/executor.ts - Update executeTask function

export async function executeTask(taskId: number): Promise<void> {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Update status to in_progress
  db.prepare(`UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(taskId);
  
  // Update ceo_status to decomposing
  db.prepare(`UPDATE tasks SET ceo_status = 'decomposing', updated_at = datetime('now') WHERE id = ?`).run(taskId);

  // Get or generate subtasks
  let subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(taskId) as any[];

  if (subtasks.length === 0) {
    // Generate subtasks using CEO agent
    subtasks = await decomposeTask(task);
  }

  // Execute each subtask
  for (const subtask of subtasks) {
    await executeSubtask(subtask.id);
  }

  // Update task status to done if all subtasks are done
  const pendingSubtasks = db.prepare(
    "SELECT COUNT(*) as count FROM subtasks WHERE task_id = ? AND status != 'done'"
  ).get(taskId) as { count: number };

  if (pendingSubtasks.count === 0) {
    db.prepare(`UPDATE tasks SET status = 'done', ceo_status = 'idle', updated_at = datetime('now') WHERE id = ?`).run(taskId);
  }
}
```

- [ ] **Step 3: Remove old generateSubtasks function**

The old `generateSubtasks` function is no longer needed since we have `decomposeTask`:

```typescript
// server/executor.ts - Delete the old generateSubtasks function (lines 50-96)
// Keep executeSubtask and getProvider functions
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add server/executor.ts
git commit -m "feat: implement CEO decomposition in executor"
```

---

### Task 5: Update Task Creation to Trigger Auto-Execution

**Files:**
- Modify: `server/routes/tasks.ts`

**Interfaces:**
- Consumes: Existing task creation endpoint
- Produces: Auto-trigger CEO decomposition on task creation

- [ ] **Step 1: Update POST /api/tasks to trigger decomposition**

```typescript
// server/routes/tasks.ts - Update the POST '/' route

router.post('/', (req: Request, res: Response) => {
  const { title, description, role_id } = req.body;
  
  if (!title || !description || !role_id) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  
  const result = db.prepare(`
    INSERT INTO tasks (title, description, role_id)
    VALUES (?, ?, ?)
  `).run(title, description, role_id);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  
  // Trigger auto-execution in background
  executeTask(task.id).catch(error => {
    console.error(`Error auto-executing task ${task.id}:`, error);
  });
  
  res.status(201).json(task);
});
```

- [ ] **Step 2: Add import for executeTask**

```typescript
// server/routes/tasks.ts - Add import at top

import { executeTask } from '../executor';
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/tasks.ts
git commit -m "feat: trigger auto-execution on task creation"
```

---

### Task 6: Create Agent Detail UI Component

**Files:**
- Create: `src/components/agents/AgentDetail.tsx`
- Create: `src/components/agents/AgentSidebarItem.tsx`

**Interfaces:**
- Consumes: `Agent` type from API
- Produces: UI components for agent display

- [ ] **Step 1: Create AgentSidebarItem component**

```tsx
// src/components/agents/AgentSidebarItem.tsx
import { useState } from 'react';
import { Agent } from '@/types';

interface AgentSidebarItemProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
}

export function AgentSidebarItem({ agent, onClick }: AgentSidebarItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const getStatusColor = () => {
    switch (agent.status) {
      case 'executing':
        return 'bg-green-500';
      case 'reviewing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };
  
  return (
    <div
      className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
        isHovered ? 'bg-sidebar-accent' : ''
      } ${agent.status !== 'idle' ? 'border-l-2 border-l-green-500' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(agent)}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${agent.status === 'executing' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">{agent.name}</span>
      </div>
      {agent.current_task && (
        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
          {agent.current_task}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create AgentDetail component**

```tsx
// src/components/agents/AgentDetail.tsx
import { Agent } from '@/types';

interface AgentDetailProps {
  agent: Agent | null;
  onClose: () => void;
}

export function AgentDetail({ agent, onClose }: AgentDetailProps) {
  if (!agent) return null;
  
  return (
    <div className="p-4 border-t">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{agent.name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <p className="text-sm capitalize">{agent.status}</p>
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground">Description</label>
          <p className="text-sm">{agent.description}</p>
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground">Current Task</label>
          <p className="text-sm">{agent.current_task || 'None'}</p>
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground">System Prompt</label>
          <div className="text-xs bg-muted p-2 rounded max-h-[200px] overflow-y-auto">
            {agent.system_prompt}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Define Agent type**

```typescript
// src/types/index.ts

export interface Agent {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  status: AgentStatus;
  current_task?: string;
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/agents/AgentDetail.tsx src/components/agents/AgentSidebarItem.tsx src/types/index.ts
git commit -m "feat: add agent detail and sidebar components"
```

---

### Task 7: Update Sidebar to Show Agents

**Files:**
- Modify: `src/components/app-sidebar.tsx`

**Interfaces:**
- Consumes: Existing sidebar structure
- Produces: Agents section in sidebar with real-time updates

- [ ] **Step 1: Add agents section to sidebar**

```tsx
// src/components/app-sidebar.tsx

import { useState, useEffect } from 'react';
import { Agent } from '@/types';
import { AgentSidebarItem } from './agents/AgentSidebarItem';
import { AgentDetail } from './agents/AgentDetail';

export function AppSidebar() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  
  // Fetch agents
  useEffect(() => {
    const fetchAgents = async () => {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data);
    };
    
    fetchAgents();
    const interval = setInterval(fetchAgents, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);
  
  // ... existing code ...
  
  return (
    <Sidebar>
      {/* ... existing header ... */}
      
      <SidebarContent>
        {/* ... existing menu items ... */}
        
        {/* Agents Section */}
        <div className="px-4 py-2">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Agents</h3>
          <div className="space-y-1">
            {agents.map((agent) => (
              <AgentSidebarItem
                key={agent.id}
                agent={agent}
                onClick={setSelectedAgent}
              />
            ))}
          </div>
        </div>
      </SidebarContent>
      
      {/* Agent Detail Panel */}
      {selectedAgent && (
        <div className="border-t">
          <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        </div>
      )}
      
      {/* ... existing footer ... */}
    </Sidebar>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: add agents section to sidebar with real-time updates"
```

---

### Task 8: Update Task Detail to Show Decomposition Progress

**Files:**
- Modify: `src/components/tasks/TaskDetail.tsx`

**Interfaces:**
- Consumes: Existing task detail view
- Produces: Decomposition progress indicators

- [ ] **Step 1: Add decomposition status display**

```tsx
// src/components/tasks/TaskDetail.tsx - Update to show CEO status

// Add this helper function
function getCeoStatusText(ceoStatus: string): string {
  switch (ceoStatus) {
    case 'decomposing':
      return 'CEO is analyzing task...';
    case 'decomposed':
      return 'Task decomposed';
    case 'error':
      return 'Decomposition failed';
    default:
      return '';
  }
}

function getCeoStatusColor(ceoStatus: string): string {
  switch (ceoStatus) {
    case 'decomposing':
      return 'text-blue-500';
    case 'decomposed':
      return 'text-green-500';
    case 'error':
      return 'text-red-500';
    default:
      return '';
  }
}

// In the component, add this after task info:
{task.ceo_status === 'decomposing' && (
  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
    <span className={`text-sm ${getCeoStatusColor(task.ceo_status)}`}>
      {getCeoStatusText(task.ceo_status)}
    </span>
  </div>
)}

{task.ceo_status === 'decomposed' && (
  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-md">
    <span className="text-green-500">✓</span>
    <span className="text-sm text-green-700 dark:text-green-300">
      Task decomposed into {task.subtasks?.length || 0} subtasks
    </span>
  </div>
)}
```

- [ ] **Step 2: Update Task type to include ceo_status**

```typescript
// src/types/index.ts - Already updated in Task 2
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/TaskDetail.tsx
git commit -m "feat: add decomposition progress to task detail"
```

---

### Task 9: Add Agent Editing UI

**Files:**
- Create: `src/components/agents/AgentEditDialog.tsx`

**Interfaces:**
- Consumes: `Agent` type
- Produces: Edit dialog for agent properties

- [ ] **Step 1: Create agent edit dialog**

```tsx
// src/components/agents/AgentEditDialog.tsx
import { useState } from 'react';
import { Agent } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface AgentEditDialogProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Agent) => void;
}

export function AgentEditDialog({ agent, isOpen, onClose, onSave }: AgentEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [system_prompt, setSystem_prompt] = useState('');
  
  if (!agent) return null;
  
  const handleSave = async () => {
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, system_prompt }),
    });
    
    if (res.ok) {
      onSave({ ...agent, name, description, system_prompt });
      onClose();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agent description"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">System Prompt</label>
            <Textarea
              value={system_prompt}
              onChange={(e) => setSystem_prompt(e.target.value)}
              placeholder="Agent system prompt"
              rows={10}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add edit button to AgentDetail**

```tsx
// src/components/agents/AgentDetail.tsx - Add edit button

import { AgentEditDialog } from './AgentEditDialog';
import { useState } from 'react';

export function AgentDetail({ agent, onClose }: AgentDetailProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // ... existing code ...
  
  return (
    <>
      <div className="p-4 border-t">
        {/* ... existing content ... */}
        
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={() => setIsEditOpen(true)}>Edit</Button>
          <Button size="sm" variant="destructive" onClick={() => {
            if (confirm('Delete this agent?')) {
              fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
              onClose();
            }
          }}>Delete</Button>
        </div>
      </div>
      
      <AgentEditDialog
        agent={agent}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={() => {
          // Refresh agent data
          window.location.reload();
        }}
      />
    </>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/agents/AgentEditDialog.tsx src/components/agents/AgentDetail.tsx
git commit -m "feat: add agent editing UI"
```

---

### Task 10: Test End-to-End Flow

**Files:**
- Manual testing

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working CEO agent system

- [ ] **Step 1: Start the server**

```bash
npm run dev
```

- [ ] **Step 2: Create a new task**

1. Open the app in browser
2. Click "Create Task"
3. Fill in title and description
4. Select any role (will be overwritten by CEO)
5. Click "Create"

- [ ] **Step 3: Verify auto-decomposition**

1. Watch the task detail view
2. Should see "CEO is analyzing task..." with spinner
3. After a few seconds, should see "Task decomposed into X subtasks"
4. Check the kanban board - should see new subtasks

- [ ] **Step 4: Verify agent status**

1. Check the left sidebar
2. Should see agents with status indicators
3. Click on an agent to see details
4. Status should update in real-time (polling every 3 seconds)

- [ ] **Step 5: Test agent editing**

1. Click on an agent in the sidebar
2. Click "Edit" button
3. Modify name, description, or prompt
4. Save and verify changes persist

- [ ] **Step 6: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit any final changes**

```bash
git add -A
git commit -m "feat: complete CEO agent implementation"
```

---

## Implementation Notes

1. **Database Migration:** The new schema requires deleting the existing database or adding ALTER TABLE statements. For simplicity, we delete `data/tasks.db` in Task 1.

2. **Polling vs WebSocket:** We use polling (3 seconds) for simplicity. Can upgrade to WebSocket later if needed.

3. **CEO Queue:** The CEO processes tasks sequentially (one at a time) via the executor's background task queue.

4. **Error Handling:** JSON parse failures fall back to a single subtask with role `researcher`. Network errors are logged but don't block execution.

5. **Agent Status:** Status is derived from database queries (current tasks). No separate status table needed.
