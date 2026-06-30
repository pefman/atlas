# AI Task Execution System MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based AI task execution system where users create tasks assigned to AI roles (Planner, Researcher, Writer, Reviewer) that decompose into subtasks and execute through an iterative loop.

**Architecture:** Single-page React application with a backend API layer. SQLite stores all state. AI providers (Ollama, OpenAI, etc.) called via REST APIs. Dashboard UI with kanban board, task list, and execution monitoring.

**Tech Stack:**
- React 18 + Vite
- shadcn/ui components
- Tailwind CSS
- better-sqlite3 (SQLite)
- Express (API server)
- OpenAI SDK (provider-agnostic)

## Global Constraints

- Use React 18 with Vite (not Next.js)
- SQLite via better-sqlite3 (no external database server)
- AI providers: Ollama (default), OpenAI, or custom endpoint
- Status flow: Backlog → In Progress → Review → Done
- Roles: Planner, Researcher, Writer, Reviewer
- No authentication (single-user MVP)
- All code in TypeScript

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `server/index.ts`
- Create: `server/db.ts`

**Interfaces:**
- Consumes: None (initial setup)
- Produces: Working Vite + React + TypeScript project with Tailwind CSS

- [ ] **Step 1: Initialize project with dependencies**

Run:
```bash
npm init -y
npm install react react-dom
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react tailwindcss postcss autoprefixer
npm install express better-sqlite3 cors dotenv
npm install -D @types/express @types/better-sqlite3 @types/cors ts-node
```

- [ ] **Step 2: Configure TypeScript**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Configure Vite**

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Configure Tailwind CSS**

Create `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Create `postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Create HTML entry point**

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Task Executor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create React entry points**

Create `src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/App.tsx`:
```typescript
function App() {
  return (
    <div className="flex h-screen">
      <main className="flex-1 overflow-auto">
        <div className="flex h-full items-center justify-center">
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </main>
    </div>
  );
}

export default App;
```

Create `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 7: Create Express server entry**

Create `server/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { db } from './db';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Create `server/db.ts`:
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'tasks.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export { db };
```

- [ ] **Step 8: Add npm scripts**

Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:client": "vite",
    "dev:server": "tsx server/index.ts",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

Install concurrently and tsx:
```bash
npm install -D concurrently tsx
```

- [ ] **Step 9: Run initial test**

Run:
```bash
npm run dev
```

Expected: Vite dev server starts on port 5173, Express on 3001.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: scaffold project with React, Vite, Express, SQLite"
```

---

### Task 2: Database Schema and Types

**Files:**
- Modify: `server/db.ts`
- Create: `src/types/index.ts`

**Interfaces:**
- Consumes: better-sqlite3
- Produces: Database tables for tasks, subtasks, outputs, roles, settings

- [ ] **Step 1: Define TypeScript types**

Create `src/types/index.ts`:
```typescript
export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';
export type RoleName = 'planner' | 'researcher' | 'writer' | 'reviewer';

export interface Role {
  id: number;
  name: RoleName;
  description: string;
  system_prompt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  role_id: number;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  description: string;
  role_id: number;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Output {
  id: number;
  subtask_id: number;
  content: string;
  created_at: string;
}

export interface ExecutionLog {
  id: number;
  subtask_id: number;
  step: number;
  role_id: number;
  input: string;
  output: string;
  created_at: string;
}

export interface Settings {
  id: number;
  provider: 'ollama' | 'openai' | 'custom';
  endpoint: string;
  api_key?: string;
  model: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Create database tables**

Update `server/db.ts`:
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'tasks.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    system_prompt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'backlog',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'backlog',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtask_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id)
  );

  CREATE TABLE IF NOT EXISTS execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtask_id INTEGER NOT NULL,
    step INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL DEFAULT 'ollama',
    endpoint TEXT NOT NULL DEFAULT 'http://localhost:11434',
    api_key TEXT,
    model TEXT NOT NULL DEFAULT 'llama3',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed roles if not exists
const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
if (roleCount.count === 0) {
  const insertRole = db.prepare(`
    INSERT INTO roles (name, description, system_prompt) VALUES (?, ?, ?)
  `);
  
  insertRole.run('planner', 'Plans and decomposes tasks into subtasks', 
    'You are a Planner. Your job is to analyze the task and break it down into clear, actionable subtasks. Return a JSON array of subtasks with title, description, and recommended role.');
  
  insertRole.run('researcher', 'Gathers information and researches topics', 
    'You are a Researcher. Your job is to gather relevant information, facts, and data about the given topic. Provide comprehensive, well-organized research output.');
  
  insertRole.run('writer', 'Creates content and documents', 
    'You are a Writer. Your job is to create clear, well-structured content based on the research and requirements provided. Write in a professional, engaging style.');
  
  insertRole.run('reviewer', 'Reviews and quality assurance', 
    'You are a Reviewer. Your job is to review the work for quality, accuracy, and completeness. Provide constructive feedback and approval status.');
}

export { db };
```

- [ ] **Step 3: Verify database creation**

Run:
```bash
npm run dev:server
```

Expected: Server starts and creates `data/tasks.db` with all tables.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add database schema with roles, tasks, subtasks, outputs, settings"
```

---

### Task 3: API Routes for Tasks and Subtasks

**Files:**
- Create: `server/routes/tasks.ts`
- Create: `server/routes/subtasks.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `db` from `server/db.ts`
- Produces: REST API endpoints for CRUD operations on tasks and subtasks

- [ ] **Step 1: Create task routes**

Create `server/routes/tasks.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Get all tasks
router.get('/', (req: Request, res: Response) => {
  const tasks = db.prepare(`
    SELECT t.*, r.name as role_name
    FROM tasks t
    JOIN roles r ON t.role_id = r.id
    ORDER BY t.created_at DESC
  `).all();
  
  res.json(tasks);
});

// Get task by ID with subtasks
router.get('/:id', (req: Request, res: Response) => {
  const task = db.prepare(`
    SELECT t.*, r.name as role_name, r.description as role_description
    FROM tasks t
    JOIN roles r ON t.role_id = r.id
    WHERE t.id = ?
  `).get(req.params.id);
  
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  const subtasks = db.prepare(`
    SELECT s.*, r.name as role_name
    FROM subtasks s
    JOIN roles r ON s.role_id = r.id
    WHERE s.task_id = ?
    ORDER BY s.created_at ASC
  `).all(req.params.id);
  
  res.json({ ...task, subtasks });
});

// Create task
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
  
  res.status(201).json(task);
});

// Update task status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['backlog', 'in_progress', 'review', 'done'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  
  db.prepare(`
    UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, req.params.id);
  
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Create subtask routes**

Create `server/routes/subtasks.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Get subtasks for a task
router.get('/task/:taskId', (req: Request, res: Response) => {
  const subtasks = db.prepare(`
    SELECT s.*, r.name as role_name
    FROM subtasks s
    JOIN roles r ON s.role_id = r.id
    WHERE s.task_id = ?
    ORDER BY s.created_at ASC
  `).all(req.params.taskId);
  
  res.json(subtasks);
});

// Create subtask
router.post('/', (req: Request, res: Response) => {
  const { task_id, title, description, role_id } = req.body;
  
  if (!task_id || !title || !description || !role_id) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  
  const result = db.prepare(`
    INSERT INTO subtasks (task_id, title, description, role_id)
    VALUES (?, ?, ?, ?)
  `).run(task_id, title, description, role_id);
  
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid);
  
  res.status(201).json(subtask);
});

// Update subtask status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['backlog', 'in_progress', 'review', 'done'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  
  db.prepare(`
    UPDATE subtasks SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, req.params.id);
  
  res.json({ success: true });
});

// Get outputs for a subtask
router.get('/:id/outputs', (req: Request, res: Response) => {
  const outputs = db.prepare(`
    SELECT * FROM outputs
    WHERE subtask_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);
  
  res.json(outputs);
});

export default router;
```

- [ ] **Step 3: Wire routes to Express**

Update `server/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks';
import subtaskRoutes from './routes/subtasks';
import { db } from './db';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 4: Test API endpoints**

Run:
```bash
npm run dev
```

Test with curl:
```bash
curl http://localhost:3001/api/tasks
curl -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d '{"title":"Test Task","description":"A test task","role_id":1}'
```

Expected: Tasks CRUD operations work correctly.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add task and subtask API routes"
```

---

### Task 4: AI Provider Integration

**Files:**
- Create: `server/ai/provider.ts`
- Create: `server/ai/ollama.ts`
- Create: `server/ai/openai.ts`
- Create: `server/routes/settings.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: Settings from database
- Produces: AI provider abstraction with Ollama and OpenAI implementations

- [ ] **Step 1: Create AI provider interface**

Create `server/ai/provider.ts`:
```typescript
export interface AIProvider {
  name: string;
  chat(messages: Message[]): Promise<string>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export * from './ollama';
export * from './openai';
```

- [ ] **Step 2: Create Ollama provider**

Create `server/ai/ollama.ts`:
```typescript
import { AIProvider, Message } from './provider';

export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private endpoint: string;
  private model: string;

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.model = model;
  }

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message.content;
  }
}
```

- [ ] **Step 3: Create OpenAI provider**

Create `server/ai/openai.ts`:
```typescript
import { AIProvider, Message } from './provider';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

- [ ] **Step 4: Create settings routes**

Create `server/routes/settings.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Get settings
router.get('/', (req: Request, res: Response) => {
  const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
  
  if (!settings) {
    res.json({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
    });
  } else {
    res.json(settings);
  }
});

// Update settings
router.put('/', (req: Request, res: Response) => {
  const { provider, endpoint, api_key, model } = req.body;
  
  const existing = db.prepare('SELECT id FROM settings ORDER BY id DESC LIMIT 1').get();
  
  if (existing) {
    db.prepare(`
      UPDATE settings SET provider = ?, endpoint = ?, api_key = ?, model = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(provider, endpoint, api_key, model, existing.id);
  } else {
    db.prepare(`
      INSERT INTO settings (provider, endpoint, api_key, model)
      VALUES (?, ?, ?, ?)
    `).run(provider, endpoint, api_key, model);
  }
  
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 5: Wire settings route**

Update `server/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks';
import subtaskRoutes from './routes/subtasks';
import settingsRoutes from './routes/settings';
import { db } from './db';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/settings', settingsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 6: Test AI provider**

Run:
```bash
npm run dev
```

Test settings:
```bash
curl http://localhost:3001/api/settings
```

Expected: Default settings returned.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add AI provider integration with Ollama and OpenAI"
```

---

### Task 5: Task Execution Engine

**Files:**
- Create: `server/executor.ts`

**Interfaces:**
- Consumes: AI provider, database
- Produces: Background task executor that processes subtasks

- [ ] **Step 1: Create execution engine**

Create `server/executor.ts`:
```typescript
import { db } from './db';
import { OllamaProvider } from './ai/ollama';
import { OpenAIProvider } from './ai/openai';
import { Message } from './ai/provider';

interface TaskContext {
  taskTitle: string;
  taskDescription: string;
  subtasks: Array<{
    id: number;
    title: string;
    description: string;
    role_name: string;
  }>;
}

export async function executeTask(taskId: number): Promise<void> {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  // Update status to in_progress
  db.prepare(`UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(taskId);
  
  // Get or generate subtasks
  let subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(taskId) as any[];
  
  if (subtasks.length === 0) {
    // Generate subtasks using AI
    subtasks = await generateSubtasks(task);
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
    db.prepare(`UPDATE tasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(taskId);
  }
}

async function generateSubtasks(task: any): Promise<any[]> {
  const provider = await getProvider();
  
  const systemPrompt = `You are a Planner. Analyze the following task and break it down into 3-5 clear, actionable subtasks. Return a JSON array:`;
  
  const userMessage = `Task: ${task.title}\n\nDescription: ${task.description}`;
  
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
  
  const response = await provider.chat(messages);
  
  // Parse JSON response
  let subtaskData;
  try {
    // Try to extract JSON from response
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
      INSERT INTO subtasks (task_id, title, description, role_id)
      VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?))
    `).run(task.id, st.title, st.description, st.role);
    
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid) as any;
    insertedSubtasks.push(subtask);
  }
  
  return insertedSubtasks;
}

async function executeSubtask(subtaskId: number): Promise<void> {
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(subtaskId) as any;
  
  if (!subtask) {
    throw new Error(`Subtask ${subtaskId} not found`);
  }
  
  // Update status to in_progress
  db.prepare(`UPDATE subtasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);
  
  const provider = await getProvider();
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(subtask.role_id) as any;
  
  const messages: Message[] = [
    { role: 'system', content: role.system_prompt },
    { role: 'user', content: subtask.description },
  ];
  
  // Execute with step tracking
  let step = 1;
  let output = '';
  
  while (step <= 3) {
    const logEntry = db.prepare(`
      INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
      VALUES (?, ?, ?, ?, ?)
    `).run(subtaskId, step, role.id, JSON.stringify(messages), '');
    
    try {
      output = await provider.chat(messages);
      
      // Store output
      db.prepare(`
        INSERT INTO outputs (subtask_id, content)
        VALUES (?, ?)
      `).run(subtaskId, output);
      
      // Update log with output
      db.prepare(`
        UPDATE execution_logs SET output = ? WHERE id = ?
      `).run(output, logEntry.lastInsertRowid);
      
      // Mark subtask as done
      db.prepare(`UPDATE subtasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);
      
      break;
    } catch (error) {
      console.error(`Error executing subtask ${subtaskId} step ${step}:`, error);
      
      // Update log with error
      db.prepare(`
        UPDATE execution_logs SET output = ? WHERE id = ?
      `).run(`Error: ${error}`, logEntry.lastInsertRowid);
      
      step++;
      
      if (step > 3) {
        // Mark as review after failed attempts
        db.prepare(`UPDATE subtasks SET status = 'review', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);
      }
    }
  }
}

async function getProvider(): Promise<any> {
  const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
  
  if (!settings) {
    return new OllamaProvider('http://localhost:11434', 'llama3');
  }
  
  if (settings.provider === 'openai') {
    return new OpenAIProvider(settings.api_key || '', settings.model);
  }
  
  return new OllamaProvider(settings.endpoint, settings.model);
}
```

- [ ] **Step 2: Create executor route**

Create `server/routes/execute.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { executeTask } from '../executor';
import { db } from '../db';

const router = Router();

// Execute a task
router.post('/task/:id', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    
    // Start execution in background
    executeTask(taskId).catch(error => {
      console.error(`Error executing task ${taskId}:`, error);
    });
    
    res.json({ success: true, message: 'Task execution started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start execution' });
  }
});

// Get execution logs for a subtask
router.get('/logs/:subtaskId', (req: Request, res: Response) => {
  const logs = db.prepare(`
    SELECT el.*, r.name as role_name
    FROM execution_logs el
    JOIN roles r ON el.role_id = r.id
    WHERE el.subtask_id = ?
    ORDER BY el.step ASC
  `).all(req.params.subtaskId);
  
  res.json(logs);
});

export default router;
```

- [ ] **Step 3: Wire executor route**

Update `server/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks';
import subtaskRoutes from './routes/subtasks';
import settingsRoutes from './routes/settings';
import executeRoutes from './routes/execute';
import { db } from './db';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/execute', executeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add task execution engine with AI provider integration"
```

---

### Task 6: Install shadcn/ui Components

**Files:**
- Create: `components.json`
- Install: shadcn CLI and components

**Interfaces:**
- Consumes: React, Tailwind CSS
- Produces: shadcn/ui component library ready for use

- [ ] **Step 1: Install shadcn CLI**

Run:
```bash
npx shadcn@latest init
```

When prompted:
- Style: "new-york"
- Base color: "slate"
- CSS variables: yes

- [ ] **Step 2: Add required components**

Run:
```bash
npx shadcn@latest add button input label card dropdown-menu dialog select separator sidebar toast
```

- [ ] **Step 3: Verify installation**

Check that `components.json` exists and components are in `src/components/ui/`.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: install shadcn/ui components"
```

---

### Task 7: Dashboard Layout with Sidebar

**Files:**
- Create: `src/components/app-sidebar.tsx`
- Create: `src/components/site-header.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: shadcn/ui components
- Produces: Dashboard layout with collapsible sidebar and header

- [ ] **Step 1: Create app sidebar**

Create `src/components/app-sidebar.tsx`:
```typescript
import { Brain, Kanban, Settings, ListTodo } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const items = [
  {
    title: 'Dashboard',
    url: '/',
    icon: ListTodo,
  },
  {
    title: 'Kanban Board',
    url: '/kanban',
    icon: Kanban,
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
  },
];

export function AppSidebar() {
  const location = useLocation();
  
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2">
          <Brain className="h-6 w-6" />
          <span className="text-lg font-semibold">AI Task Executor</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <p className="text-xs text-muted-foreground px-4">
          MVP v0.1
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 2: Create site header**

Create `src/components/site-header.tsx`:
```typescript
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export function SiteHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-lg font-semibold">AI Task Executor</h1>
    </header>
  );
}
```

- [ ] **Step 3: Update App.tsx with routing**

Update `src/App.tsx`:
```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { DashboardPage } from '@/pages/DashboardPage';
import { KanbanPage } from '@/pages/KanbanPage';
import { SettingsPage } from '@/pages/SettingsPage';

function App() {
  return (
    <Router>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/kanban" element={<KanbanPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </SidebarInset>
      </SidebarProvider>
    </Router>
  );
}

export default App;
```

- [ ] **Step 4: Create placeholder pages**

Create `src/pages/DashboardPage.tsx`:
```typescript
export function DashboardPage() {
  return (
    <div className="flex-1 p-6">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <p className="text-muted-foreground">Task dashboard coming soon...</p>
    </div>
  );
}
```

Create `src/pages/KanbanPage.tsx`:
```typescript
export function KanbanPage() {
  return (
    <div className="flex-1 p-6">
      <h2 className="text-2xl font-bold mb-4">Kanban Board</h2>
      <p className="text-muted-foreground">Kanban board coming soon...</p>
    </div>
  );
}
```

Create `src/pages/SettingsPage.tsx`:
```typescript
export function SettingsPage() {
  return (
    <div className="flex-1 p-6">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <p className="text-muted-foreground">Settings page coming soon...</p>
    </div>
  );
}
```

- [ ] **Step 5: Install react-router-dom**

Run:
```bash
npm install react-router-dom
npm install -D @types/react-router-dom
```

Wait, @types/react-router-dom is not needed for React 18. Just:
```bash
npm install react-router-dom
```

- [ ] **Step 6: Install lucide-react icons**

Run:
```bash
npm install lucide-react
```

- [ ] **Step 7: Test layout**

Run:
```bash
npm run dev
```

Expected: Dashboard layout with sidebar navigation works.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: add dashboard layout with sidebar and routing"
```

---

### Task 8: Settings Page

**Files:**
- Create: `src/components/settings/SettingsForm.tsx`
- Modify: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: Settings API
- Produces: UI for configuring AI provider

- [ ] **Step 1: Create settings form**

Create `src/components/settings/SettingsForm.tsx`:
```typescript
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Settings {
  provider: 'ollama' | 'openai' | 'custom';
  endpoint: string;
  api_key?: string;
  model: string;
}

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings>({
    provider: 'ollama',
    endpoint: 'http://localhost:11434',
    model: 'llama3',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      alert('Settings saved!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Provider Settings</CardTitle>
        <CardDescription>Configure the AI provider for task execution</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={settings.provider}
              onValueChange={(value) => setSettings({ ...settings, provider: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.provider === 'ollama' && (
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                value={settings.endpoint}
                onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
          )}

          {settings.provider === 'openai' && (
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={settings.api_key || ''}
                onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                placeholder="sk-..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              placeholder="llama3"
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Update SettingsPage**

Update `src/pages/SettingsPage.tsx`:
```typescript
import { SettingsForm } from '@/components/settings/SettingsForm';

export function SettingsPage() {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        <SettingsForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Test settings page**

Run:
```bash
npm run dev
```

Navigate to Settings page and test saving.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add settings page for AI provider configuration"
```

---

### Task 9: Dashboard Page with Task List

**Files:**
- Create: `src/components/tasks/TaskList.tsx`
- Create: `src/components/tasks/CreateTaskDialog.tsx`
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: Tasks API
- Produces: Task list with create form and status badges

- [ ] **Step 1: Create task list component**

Create `src/components/tasks/TaskList.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Trash2 } from 'lucide-react';

interface Task {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  created_at: string;
}

interface TaskListProps {
  onTaskSelect: (taskId: number) => void;
}

export function TaskList({ onTaskSelect }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const handleExecute = async (taskId: number) => {
    try {
      await fetch(`/api/execute/task/${taskId}`, { method: 'POST' });
      fetchTasks();
    } catch (error) {
      console.error('Failed to execute task:', error);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm('Delete this task?')) return;
    
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'backlog': return 'bg-slate-500';
      case 'in_progress': return 'bg-blue-500';
      case 'review': return 'bg-yellow-500';
      case 'done': return 'bg-green-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">No tasks yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">{task.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
              </div>
              <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Role: {task.role_name} | Created: {new Date(task.created_at).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleExecute(task.id)}>
                    <Play className="h-4 w-4 mr-1" /> Execute
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(task.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create task creation dialog**

Create `src/components/tasks/CreateTaskDialog.tsx`:
```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface Role {
  id: number;
  name: string;
  description: string;
}

interface CreateTaskDialogProps {
  roles: Role[];
  onTaskCreated: () => void;
}

export function CreateTaskDialog({ roles, onTaskCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roleId, setRoleId] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, role_id: parseInt(roleId) }),
      });
      
      setOpen(false);
      setTitle('');
      setDescription('');
      setRoleId('');
      onTaskCreated();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Create Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Define a task for the AI to execute.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task in detail..."
              rows={4}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Assigned Role</Label>
            <Select value={roleId} onValueChange={setRoleId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.name} - {role.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button type="submit" disabled={creating || !title || !description || !roleId}>
            {creating ? 'Creating...' : 'Create Task'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Update DashboardPage**

Update `src/pages/DashboardPage.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { TaskList } from '@/components/tasks/TaskList';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';

interface Role {
  id: number;
  name: string;
  description: string;
}

export function DashboardPage() {
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <CreateTaskDialog roles={roles} onTaskCreated={() => {}} />
      </div>
      <TaskList onTaskSelect={() => {}} />
    </div>
  );
}
```

- [ ] **Step 4: Add roles route to backend**

Create `server/routes/roles.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY name ASC').all();
  res.json(roles);
});

export default router;
```

Update `server/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks';
import subtaskRoutes from './routes/subtasks';
import settingsRoutes from './routes/settings';
import executeRoutes from './routes/execute';
import roleRoutes from './routes/roles';
import { db } from './db';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/roles', roleRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 5: Test dashboard**

Run:
```bash
npm run dev
```

Test creating and listing tasks.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add dashboard with task list and creation form"
```

---

### Task 10: Kanban Board

**Files:**
- Create: `src/components/kanban/KanbanBoard.tsx`
- Create: `src/components/kanban/KanbanColumn.tsx`
- Create: `src/components/kanban/KanbanCard.tsx`
- Modify: `src/pages/KanbanPage.tsx`

**Interfaces:**
- Consumes: Tasks and subtasks API
- Produces: Drag-and-drop kanban board

- [ ] **Step 1: Create kanban card component**

Create `src/components/kanban/KanbanCard.tsx`:
```typescript
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

interface Subtask {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanCardProps {
  subtask: Subtask;
  onExecute?: (subtaskId: number) => void;
}

export function KanbanCard({ subtask, onExecute }: KanbanCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm">{subtask.title}</h4>
        <Badge variant="outline" className="text-xs">{subtask.role_name}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{subtask.description}</p>
      {onExecute && (
        <Button size="sm" variant="ghost" className="w-full" onClick={() => onExecute(subtask.id)}>
          <Play className="h-3 w-3 mr-1" /> Execute
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create kanban column**

Create `src/components/kanban/KanbanColumn.tsx`:
```typescript
import { KanbanCard } from './KanbanCard';

interface Subtask {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanColumnProps {
  title: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  subtasks: Subtask[];
  onExecute?: (subtaskId: number) => void;
}

const columnColors: Record<string, string> = {
  backlog: 'bg-slate-100 dark:bg-slate-800',
  'in_progress': 'bg-blue-100 dark:bg-blue-900',
  review: 'bg-yellow-100 dark:bg-yellow-900',
  done: 'bg-green-100 dark:bg-green-900',
};

export function KanbanColumn({ title, status, subtasks, onExecute }: KanbanColumnProps) {
  return (
    <div className={`flex-1 min-w-[280px] ${columnColors[status]} rounded-lg p-4`}>
      <h3 className="font-semibold mb-4 flex items-center justify-between">
        {title}
        <span className="text-xs bg-background/50 px-2 py-1 rounded-full">{subtasks.length}</span>
      </h3>
      <div className="space-y-3">
        {subtasks.map((subtask) => (
          <KanbanCard key={subtask.id} subtask={subtask} onExecute={onExecute} />
        ))}
        {subtasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No subtasks</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create kanban board**

Create `src/components/kanban/KanbanBoard.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { KanbanColumn } from './KanbanColumn';

interface Subtask {
  id: number;
  task_id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanBoardProps {
  taskId?: number;
}

export function KanbanBoard({ taskId }: KanbanBoardProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  useEffect(() => {
    if (taskId) {
      fetchSubtasks();
    }
  }, [taskId]);

  const fetchSubtasks = async () => {
    try {
      const response = await fetch(`/api/subtasks/task/${taskId}`);
      const data = await response.json();
      setSubtasks(data);
    } catch (error) {
      console.error('Failed to fetch subtasks:', error);
    }
  };

  const handleExecute = async (subtaskId: number) => {
    try {
      await fetch(`/api/execute/subtask/${subtaskId}`, { method: 'POST' });
      fetchSubtasks();
    } catch (error) {
      console.error('Failed to execute subtask:', error);
    }
  };

  const backlogSubtasks = subtasks.filter(s => s.status === 'backlog');
  const inProgressSubtasks = subtasks.filter(s => s.status === 'in_progress');
  const reviewSubtasks = subtasks.filter(s => s.status === 'review');
  const doneSubtasks = subtasks.filter(s => s.status === 'done');

  return (
    <div className="flex gap-4 p-6 overflow-x-auto">
      <KanbanColumn
        title="Backlog"
        status="backlog"
        subtasks={backlogSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="In Progress"
        status="in_progress"
        subtasks={inProgressSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="Review"
        status="review"
        subtasks={reviewSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="Done"
        status="done"
        subtasks={doneSubtasks}
      />
    </div>
  );
}
```

- [ ] **Step 4: Update KanbanPage**

Update `src/pages/KanbanPage.tsx`:
```typescript
import { KanbanBoard } from '@/components/kanban/KanbanBoard';

interface KanbanPageProps {
  taskId?: number;
}

export function KanbanPage({ taskId }: KanbanPageProps) {
  return (
    <div className="flex-1">
      <KanbanBoard taskId={taskId} />
    </div>
  );
}
```

- [ ] **Step 5: Add subtask execute route**

Create `server/routes/executeSubtask.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { executeSubtask } from '../executor';

const router = Router();

router.post('/subtask/:id', async (req: Request, res: Response) => {
  try {
    const subtaskId = parseInt(req.params.id);
    await executeSubtask(subtaskId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute subtask' });
  }
});

export default router;
```

Update `server/index.ts`:
```typescript
import executeSubtaskRoutes from './routes/executeSubtask';
// ...
app.use('/api/execute', executeSubtaskRoutes);
```

- [ ] **Step 6: Test kanban board**

Run:
```bash
npm run dev
```

Create a task, execute it, and verify subtasks appear in kanban.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add kanban board for task monitoring"
```

---

### Task 11: Task Detail View

**Files:**
- Create: `src/components/tasks/TaskDetail.tsx`
- Create: `src/components/execution/ExecutionLogs.tsx`

**Interfaces:**
- Consumes: Task, subtasks, execution logs APIs
- Produces: Detailed task view with execution history

- [ ] **Step 1: Create execution logs component**

Create `src/components/execution/ExecutionLogs.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ExecutionLog {
  id: number;
  step: number;
  role_name: string;
  input: string;
  output: string;
  created_at: string;
}

interface ExecutionLogsProps {
  subtaskId: number;
}

export function ExecutionLogs({ subtaskId }: ExecutionLogsProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);

  useEffect(() => {
    fetchLogs();
  }, [subtaskId]);

  const fetchLogs = async () => {
    try {
      const response = await fetch(`/api/execute/logs/${subtaskId}`);
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">No execution logs yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <Card key={log.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Step {log.step} - {log.role_name}</CardTitle>
              <Badge variant="outline">{new Date(log.created_at).toLocaleTimeString()}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Input:</h4>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(JSON.parse(log.input), null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Output:</h4>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                  {log.output}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create task detail component**

Create `src/components/tasks/TaskDetail.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play } from 'lucide-react';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ExecutionLogs } from '@/components/execution/ExecutionLogs';

interface Task {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  subtasks: Array<{
    id: number;
    title: string;
    description: string;
    role_name: string;
    status: 'backlog' | 'in_progress' | 'review' | 'done';
  }>;
}

interface TaskDetailProps {
  taskId: number;
  onBack: () => void;
}

export function TaskDetail({ taskId, onBack }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      const data = await response.json();
      setTask(data);
    } catch (error) {
      console.error('Failed to fetch task:', error);
    }
  };

  const handleExecute = async () => {
    try {
      await fetch(`/api/execute/task/${taskId}`, { method: 'POST' });
      fetchTask();
    } catch (error) {
      console.error('Failed to execute task:', error);
    }
  };

  if (!task) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-2xl font-bold">{task.title}</h2>
        <Badge>{task.status}</Badge>
        <Button size="sm" onClick={handleExecute}>
          <Play className="h-4 w-4 mr-1" /> Execute
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{task.description}</p>
          <div className="text-sm text-muted-foreground">
            Assigned Role: <span className="font-medium">{task.role_name}</span>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">Subtasks</h3>
        <KanbanBoard taskId={taskId} />
      </div>

      {task.subtasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Execution Logs</h3>
          {task.subtasks.map(subtask => (
            <ExecutionLogs key={subtask.id} subtaskId={subtask.id} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update routing to support task detail**

Update `src/App.tsx`:
```typescript
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
// ...
<Route path="/task/:id" element={<TaskDetailPage />} />
// ...

function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <TaskDetail taskId={parseInt(id!)} onBack={() => navigate('/')} />;
}
```

- [ ] **Step 4: Test task detail**

Run:
```bash
npm run dev
```

Click on a task to view details.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add task detail view with execution logs"
```

---

### Task 12: Integration Testing and Polish

**Files:**
- Test all features end-to-end
- Fix any bugs
- Add loading states
- Improve error handling

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working MVP ready for demo

- [ ] **Step 1: Test complete workflow**

1. Start the application: `npm run dev`
2. Navigate to Settings and configure Ollama (or leave defaults)
3. Create a new task
4. Execute the task
5. Monitor progress in Kanban board
6. View task details and execution logs
7. Verify all statuses update correctly

- [ ] **Step 2: Add error boundaries**

Create `src/components/ErrorBoundary.tsx`:
```typescript
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Update `src/main.tsx`:
```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';
// ...
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

- [ ] **Step 3: Add loading states**

Add loading spinners to async operations using shadcn's Spinner or a simple CSS animation.

- [ ] **Step 4: Improve UX**

- Add toast notifications for success/error messages
- Add confirmation dialogs for destructive actions
- Add empty states with helpful messages

- [ ] **Step 5: Final testing**

Run through all scenarios:
- Create task with each role
- Execute tasks
- View kanban board
- View task details
- Change settings
- Handle errors gracefully

- [ ] **Step 6: Commit final version**

```bash
git add .
git commit -m "feat: polish UI, add error handling, complete MVP"
```

---

## Execution Summary

This plan implements an AI task execution system with:
- Task creation and management
- AI-powered task decomposition
- Role-based execution (Planner, Researcher, Writer, Reviewer)
- Kanban board for monitoring
- Execution logs for transparency
- Settings for AI provider configuration

All state persisted in SQLite, no external dependencies required.
