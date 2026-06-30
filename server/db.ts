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
