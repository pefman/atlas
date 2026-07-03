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
    system_prompt TEXT NOT NULL,
    personality TEXT NOT NULL DEFAULT '',
    portrait TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    project_id INTEGER,
    role_id INTEGER NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'backlog',
    ceo_status TEXT NOT NULL DEFAULT 'idle',
    decomposed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    folder_path TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    provider TEXT,
    remote_url TEXT,
    local_path TEXT,
    default_branch TEXT NOT NULL DEFAULT 'main',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS project_repo_public_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    public_key TEXT NOT NULL,
    key_type TEXT NOT NULL DEFAULT 'ssh',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (repo_id) REFERENCES project_repos(id)
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

  CREATE TABLE IF NOT EXISTS message_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    task_id INTEGER,
    subtask_id INTEGER,
    subject TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'open',
    created_by TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    role_id INTEGER,
    sender_type TEXT NOT NULL,
    content TEXT NOT NULL,
    task_id INTEGER,
    subtask_id INTEGER,
    requires_response INTEGER NOT NULL DEFAULT 0,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (thread_id) REFERENCES message_threads(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id)
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

  CREATE TABLE IF NOT EXISTS agent_email_activity (
    role_id INTEGER PRIMARY KEY,
    last_user_message_at TEXT NOT NULL DEFAULT (datetime('now')),
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
if (!taskColumns.find(c => c.name === 'project_id')) {
  db.exec("ALTER TABLE tasks ADD COLUMN project_id INTEGER");
}

const notificationColumns = db.pragma("table_info('notifications')") as Array<{ name: string }>;
if (!notificationColumns.find(c => c.name === 'thread_id')) {
  db.exec("ALTER TABLE notifications ADD COLUMN thread_id INTEGER");
}

const roleColumns = db.pragma("table_info('roles')") as Array<{ name: string }>;
if (!roleColumns.find(c => c.name === 'personality')) {
  db.exec("ALTER TABLE roles ADD COLUMN personality TEXT NOT NULL DEFAULT ''");
}
if (!roleColumns.find(c => c.name === 'portrait')) {
  db.exec("ALTER TABLE roles ADD COLUMN portrait TEXT NOT NULL DEFAULT ''");
}
if (!roleColumns.find(c => c.name === 'gender')) {
  db.exec("ALTER TABLE roles ADD COLUMN gender TEXT NOT NULL DEFAULT 'male'");
}
if (!roleColumns.find(c => c.name === 'funny_name')) {
  db.exec("ALTER TABLE roles ADD COLUMN funny_name TEXT NOT NULL DEFAULT ''");
}

const messageThreadColumns = db.pragma("table_info('message_threads')") as Array<{ name: string }>;
if (!messageThreadColumns.find(c => c.name === 'category')) {
  db.exec("ALTER TABLE message_threads ADD COLUMN category TEXT NOT NULL DEFAULT 'general'");
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_projects_active_name ON projects(is_active, name);
  CREATE INDEX IF NOT EXISTS idx_project_repos_project_id ON project_repos(project_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_message_threads_role_status ON message_threads(role_id, status, updated_at);
  CREATE INDEX IF NOT EXISTS idx_message_threads_category_status ON message_threads(category, status, updated_at);
  CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages(thread_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_unread_agent ON messages(sender_type, is_read, created_at);
  CREATE INDEX IF NOT EXISTS idx_agent_email_activity_updated ON agent_email_activity(updated_at);
`);

type CanonicalRole = {
  name: string;
  description: string;
  systemPrompt: string;
  personality: string;
};

const CLARIFICATION_POLICY =
  '\n\nClarification policy:\n' +
  'If required inputs are missing or ambiguous, ask concise clarification questions before proceeding.\n' +
  'Return ONLY valid JSON in this shape when clarification is needed:\n' +
  '{"type":"clarification_request","needs_clarification":true,"reason":"...","questions":["..."],"missing_fields":["..."]}\n' +
  'Include 1-3 concrete questions.\n' +
  'If enough context exists, proceed with your normal role output.';

const TOOL_POLICY =
  '\n\nTool policy:\n' +
  'If current context is not enough and external information is required, you may call the web search tool.\n' +
  'To call it, return ONLY valid JSON in this shape:\n' +
  '{"type":"tool_call","tool":"search_web","arguments":{"query":"...","max_results":5}}\n' +
  'Use concise queries and only call tools when necessary.\n' +
  'After tool results are provided, return your normal final answer.';

const CANONICAL_ROLES: CanonicalRole[] = [
  {
    name: 'ceo',
    description: 'Orchestrates delivery across all teams and ensures execution quality',
    systemPrompt:
      'You are the CEO at Atlas, running delivery like a real software company.\n' +
      'Your responsibility is to break each incoming task into practical execution subtasks.\n\n' +
      'Clarification policy:\n' +
      'If critical context is missing for decomposition, ask concise clarification questions instead of guessing.\n' +
      'In that case, return ONLY valid JSON in this shape:\n' +
      '{"type":"clarification_request","needs_clarification":true,"reason":"...","questions":["..."],"missing_fields":["..."]}\n' +
      'Include 1-3 concrete questions.\n\n' +
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
    personality: 'direct, decisive, no-nonsense. Uses short sentences. Gets to the point.',
  },
  {
    name: 'product_manager',
    description: 'Defines scope, requirements, and acceptance criteria',
    systemPrompt:
      'You are a Product Manager. Clarify requirements, define user value, identify constraints, and produce acceptance criteria that engineering and QA can execute against. Be specific and decision-oriented.' + TOOL_POLICY + CLARIFICATION_POLICY,
    personality: 'structured, analytical. Asks clarifying questions before making recommendations. Prefers bullet points.',
  },
  {
    name: 'tech_lead',
    description: 'Owns technical architecture and implementation strategy',
    systemPrompt:
      'You are a Tech Lead. Design robust technical approaches, identify dependencies and risks, and provide implementation guidance with clear tradeoffs. Prioritize maintainability, performance, and delivery speed.' + TOOL_POLICY + CLARIFICATION_POLICY,
    personality: 'thoughtful, pragmatic. Weighs tradeoffs explicitly. Uses technical terms precisely.',
  },
  {
    name: 'frontend_developer',
    description: 'Builds UI, client interactions, and frontend integration',
    systemPrompt:
      'You are a Frontend Developer. Implement user-facing interfaces with clear UX, responsive behavior, and accessible interactions. Produce practical UI implementation steps and clean component-level output.' + TOOL_POLICY + CLARIFICATION_POLICY,
    personality: 'detail-oriented, visual. Thinks about user experience. Mentions accessibility when relevant.',
  },
  {
    name: 'backend_developer',
    description: 'Builds APIs, business logic, and data integrations',
    systemPrompt:
      'You are a Backend Developer. Implement reliable server-side logic, API endpoints, and data workflows. Focus on correctness, security, observability, and maintainable code structure.' + TOOL_POLICY + CLARIFICATION_POLICY,
    personality: 'methodical, security-conscious. Explains reasoning behind architectural choices. Prefers proven patterns.',
  },
  {
    name: 'qa_engineer',
    description: 'Verifies quality through test strategy and validation',
    systemPrompt:
      'You are a QA Engineer. Create concise test plans, define edge cases, and verify acceptance criteria. Highlight functional risks, regression concerns, and release readiness with clear pass/fail reasoning.' + TOOL_POLICY + CLARIFICATION_POLICY,
    personality: 'thorough, skeptical. Looks for edge cases. Asks "what if this breaks?" Consideration for regression.',
  },
  {
    name: 'seo_specialist',
    description: 'Optimizes discoverability, metadata, and search performance',
    systemPrompt:
      'You are an SEO Specialist. Improve search visibility through metadata, information architecture, keyword intent alignment, and technical SEO recommendations. Provide concrete, prioritized SEO actions.' + TOOL_POLICY + CLARIFICATION_POLICY,
    personality: 'data-driven, strategic. Focuses on metrics and rankings. Suggests specific keywords and metadata.',
  },
];

const upsertRole = db.prepare(`
  INSERT INTO roles (name, description, system_prompt, personality)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    description = excluded.description,
    system_prompt = excluded.system_prompt,
    personality = excluded.personality
`);

for (const role of CANONICAL_ROLES) {
  upsertRole.run(role.name, role.description, role.systemPrompt, role.personality);
}

export { db };
