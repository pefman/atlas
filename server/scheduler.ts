import { db } from './db';
import { logSubtask, logSubtaskError, logSystem } from './lib/logger';
import { execEventBus } from './events';

type Priority = 'high' | 'medium' | 'low';

interface QueuedSubtask {
  id: number;
  title: string;
  priority: Priority;
  failureCount: number;
}

class Scheduler {
  private queues: Map<Priority, QueuedSubtask[]> = new Map();
  private running = false;
  private stopped = false;
  private processing = false;
  private retryTimeout: NodeJS.Timeout | null = null;
  private ceoWorkerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.queues.set('high', []);
    this.queues.set('medium', []);
    this.queues.set('low', []);
  }

  enqueue(subtaskId: number, title: string, priority: Priority, existingFailureCount: number = 0): void {
    const item: QueuedSubtask = {
      id: subtaskId,
      title,
      priority,
      failureCount: existingFailureCount,
    };
    this.queues.get(priority)!.push(item);
    logSubtask('Enqueued', { id: subtaskId, title, priority });

    if (!this.processing) {
      this.processNext();
    }
  }

  dequeue(): QueuedSubtask | null {
    for (const priority of ['high', 'medium', 'low'] as Priority[]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  get pendingCount(): number {
    return ['high', 'medium', 'low'].reduce(
      (sum, p) => sum + this.queues.get(p as Priority).length,
      0
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopped = false;
    this.loadExistingSubtasks();
    this.startCEOWorker();
    logSystem('Scheduler started');
  }

  private loadExistingSubtasks(): void {
    const subtasks = db.prepare(`
      SELECT * FROM subtasks 
      WHERE status = 'backlog'
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
          ELSE 2 
        END ASC,
        created_at ASC
    `).all() as any[];

    for (const subtask of subtasks) {
      this.enqueue(subtask.id, subtask.title, subtask.priority as Priority);
    }
    
    if (subtasks.length > 0) {
      logSystem(`Loaded ${subtasks.length} existing subtasks into queue`);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.ceoWorkerInterval) {
      clearInterval(this.ceoWorkerInterval);
      this.ceoWorkerInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.running = false;
    logSystem('Scheduler stopped');
  }

  private startCEOWorker(): void {
    this.ceoWorkerInterval = setInterval(async () => {
      try {
        await this.processNextBacklog();
      } catch (error) {
        console.error('Scheduler CEO worker error:', error);
      }
    }, 5000);
  }

  private async processNextBacklog(): Promise<void> {
    const task = db.prepare(`
      SELECT * FROM tasks 
      WHERE status = 'in_progress' AND ceo_status = 'idle'
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
          ELSE 2 
        END ASC,
        created_at ASC
      LIMIT 1
    `).get() as any;

    if (!task) return;

    db.prepare(`UPDATE tasks SET ceo_status = 'decomposing', updated_at = datetime('now') WHERE id = ?`).run(task.id);

    const { name: providerName } = await this.getProvider();
    logSystem(`Decomposing task ${task.id}: ${task.title}`);

    const ceoRole = db.prepare('SELECT * FROM roles WHERE name = ?').get('ceo') as any;
    if (!ceoRole) {
      db.prepare(`UPDATE tasks SET ceo_status = 'error', updated_at = datetime('now') WHERE id = ?`).run(task.id);
      return;
    }

    const { provider } = await this.getProvider();
    const messages = [
      { role: 'system' as const, content: ceoRole.system_prompt },
      { role: 'user' as const, content: `Task: ${task.title}\n\nDescription: ${task.description}` },
    ];

    try {
      const response = await provider.chat(messages);
      await this.updateAgentStats(ceoRole.id, response.usage);

      const subtasks = this.parseDecompositionSubtasks(response.content, task);
      for (const st of subtasks) {
        const result = db.prepare(`
          INSERT INTO subtasks (task_id, title, description, role_id, assigned_by, priority)
          VALUES (?, ?, ?, ?, 'ceo', ?)
        `).run(task.id, st.title, st.description, st.role_id, st.priority);

        this.enqueue(result.lastInsertRowid as number, st.title, st.priority as Priority);

        db.prepare(`
          INSERT INTO execution_logs (subtask_id, step, step_type, role_id, input, output)
          VALUES (?, 0, 'assign', ?, ?, ?)
        `).run(
          result.lastInsertRowid,
          ceoRole.id,
          JSON.stringify({ task_title: task.title }),
          `Assigned to ${st.role_name}`
        );

        logSubtask('Assigned', { title: st.title, id: result.lastInsertRowid, role: st.role_name });
      }

      db.prepare(`
        UPDATE tasks SET ceo_status = 'decomposed', decomposed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
      `).run(task.id);

      logSystem(`Decomposed task ${task.id}: ${subtasks.length} subtasks`);
      execEventBus.emit('task_decomposed', { task_id: task.id, subtask_count: subtasks.length });
    } catch (error) {
      logSubtaskError(error as Error, { task_id: task.id, title: task.title }, providerName);
      db.prepare(`UPDATE tasks SET ceo_status = 'error', updated_at = datetime('now') WHERE id = ?`).run(task.id);
    }
  }

  private async processNext(): Promise<void> {
    if (this.stopped) return;

    const item = this.dequeue();
    if (!item) {
      this.processing = false;
      return;
    }

    this.processing = true;
    item.failureCount++;

    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(item.id) as any;
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(subtask?.role_id) as any;
    const taskId = subtask?.task_id;
    const { provider, name: providerName } = await this.getProvider();

    try {
      db.prepare(`UPDATE subtasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(item.id);
      logSubtask('Started', { id: item.id, title: item.title }, providerName);
      execEventBus.emit('subtask_start', { subtask_id: item.id, task_id: subtask.task_id, title: item.title });

      const messages = [
        { role: 'system' as const, content: role?.system_prompt || '' },
        { role: 'user' as const, content: subtask.description },
      ];

      const logEntry = db.prepare(`
        INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
        VALUES (?, ?, ?, ?, ?)
      `).run(item.id, item.failureCount, role?.id || 0, JSON.stringify(messages), '');

      const chatResponse = await provider.chat(messages);
      const output = chatResponse.content;

      await this.updateAgentStats(role?.id || 0, chatResponse.usage);

      db.prepare(`
        INSERT INTO outputs (subtask_id, content)
        VALUES (?, ?)
      `).run(item.id, output);

      db.prepare(`
        UPDATE execution_logs SET output = ? WHERE id = ?
      `).run(output, logEntry.lastInsertRowid);

      db.prepare(`UPDATE subtasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(item.id);
      logSubtask('Completed', { id: item.id, title: item.title }, providerName);
      execEventBus.emit('subtask_complete', { subtask_id: item.id, task_id: subtask.task_id, title: item.title });

      await this.checkTaskCompletion(taskId);
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      logSubtaskError(error as Error, { id: item.id, title: item.title, step: item.failureCount });

      db.prepare(`
        INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
        VALUES (?, ?, ?, '', ?)
      `).run(item.id, item.failureCount, role?.id || 0, errorStr);

      const delay = Math.min(Math.pow(2, item.failureCount) * 1000, 300000); // cap at 5 min
      logSystem(`Retrying subtask ${item.id} in ${delay / 1000}s (attempt ${item.failureCount + 1})`);
      this.retryTimeout = setTimeout(() => {
        this.enqueue(item.id, item.title, item.priority, item.failureCount);
      }, delay);
    }

    this.processing = false;
    if (!this.stopped) {
      this.processNext();
    }
  }

  private async checkTaskCompletion(taskId: number): Promise<void> {
    const pending = db.prepare(`
      SELECT COUNT(*) as count FROM subtasks 
      WHERE task_id = ? AND status NOT IN ('done', 'failed')
    `).get(taskId) as { count: number };

    if (pending.count === 0) {
      db.prepare(`UPDATE tasks SET status = 'done', ceo_status = 'idle', updated_at = datetime('now') WHERE id = ?`).run(taskId);
      logSystem(`Task ${taskId} completed`);
      execEventBus.emit('task_completed', { task_id: taskId });
    }
  }

  private parseDecompositionSubtasks(rawContent: string, task: any): Array<{ title: string; description: string; role_id: number; role_name: string; priority: string }> {
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
        if (Array.isArray(parsed)) return this.normalizeSubtasks(parsed, task);
        if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).subtasks)) {
          return this.normalizeSubtasks((parsed as any).subtasks, task);
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
    }];
  }

  private normalizeSubtasks(raw: any[], task: any): Array<{ title: string; description: string; role_id: number; role_name: string; priority: string }> {
    const availableRoles = db.prepare('SELECT id, name FROM roles').all() as Array<{ id: number; name: string }>;
    const roleByName = new Map(availableRoles.map(r => [r.name, r]));

    const fallbackRole = roleByName.get('backend_developer') ?? roleByName.get('tech_lead') ?? roleByName.get('ceo');

    return raw.map((st: any) => {
      const title = typeof st.title === 'string' && st.title.trim() ? st.title.trim() : `Subtask for ${task.title}`;
      const description = typeof st.description === 'string' && st.description.trim() ? st.description.trim() : task.description;

      let requestedRole = typeof st.role === 'string' ? st.role : 'backend_developer';
      let normalizedRole = requestedRole.toLowerCase().replace(/[\s-]+/g, '_');

      const aliases: Record<string, string> = {
        researcher: 'product_manager', writer: 'frontend_developer', reviewer: 'qa_engineer',
        planner: 'product_manager', frontend: 'frontend_developer', backend: 'backend_developer',
        seo: 'seo_specialist', qa: 'qa_engineer', product: 'product_manager',
      };
      normalizedRole = aliases[normalizedRole] ?? normalizedRole;

      const resolvedRole = roleByName.get(normalizedRole) ?? fallbackRole;
      const priority = ['high', 'medium', 'low'].includes(st.priority) ? st.priority : 'medium';

      return {
        title,
        description,
        role_id: resolvedRole.id,
        role_name: resolvedRole.name,
        priority,
      };
    });
  }

  private async updateAgentStats(roleId: number, usage?: { input: number; output: number }): Promise<void> {
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

  private async getProvider(): Promise<{ provider: any; name: string }> {
    const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
    if (!settings) {
      const { OllamaProvider } = await import('./ai/ollama');
      return { provider: new OllamaProvider('http://localhost:11434', 'llama3'), name: 'ollama' };
    }
    if (settings.provider === 'openai') {
      if (!settings.api_key) {
        const { OllamaProvider } = await import('./ai/ollama');
        return { provider: new OllamaProvider('http://localhost:11434', 'llama3'), name: 'ollama' };
      }
      const { OpenAIProvider } = await import('./ai/openai');
      return { provider: new OpenAIProvider(settings.api_key, settings.model, settings.endpoint), name: 'openai' };
    }
    const { OllamaProvider } = await import('./ai/ollama');
    return { provider: new OllamaProvider(settings.endpoint, settings.model), name: 'ollama' };
  }
}

export const scheduler = new Scheduler();
