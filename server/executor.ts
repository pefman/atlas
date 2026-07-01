import { db } from './db';
import { OllamaProvider } from './ai/ollama';
import { OpenAIProvider } from './ai/openai';
import { Message } from './ai/provider';
import { execEventBus } from './events';

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
      INSERT INTO subtasks (task_id, title, description, role_id, assigned_by, priority)
      VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?), 'ceo', ?)
    `).run(task.id, st.title, st.description, st.role, st.priority || 'medium');
    
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid) as any;
    insertedSubtasks.push(subtask);
  }
  
  // Update task ceo_status
  db.prepare(`
    UPDATE tasks SET ceo_status = 'decomposed', decomposed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).run(task.id);
  
  // Log decomposition in execution_logs
  for (const subtask of insertedSubtasks) {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(subtask.role_id) as any;
    db.prepare(`
      INSERT INTO execution_logs (subtask_id, step, step_type, role_id, input, output)
      VALUES (?, 0, 'assign', ?, ?, ?)
    `).run(
      subtask.id,
      ceoRole.id,
      JSON.stringify({ task_title: task.title, assigned_role: role.name }),
      `Assigned to ${role.name}`
    );
  }
  
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
      console.error(`Error decomposing task ${taskId}:`, error);
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
  }
}

export async function processNextTask(): Promise<boolean> {
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

// CEO background worker - periodically checks for backlog tasks
let ceoInterval: NodeJS.Timeout | null = null;

export function startCEOWorker() {
  if (ceoInterval) {
    clearInterval(ceoInterval);
  }
  
  // Check every 5 seconds for new tasks
  ceoInterval = setInterval(async () => {
    try {
      const hasTasks = await processNextTask();
      if (!hasTasks) {
        // No tasks, but keep checking
        return;
      }
      // Task was processed, continue loop
    } catch (error) {
      console.error('CEO worker error:', error);
    }
  }, 5000);
  
  console.log('CEO worker started - checking for backlog tasks every 5 seconds');
}

export function stopCEOWorker() {
  if (ceoInterval) {
    clearInterval(ceoInterval);
    ceoInterval = null;
    console.log('CEO worker stopped');
  }
}
