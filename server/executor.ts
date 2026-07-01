import { db } from './db';
import { OllamaProvider } from './ai/ollama';
import { OpenAIProvider } from './ai/openai';
import { Message, ChatResponse } from './ai/provider';
import { execEventBus } from './events';
import { logTask, logSubtask, logSubtaskError } from './lib/logger';

export async function decomposeTask(task: any): Promise<any[]> {
  const { provider } = await getProvider();

  const ceoRole = db.prepare('SELECT * FROM roles WHERE name = ?').get('ceo') as any;
  if (!ceoRole) {
    throw new Error('CEO role not found in database');
  }

  const messages: Message[] = [
    { role: 'system', content: ceoRole.system_prompt },
    { role: 'user', content: `Task: ${task.title}\n\nDescription: ${task.description}` },
  ];

  const response: ChatResponse = await provider.chat(messages);
  await updateAgentStats(ceoRole.id, response.usage);

  const subtaskData = parseDecompositionContent(response.content, task);

  const insertedSubtasks = [];
  for (const st of subtaskData) {
    const result = db.prepare(`
      INSERT INTO subtasks (task_id, title, description, role_id, assigned_by, priority)
      VALUES (?, ?, ?, ?, 'ceo', ?)
    `).run(task.id, st.title, st.description, st.role_id, st.priority);

    logSubtask('Assigned', { title: st.title, id: result.lastInsertRowid, role: st.role_name });

    db.prepare(`
      INSERT INTO execution_logs (subtask_id, step, step_type, role_id, input, output)
      VALUES (?, 0, 'assign', ?, ?, ?)
    `).run(
      result.lastInsertRowid,
      ceoRole.id,
      JSON.stringify({ task_title: task.title, requested_role: st.requested_role }),
      `Assigned to ${st.role_name}`
    );

    insertedSubtasks.push({ id: result.lastInsertRowid, ...st });
  }

  db.prepare(`
    UPDATE tasks SET ceo_status = 'decomposed', decomposed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).run(task.id);

  logTask('Decomposed', { task_id: task.id, subtask_count: insertedSubtasks.length });

  return insertedSubtasks;
}

export async function executeSubtask(subtaskId: number): Promise<void> {
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(subtaskId) as any;
  if (!subtask) {
    throw new Error(`Subtask ${subtaskId} not found`);
  }

  db.prepare(`UPDATE subtasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);

  const { provider, name: providerName } = await getProvider();
  logSubtask('Started', { id: subtaskId, title: subtask.title }, providerName);

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(subtask.role_id) as any;

  const messages: Message[] = [
    { role: 'system', content: role?.system_prompt || '' },
    { role: 'user', content: subtask.description },
  ];

  const logEntry = db.prepare(`
    INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
    VALUES (?, ?, ?, ?, ?)
  `).run(subtaskId, 1, role?.id || 0, JSON.stringify(messages), '');

  try {
    const chatResponse: ChatResponse = await provider.chat(messages);
    const output = chatResponse.content;

    await updateAgentStats(role?.id || 0, chatResponse.usage);

    db.prepare(`INSERT INTO outputs (subtask_id, content) VALUES (?, ?)`).run(subtaskId, output);
    db.prepare(`UPDATE execution_logs SET output = ? WHERE id = ?`).run(output, logEntry.lastInsertRowid);

    db.prepare(`UPDATE subtasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);
    logSubtask('Completed', { id: subtaskId, title: subtask.title }, providerName);
  } catch (error) {
    logSubtaskError(error as Error, { id: subtaskId, title: subtask.title, step: 1 }, providerName);
    db.prepare(`UPDATE execution_logs SET output = ? WHERE id = ?`).run(`Error: ${error}`, logEntry.lastInsertRowid);
    db.prepare(`UPDATE subtasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);
  }
}

function parseDecompositionContent(rawContent: string, task: any): Array<{
  title: string;
  description: string;
  role_id: number;
  role_name: string;
  priority: string;
  requested_role: string;
}> {
  const parseJson = (input: string): unknown => JSON.parse(input);

  const candidates: string[] = [rawContent.trim()];
  const fencedJson = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) candidates.push(fencedJson[1].trim());

  const objectMatch = rawContent.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) candidates.push(objectMatch[0]);

  const arrayMatch = rawContent.match(/\[[\s\S]*\]/);
  if (arrayMatch?.[0]) candidates.push(arrayMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = parseJson(candidate);
      if (Array.isArray(parsed)) return normalizeSubtasks(parsed, task);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).subtasks)) {
        return normalizeSubtasks((parsed as any).subtasks, task);
      }
    } catch {
      continue;
    }
  }

  const role = db.prepare('SELECT id, name FROM roles WHERE name = ?').get('backend_developer') as any;
  return [{
    title: task.title,
    description: task.description,
    role_id: role?.id || 0,
    role_name: role?.name || 'backend_developer',
    priority: 'medium',
    requested_role: 'backend_developer',
  }];
}

function normalizeSubtasks(raw: any[], task: any): Array<{
  title: string;
  description: string;
  role_id: number;
  role_name: string;
  priority: string;
  requested_role: string;
}> {
  const availableRoles = db.prepare('SELECT id, name FROM roles').all() as Array<{ id: number; name: string }>;
  const roleByName = new Map(availableRoles.map(r => [r.name, r]));

  const fallbackRole = roleByName.get('backend_developer') ?? roleByName.get('tech_lead') ?? roleByName.get('ceo');
  if (!fallbackRole) throw new Error('No fallback role available');

  const ROLE_ALIASES: Record<string, string> = {
    researcher: 'product_manager', writer: 'frontend_developer', reviewer: 'qa_engineer',
    planner: 'product_manager', frontend: 'frontend_developer', backend: 'backend_developer',
    seo: 'seo_specialist', qa: 'qa_engineer', product: 'product_manager',
  };

  return raw.map((st: any) => {
    const title = typeof st.title === 'string' && st.title.trim() ? st.title.trim() : `Subtask for ${task.title}`;
    const description = typeof st.description === 'string' && st.description.trim() ? st.description.trim() : task.description;

    const requestedRole = typeof st.role === 'string' ? st.role : 'backend_developer';
    let normalizedRole = requestedRole.toLowerCase().replace(/[\s-]+/g, '_');
    normalizedRole = ROLE_ALIASES[normalizedRole] ?? normalizedRole;

    const resolvedRole = roleByName.get(normalizedRole) ?? fallbackRole;
    const priority = ['high', 'medium', 'low'].includes(st.priority) ? st.priority : 'medium';

    return {
      title,
      description,
      role_id: resolvedRole.id,
      role_name: resolvedRole.name,
      priority,
      requested_role: requestedRole,
    };
  });
}

async function getProvider(): Promise<{ provider: any; name: string }> {
  const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
  if (!settings) {
    return { provider: new OllamaProvider('http://localhost:11434', 'llama3'), name: 'ollama' };
  }
  if (settings.provider === 'openai') {
    if (!settings.api_key) {
      return { provider: new OllamaProvider('http://localhost:11434', 'llama3'), name: 'ollama' };
    }
    return { provider: new OpenAIProvider(settings.api_key, settings.model, settings.endpoint), name: 'openai' };
  }
  return { provider: new OllamaProvider(settings.endpoint, settings.model), name: 'ollama' };
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
