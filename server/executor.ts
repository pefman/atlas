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

export async function executeSubtask(subtaskId: number): Promise<void> {
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
