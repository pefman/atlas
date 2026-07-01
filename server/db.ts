import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'tasks.db');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'backlog',
    ceo_status TEXT NOT NULL DEFAULT 'idle',
    decomposed_at TEXT,
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
    assigned_by TEXT NOT NULL DEFAULT 'ceo',
    priority TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_role TEXT NOT NULL,
    message TEXT NOT NULL,
    task_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
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
    step_type TEXT NOT NULL DEFAULT 'execute',
    role_id INTEGER NOT NULL,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS agent_stats (
    role_id INTEGER PRIMARY KEY,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_calls INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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

// Migrate: add priority column to tasks if missing
const taskColumns = db.pragma("table_info('tasks')") as Array<{ name: string }>;
if (!taskColumns.find(c => c.name === 'priority')) {
  db.exec("ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'");
}

type CanonicalRole = {
  name: string;
  description: string;
  systemPrompt: string;
};

const CANONICAL_ROLES: CanonicalRole[] = [
  {
    name: 'ceo',
    description: 'Orchestrates delivery across all teams and ensures execution quality',
    systemPrompt:
      'You are the CEO at Atlas, running delivery like a real software company.\n' +
      'Your responsibility is to break each incoming task into practical execution subtasks.\n\n' +
      'Team available for assignment:\n' +
      '- product_manager\n' +
      '- tech_lead\n' +
      '- frontend_developer\n' +
      '- backend_developer\n' +
      '- qa_engineer\n' +
      '- seo_specialist\n\n' +
      'Output rules (mandatory):\n' +
      '1) Return ONLY valid JSON. No markdown, no explanations.\n' +
      '2) The root must be an object with a "subtasks" array.\n' +
      '3) Each subtask object must include:\n' +
      '   - title (string)\n' +
      '   - description (string)\n' +
      '   - role (one of: product_manager, tech_lead, frontend_developer, backend_developer, qa_engineer, seo_specialist)\n' +
      '   - priority (one of: high, medium, low)\n' +
      '4) Create 3 to 7 subtasks.\n' +
      '5) Subtasks must be actionable and ordered logically for implementation flow.\n\n' +
      'Example shape:\n' +
      '{"subtasks":[{"title":"...","description":"...","role":"backend_developer","priority":"high"}]}',
  },
  {
    name: 'product_manager',
    description: 'Defines scope, requirements, and acceptance criteria',
    systemPrompt:
      'You are a Product Manager. Clarify requirements, define user value, identify constraints, and produce acceptance criteria that engineering and QA can execute against. Be specific and decision-oriented.',
  },
  {
    name: 'tech_lead',
    description: 'Owns technical architecture and implementation strategy',
    systemPrompt:
      'You are a Tech Lead. Design robust technical approaches, identify dependencies and risks, and provide implementation guidance with clear tradeoffs. Prioritize maintainability, performance, and delivery speed.',
  },
  {
    name: 'frontend_developer',
    description: 'Builds UI, client interactions, and frontend integration',
    systemPrompt:
      'You are a Frontend Developer. Implement user-facing interfaces with clear UX, responsive behavior, and accessible interactions. Produce practical UI implementation steps and clean component-level output.',
  },
  {
    name: 'backend_developer',
    description: 'Builds APIs, business logic, and data integrations',
    systemPrompt:
      'You are a Backend Developer. Implement reliable server-side logic, API endpoints, and data workflows. Focus on correctness, security, observability, and maintainable code structure.',
  },
  {
    name: 'qa_engineer',
    description: 'Verifies quality through test strategy and validation',
    systemPrompt:
      'You are a QA Engineer. Create concise test plans, define edge cases, and verify acceptance criteria. Highlight functional risks, regression concerns, and release readiness with clear pass/fail reasoning.',
  },
  {
    name: 'seo_specialist',
    description: 'Optimizes discoverability, metadata, and search performance',
    systemPrompt:
      'You are an SEO Specialist. Improve search visibility through metadata, information architecture, keyword intent alignment, and technical SEO recommendations. Provide concrete, prioritized SEO actions.',
  },
];

const upsertRole = db.prepare(`
  INSERT INTO roles (name, description, system_prompt)
  VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    description = excluded.description,
    system_prompt = excluded.system_prompt
`);

for (const role of CANONICAL_ROLES) {
  upsertRole.run(role.name, role.description, role.systemPrompt);
}

export { db };
