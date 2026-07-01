import { db } from './db';
import { OllamaProvider } from './ai/ollama';
import { OpenAIProvider } from './ai/openai';
import { Message, ChatResponse } from './ai/provider';
import { execEventBus } from './events';
import { logTask, logCEO, logCEOError, logSubtask, logSubtaskError } from './lib/logger';

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

type DecompositionSubtask = {
  title?: unknown;
  description?: unknown;
  role?: unknown;
  priority?: unknown;
};

const DEFAULT_SUBTASK_ROLE = 'backend_developer';
const FALLBACK_SUBTASK_PRIORITY = 'medium';

const ROLE_ALIASES: Record<string, string> = {
  researcher: 'product_manager',
  writer: 'frontend_developer',
  reviewer: 'qa_engineer',
  planner: 'product_manager',
  frontend: 'frontend_developer',
  backend: 'backend_developer',
  seo: 'seo_specialist',
  qa: 'qa_engineer',
  product: 'product_manager',
};

function normalizePriority(value: unknown): 'high' | 'medium' | 'low' {
  if (typeof value !== 'string') {
    return FALLBACK_SUBTASK_PRIORITY;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }

  return FALLBACK_SUBTASK_PRIORITY;
}

function normalizeRoleName(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_SUBTASK_ROLE;
  }

  const sanitized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[sanitized] ?? sanitized;
}

function parseDecompositionSubtasks(rawContent: string): DecompositionSubtask[] {
  const parseJson = (input: string): unknown => JSON.parse(input);

  const candidates: string[] = [rawContent.trim()];
  const fencedJson = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) {
    candidates.push(fencedJson[1].trim());
  }

  const objectMatch = rawContent.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    candidates.push(objectMatch[0]);
  }

  const arrayMatch = rawContent.match(/\[[\s\S]*\]/);
  if (arrayMatch?.[0]) {
    candidates.push(arrayMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed = parseJson(candidate);
      if (Array.isArray(parsed)) {
        return parsed as DecompositionSubtask[];
      }

      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).subtasks)) {
        return (parsed as any).subtasks as DecompositionSubtask[];
      }
    } catch {
      // Continue trying additional extraction candidates.
    }
  }

  throw new Error('No valid decomposition JSON found in model response');
}

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
  
  const response: ChatResponse = await provider.chat(messages);
  
  // Update agent stats
  await updateAgentStats(ceoRole.id, response.usage);
  
  // Parse JSON response
  let subtaskData: DecompositionSubtask[];
  try {
    subtaskData = parseDecompositionSubtasks(response.content);
  } catch {
    // Fallback: create a single subtask
    subtaskData = [{
      title: task.title,
      description: task.description,
      role: DEFAULT_SUBTASK_ROLE,
      priority: FALLBACK_SUBTASK_PRIORITY,
    }];
  }

  const availableRoles = db.prepare('SELECT id, name FROM roles').all() as Array<{ id: number; name: string }>;
  const roleByName = new Map(availableRoles.map(role => [role.name, role]));

  const fallbackRole =
    roleByName.get(DEFAULT_SUBTASK_ROLE) ??
    roleByName.get('tech_lead') ??
    roleByName.get('ceo');

  if (!fallbackRole) {
    throw new Error('No fallback role available for decomposition assignment');
  }
  
  // Insert subtasks into database
  const insertedSubtasks = [];
  for (const st of subtaskData) {
    const normalizedTitle = typeof st.title === 'string' && st.title.trim()
      ? st.title.trim()
      : `Subtask for ${task.title}`;

    const normalizedDescription = typeof st.description === 'string' && st.description.trim()
      ? st.description.trim()
      : task.description;

    const requestedRole = typeof st.role === 'string' ? st.role : DEFAULT_SUBTASK_ROLE;
    const normalizedRole = normalizeRoleName(st.role);
    const resolvedRole = roleByName.get(normalizedRole) ?? fallbackRole;
    const resolvedPriority = normalizePriority(st.priority);

    const result = db.prepare(`
      INSERT INTO subtasks (task_id, title, description, role_id, assigned_by, priority)
      VALUES (?, ?, ?, ?, 'ceo', ?)
    `).run(task.id, normalizedTitle, normalizedDescription, resolvedRole.id, resolvedPriority);
    
    logSubtask('Assigned', { 
      title: normalizedTitle, 
      id: result.lastInsertRowid, 
      role: resolvedRole.name 
    });
    
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid) as any;
    insertedSubtasks.push(subtask);

    db.prepare(`
      INSERT INTO execution_logs (subtask_id, step, step_type, role_id, input, output)
      VALUES (?, 0, 'assign', ?, ?, ?)
    `).run(
      subtask.id,
      ceoRole.id,
      JSON.stringify({
        task_title: task.title,
        requested_role: requestedRole,
        normalized_role: normalizedRole,
        resolved_role: resolvedRole.name,
        fallback_used: resolvedRole.name !== normalizedRole,
      }),
      `Assigned to ${resolvedRole.name}`
    );
  }
  
  // Update task ceo_status
  db.prepare(`
    UPDATE tasks SET ceo_status = 'decomposed', decomposed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).run(task.id);
  
  logCEO('Decomposed', { task_id: task.id, subtask_count: insertedSubtasks.length });
  
  return insertedSubtasks;
}

export async function executeTask(taskId: number): Promise<void> {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Update status to in_progress
  db.prepare(`UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(taskId);
  
  // Update ceo_status to decomposing
  db.prepare(`UPDATE tasks SET ceo_status = 'decomposing', updated_at = datetime('now') WHERE id = ?`).run(taskId);

  logCEO('Decomposing', { task_id: taskId, title: task.title });

  // Get or generate subtasks
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
  `).all(taskId) as any[];

  if (subtasks.length === 0) {
    // Generate subtasks using CEO agent
    try {
      subtasks = await decomposeTask(task);
    } catch (error) {
      logCEOError(error, { task_id: taskId, title: task.title });
      db.prepare(`UPDATE tasks SET ceo_status = 'error', updated_at = datetime('now') WHERE id = ?`).run(taskId);
      throw error;
    }
  }

  // Execute each subtask
  for (const subtask of subtasks) {
    await executeSubtask(subtask.id);
  }

  // Update task status to done if all subtasks are done or review
  const pendingSubtasks = db.prepare(
    "SELECT COUNT(*) as count FROM subtasks WHERE task_id = ? AND status NOT IN ('done', 'review')"
  ).get(taskId) as { count: number };

  if (pendingSubtasks.count === 0) {
    db.prepare(`UPDATE tasks SET status = 'done', ceo_status = 'idle', updated_at = datetime('now') WHERE id = ?`).run(taskId);
    logTask('Completed', { id: taskId, title: task.title });
  }
}

export async function processNextTask(): Promise<boolean> {
  // Check if AI provider is configured
  const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
  if (!settings) {
    console.log('[CEO Worker] No AI settings configured, skipping task execution');
    return false;
  }

  // Get next task in backlog
  const task = db.prepare(`
    SELECT * FROM tasks 
    WHERE status = 'backlog' 
    ORDER BY created_at ASC 
    LIMIT 1
  `).get() as any;

  if (!task) {
    return false; // No tasks in backlog
  }

  try {
    await executeTask(task.id);
    return true; // Successfully processed
  } catch (error) {
    console.error(`Error processing task ${task.id}:`, error);
    return false; // Failed to process
  }
}

export async function executeSubtask(subtaskId: number): Promise<void> {
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(subtaskId) as any;

  if (!subtask) {
    throw new Error(`Subtask ${subtaskId} not found`);
  }

  // Update status to in_progress
  db.prepare(`UPDATE subtasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);

  logSubtask('Started', { id: subtaskId, title: subtask.title });

  const provider = await getProvider();
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(subtask.role_id) as any;

  // Initialize conversation with system prompt and task
  const messages: Message[] = [
    { role: 'system', content: role.system_prompt },
    { role: 'user', content: subtask.description },
  ];

  // Execute with step tracking
  let step = 1;
  let output = '';

  while (step <= 3) {
    // Log the full conversation context
    const logEntry = db.prepare(`
      INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
      VALUES (?, ?, ?, ?, ?)
    `).run(subtaskId, step, role.id, JSON.stringify(messages), '');

    try {
      const chatResponse: ChatResponse = await provider.chat(messages);
      output = chatResponse.content;

      // Update agent stats
      await updateAgentStats(role.id, chatResponse.usage);

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
      logSubtask('Completed', { id: subtaskId, title: subtask.title });

      break;
    } catch (error) {
      logSubtaskError(error, { id: subtaskId, title: subtask.title, step });

      // Update log with error
      db.prepare(`
        UPDATE execution_logs SET output = ? WHERE id = ?
      `).run(`Error: ${error}`, logEntry.lastInsertRowid);

      step++;

      if (step > 3) {
        // Mark as done after exhausting retries (will be reviewed later)
        db.prepare(`UPDATE subtasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);
      }
    }
  }
}

async function getProvider(): Promise<any> {
  const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();

  if (!settings) {
    console.log('[Executor] No settings found, using default Ollama provider');
    return new OllamaProvider('http://localhost:11434', 'llama3');
  }

  console.log('[Executor] Using provider:', settings.provider, 'with model:', settings.model);
  
  if (settings.provider === 'openai') {
    if (!settings.api_key) {
      console.error('[Executor] OpenAI provider selected but no API key configured. Falling back to Ollama.');
      return new OllamaProvider('http://localhost:11434', 'llama3');
    }
    console.log('[Executor] OpenAI API key present:', settings.api_key.substring(0, 10) + '...');
    return new OpenAIProvider(settings.api_key, settings.model, settings.endpoint);
  }

  return new OllamaProvider(settings.endpoint, settings.model);
}

async function notifyUser(message: string, taskId?: number): Promise<void> {
  try {
    const result = db.prepare(`
      INSERT INTO notifications (sender_role, message, task_id)
      VALUES (?, ?, ?)
    `).run('ceo', message, taskId || null);

    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
    execEventBus.emit('notification', notification);
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

async function updateAgentStats(roleId: number, usage?: { input: number; output: number }): Promise<void> {
  if (!usage) return;
  
  const existing = db.prepare('SELECT * FROM agent_stats WHERE role_id = ?').get(roleId) as any;
  
  if (existing) {
    db.prepare(`
      UPDATE agent_stats 
      SET total_input_tokens = total_input_tokens + ?,
          total_output_tokens = total_output_tokens + ?,
          total_calls = total_calls + 1,
          updated_at = datetime('now')
      WHERE role_id = ?
    `).run(usage.input, usage.output, roleId);
  } else {
    db.prepare(`
      INSERT INTO agent_stats (role_id, total_input_tokens, total_output_tokens, total_calls, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'))
    `).run(roleId, usage.input, usage.output);
  }
}

// CEO background worker - periodically checks for in_progress tasks
let ceoInterval: NodeJS.Timeout | null = null;

export function startCEOWorker() {
  if (ceoInterval) {
    clearInterval(ceoInterval);
  }
  
  // Check every 5 seconds for in_progress tasks
  ceoInterval = setInterval(async () => {
    try {
      const hasTasks = await processNextInProgress();
      if (!hasTasks) {
        // No tasks, but keep checking
        return;
      }
      // Task was processed, continue loop
    } catch (error) {
      console.error('CEO worker error:', error);
    }
  }, 5000);
  
  console.log('CEO worker started - checking for in_progress tasks every 5 seconds');
}

export async function processNextInProgress(): Promise<boolean> {
  // Get next task in in_progress
  const task = db.prepare(`
    SELECT * FROM tasks 
    WHERE status = 'in_progress' 
    ORDER BY created_at ASC 
    LIMIT 1
  `).get() as any;

  if (!task) {
    return false; // No tasks in in_progress
  }

  try {
    await executeTask(task.id);
    return true; // Successfully processed
  } catch (error) {
    console.error(`Error processing task ${task.id}:`, error);
    return false; // Failed to process
  }
}

export function stopCEOWorker() {
  if (ceoInterval) {
    clearInterval(ceoInterval);
    ceoInterval = null;
    console.log('CEO worker stopped');
  }
}
