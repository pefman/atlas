import { db } from './db';
import { logCEO, logSubtask, logSubtaskError, logSystem } from './lib/logger';
import { execEventBus } from './events';
import { recomputeTaskStatus } from './lib/taskProgress';
import { OllamaProvider } from './ai/ollama';
import { OpenAIProvider } from './ai/openai';

type Priority = 'high' | 'medium' | 'low';

interface QueuedSubtask {
  id: number;
  title: string;
  priority: Priority;
  failureCount: number;
}

interface ClarificationDecision {
  needed: boolean;
  content: string;
}

interface ClarificationPayload {
  needed: boolean;
  questions: string[];
  reason?: string;
}

const MAX_ATTEMPTS = 3;
const DECOMP_MAX_ATTEMPTS = 3;
const CEO_ASSIGNABLE_ROLES = [
  'product_manager',
  'tech_lead',
  'frontend_developer',
  'backend_developer',
  'qa_engineer',
  'seo_specialist',
] as const;

class Scheduler {
  private queues: Map<Priority, QueuedSubtask[]> = new Map();
  private running = false;
  private stopped = false;
  private draining = false;
  private retryTimers = new Map<number, NodeJS.Timeout>();
  private ceoWorkerInterval: NodeJS.Timeout | null = null;
  private ceoAttempts = new Map<number, number>();

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

    void this.drain();
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

  removeTask(taskId: number): void {
    for (const priority of ['high', 'medium', 'low'] as Priority[]) {
      const queue = this.queues.get(priority)!;
      const initialLength = queue.length;
      const filtered = queue.filter(item => {
        const subtask = db.prepare('SELECT task_id FROM subtasks WHERE id = ?').get(item.id) as { task_id: number } | undefined;
        return subtask?.task_id !== taskId;
      });
      this.queues.set(priority, filtered);
      const removed = initialLength - filtered.length;
      if (removed > 0) {
        logSystem(`Removed ${removed} queued item(s) for task ${taskId}`);
      }
    }

    for (const [subtaskId, timer] of this.retryTimers) {
      const subtask = db.prepare('SELECT task_id FROM subtasks WHERE id = ?').get(subtaskId) as { task_id: number } | undefined;
      if (subtask?.task_id === taskId) {
        clearTimeout(timer);
        this.retryTimers.delete(subtaskId);
        logSystem(`Cleared retry timer for subtask ${subtaskId} (task ${taskId} deleted)`);
      }
    }
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
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
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

    const attempts = this.ceoAttempts.get(task.id) || 0;
    if (attempts >= DECOMP_MAX_ATTEMPTS) {
      logCEO(`Task ${task.id} exceeded max decomposition attempts (${DECOMP_MAX_ATTEMPTS})`, {});
      db.prepare(`UPDATE tasks SET ceo_status = 'error', updated_at = datetime('now') WHERE id = ?`).run(task.id);
      return;
    }

    db.prepare(`UPDATE tasks SET ceo_status = 'decomposing', updated_at = datetime('now') WHERE id = ?`).run(task.id);
    this.ceoAttempts.set(task.id, attempts + 1);
    execEventBus.emit('task_decomposing', { task_id: task.id });

    const { provider, name: providerName } = await this.getProvider();
    logCEO(`Decomposing task ${task.id}: ${task.title}`, {});

    const ceoRole = db.prepare('SELECT * FROM roles WHERE name = ?').get('ceo') as any;
    if (!ceoRole) {
      db.prepare(`UPDATE tasks SET ceo_status = 'error', updated_at = datetime('now') WHERE id = ?`).run(task.id);
      return;
    }

    const messages = [
      { role: 'system' as const, content: ceoRole.system_prompt },
      { role: 'user' as const, content: `Task: ${task.title}\n\nDescription: ${task.description}` },
    ];

    try {
      const response = await provider.chat(messages);
      await this.updateAgentStats(ceoRole.id, response.usage);

      const clarification = this.detectClarificationRequest(response.content);
      if (clarification.needed) {
        await this.createTaskClarificationRequest({
          task,
          role: ceoRole,
          clarificationText: clarification.content,
        });

        db.prepare(`
          UPDATE tasks
          SET status = 'review', ceo_status = 'idle', updated_at = datetime('now')
          WHERE id = ?
        `).run(task.id);
        execEventBus.emit('task_status_changed', { task_id: task.id, new_status: 'review' });
        logCEO(`Paused task ${task.id} for user clarification`, {});
        return;
      }

      let subtasks: Array<{ title: string; description: string; role_id: number; role_name: string; priority: string }>;
      try {
        subtasks = this.parseDecompositionSubtasks(response.content, task);
      } catch (error) {
        const clarificationText = this.buildDecompositionClarification(error);
        if (clarificationText) {
          await this.createTaskClarificationRequest({
            task,
            role: ceoRole,
            clarificationText,
          });

          db.prepare(`
            UPDATE tasks
            SET status = 'review', ceo_status = 'idle', updated_at = datetime('now')
            WHERE id = ?
          `).run(task.id);
          execEventBus.emit('task_status_changed', { task_id: task.id, new_status: 'review' });
          logCEO(`Paused task ${task.id} due to invalid decomposition output`, {});
          return;
        }
        throw error;
      }

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

      logCEO(`Decomposed task ${task.id}: ${subtasks.length} subtasks`, {});
      execEventBus.emit('task_decomposed', { task_id: task.id, subtask_count: subtasks.length });
    } catch (error) {
      logSubtaskError(error as Error, { task_id: task.id, title: task.title }, providerName);
      
      const newAttempts = this.ceoAttempts.get(task.id) || 0;
      if (newAttempts < DECOMP_MAX_ATTEMPTS) {
        const delay = Math.min(Math.pow(2, newAttempts) * 1000, 30000);
        logCEO(`Auto-retrying decomposition for task ${task.id} in ${delay / 1000}s (attempt ${newAttempts + 1}/${DECOMP_MAX_ATTEMPTS})`, {});
        setTimeout(() => {
          this.ceoAttempts.set(task.id, newAttempts + 1);
          void this.processNextBacklog();
        }, delay);
      } else {
        db.prepare(`UPDATE tasks SET ceo_status = 'error', updated_at = datetime('now') WHERE id = ?`).run(task.id);
      }
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (!this.stopped) {
        const item = this.dequeue();
        if (!item) break;
        await this.executeItem(item);
      }
    } finally {
      this.draining = false;
    }
  }

  private async executeItem(item: QueuedSubtask): Promise<void> {
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(item.id) as any;
    
    if (!subtask) {
      logSystem(`Subtask ${item.id} no longer exists (deleted), skipping`);
      return;
    }

    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(subtask.role_id) as any;
    const taskId = subtask.task_id;
    const { provider, name: providerName } = await this.getProvider();

    try {
      db.prepare(`UPDATE subtasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(item.id);
      logSubtask('Started', { id: item.id, title: item.title }, providerName);
      execEventBus.emit('subtask_start', { subtask_id: item.id, task_id: taskId, title: item.title });

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

      const clarification = this.detectClarificationRequest(output);

      if (clarification.needed) {
        await this.createClarificationRequest({
          subtask,
          role,
          clarificationText: clarification.content,
        });

        db.prepare(`
          UPDATE execution_logs SET output = ? WHERE id = ?
        `).run(clarification.content, logEntry.lastInsertRowid);

        db.prepare(`
          INSERT INTO outputs (subtask_id, content)
          VALUES (?, ?)
        `).run(item.id, clarification.content);

        db.prepare(`UPDATE subtasks SET status = 'review', updated_at = datetime('now') WHERE id = ?`).run(item.id);
        execEventBus.emit('subtask_status_changed', { subtask_id: item.id, task_id: taskId, new_status: 'review' });
        logSubtask('Paused for user clarification', { id: item.id, title: item.title }, providerName);
        return;
      }

      db.prepare(`
        INSERT INTO outputs (subtask_id, content)
        VALUES (?, ?)
      `).run(item.id, output);

      db.prepare(`
        UPDATE execution_logs SET output = ? WHERE id = ?
      `).run(output, logEntry.lastInsertRowid);

      db.prepare(`UPDATE subtasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(item.id);
      logSubtask('Completed', { id: item.id, title: item.title }, providerName);
      execEventBus.emit('subtask_complete', { subtask_id: item.id, task_id: taskId, title: item.title });

      const { newStatus } = recomputeTaskStatus(taskId);
      logSystem(`Task ${taskId} status: ${newStatus}`);
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      logSubtaskError(error as Error, { id: item.id, title: item.title, step: item.failureCount });

      db.prepare(`
        INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
        VALUES (?, ?, ?, '', ?)
      `).run(item.id, item.failureCount, role?.id || 0, errorStr);

      if (item.failureCount >= MAX_ATTEMPTS - 1) {
        db.prepare(`UPDATE subtasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(item.id);
        logSubtask('Failed permanently', { id: item.id, title: item.title });
        execEventBus.emit('subtask_failed', { subtask_id: item.id, task_id: taskId, title: item.title });
        
        const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId) as { title: string } | undefined;
        const notification = {
          sender_role: 'system',
          message: `Subtask "${item.title}" failed after ${MAX_ATTEMPTS} attempts`,
          task_id: taskId,
        };
        db.prepare(`INSERT INTO notifications (sender_role, message, task_id) VALUES (?, ?, ?)`).run(notification.sender_role, notification.message, notification.task_id);
        execEventBus.emit('notification', { ...notification, id: Date.now(), is_read: false, created_at: new Date().toISOString() });
        
        const { newStatus } = recomputeTaskStatus(taskId);
        logSystem(`Task ${taskId} status: ${newStatus} (subtask failed)`);
      } else {
        item.failureCount++;
        const delay = Math.min(Math.pow(2, item.failureCount) * 1000, 300000);
        logSystem(`Retrying subtask ${item.id} in ${delay / 1000}s (attempt ${item.failureCount + 1}/${MAX_ATTEMPTS})`);
        
        const timer = setTimeout(() => {
          this.enqueue(item.id, item.title, item.priority, item.failureCount);
          this.retryTimers.delete(item.id);
        }, delay);
        
        this.retryTimers.set(item.id, timer);
      }
    }
  }

  private detectClarificationRequest(output: string): ClarificationDecision {
    const text = (output || '').trim();
    if (!text) {
      return { needed: false, content: output };
    }

    if (/^CLARIFICATION_NEEDED\b/i.test(text)) {
      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
      const reasonLine = lines.find((line) => /^reason\s*:/i.test(line));
      const reason = reasonLine ? reasonLine.replace(/^reason\s*:/i, '').trim() : undefined;
      const questions = lines
        .filter((line) => /^[-*]\s+/.test(line))
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter((line) => line.length > 0)
        .slice(0, 3);
      const fallbackQuestions = questions.length > 0 ? questions : ['Can you clarify the missing context for this task?'];
      const payload = {
        type: 'clarification_request',
        needs_clarification: true,
        reason: reason || 'Missing context',
        questions: fallbackQuestions,
        missing_fields: [],
      };
      return { needed: true, content: JSON.stringify(payload, null, 2) };
    }

    const payload = this.parseClarificationPayload(text);
    if (payload.needed) {
      const normalizedPayload = {
        type: 'clarification_request',
        needs_clarification: true,
        reason: payload.reason || 'Missing context',
        questions: payload.questions.slice(0, 3),
        missing_fields: [],
      };
      return { needed: true, content: JSON.stringify(normalizedPayload, null, 2) };
    }

    return { needed: false, content: output };
  }

  private parseClarificationPayload(text: string): ClarificationPayload {
    const candidates: string[] = [text];
    const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedJson?.[1]) {
      candidates.push(fencedJson[1].trim());
    }

    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      candidates.push(objectMatch[0]);
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as Record<string, any>;
        const needed = Boolean(
          parsed.needs_clarification === true ||
          parsed.clarification_needed === true ||
          parsed.type === 'clarification' ||
          parsed.intent === 'clarification'
        );

        if (!needed) {
          continue;
        }

        const rawQuestions = Array.isArray(parsed.questions)
          ? parsed.questions
          : Array.isArray(parsed.clarifying_questions)
            ? parsed.clarifying_questions
            : typeof parsed.question === 'string'
              ? [parsed.question]
              : [];

        const questions = rawQuestions
          .filter((q: unknown) => typeof q === 'string')
          .map((q: string) => q.trim())
          .filter((q: string) => q.length > 0);

        const reason = [parsed.reason, parsed.missing_context, parsed.context_gap]
          .find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined;

        if (questions.length > 0) {
          return { needed: true, questions, reason: reason?.trim() };
        }
      } catch {
        continue;
      }
    }

    return { needed: false, questions: [] };
  }

  private async createClarificationRequest(args: { subtask: any; role: any; clarificationText: string }): Promise<void> {
    const { subtask, role, clarificationText } = args;

    const roleId = subtask.role_id;
    const roleName = role?.name || (db.prepare('SELECT name FROM roles WHERE id = ?').get(roleId) as { name?: string } | undefined)?.name || 'agent';

    const existingThread = db.prepare(`
      SELECT id
      FROM message_threads
      WHERE subtask_id = ? AND role_id = ? AND status IN ('open', 'awaiting_user', 'awaiting_agent')
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(subtask.id, roleId) as { id: number } | undefined;

    let threadId: number;

    if (existingThread) {
      threadId = existingThread.id;
      db.prepare(`
        UPDATE message_threads
        SET status = 'awaiting_user', updated_at = datetime('now')
        WHERE id = ?
      `).run(threadId);
    } else {
      const threadResult = db.prepare(`
        INSERT INTO message_threads (role_id, task_id, subtask_id, subject, category, status, created_by)
        VALUES (?, ?, ?, ?, 'clarification', 'awaiting_user', 'agent')
      `).run(
        roleId,
        subtask.task_id,
        subtask.id,
        `Clarification needed: ${subtask.title}`
      );
      threadId = threadResult.lastInsertRowid as number;
    }

    const messageResult = db.prepare(`
      INSERT INTO messages (thread_id, role_id, sender_type, content, task_id, subtask_id, requires_response, is_read)
      VALUES (?, ?, 'agent', ?, ?, ?, 1, 0)
    `).run(
      threadId,
      roleId,
      clarificationText,
      subtask.task_id,
      subtask.id
    );

    const preview = clarificationText.length > 180 ? `${clarificationText.slice(0, 177)}...` : clarificationText;
    db.prepare(`
      INSERT INTO notifications (sender_role, message, task_id, thread_id)
      VALUES (?, ?, ?, ?)
    `).run(roleName, preview, subtask.task_id, threadId);

    const thread = db.prepare(`
      SELECT mt.*, r.name as role_name
      FROM message_threads mt
      LEFT JOIN roles r ON r.id = mt.role_id
      WHERE mt.id = ?
    `).get(threadId);
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageResult.lastInsertRowid as number);

    execEventBus.emit('notification', {
      id: Date.now(),
      sender_role: roleName,
      message: preview,
      task_id: subtask.task_id,
      thread_id: threadId,
      is_read: 0,
      created_at: new Date().toISOString(),
    });
    execEventBus.emit('message_created', { thread_id: threadId, message, thread });
    execEventBus.emit('message_updated', { thread_id: threadId, thread });
  }

  private async createTaskClarificationRequest(args: { task: any; role: any; clarificationText: string }): Promise<void> {
    const { task, role, clarificationText } = args;
    const roleId = role?.id;
    const roleName = role?.name || 'ceo';

    const existingThread = db.prepare(`
      SELECT id
      FROM message_threads
      WHERE task_id = ? AND role_id = ? AND subtask_id IS NULL AND status IN ('open', 'awaiting_user', 'awaiting_agent')
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(task.id, roleId) as { id: number } | undefined;

    let threadId: number;
    if (existingThread) {
      threadId = existingThread.id;
      db.prepare(`
        UPDATE message_threads
        SET status = 'awaiting_user', updated_at = datetime('now')
        WHERE id = ?
      `).run(threadId);
    } else {
      const threadResult = db.prepare(`
        INSERT INTO message_threads (role_id, task_id, subtask_id, subject, category, status, created_by)
        VALUES (?, ?, NULL, ?, 'clarification', 'awaiting_user', 'agent')
      `).run(roleId, task.id, `Clarification needed before decomposition: ${task.title}`);
      threadId = threadResult.lastInsertRowid as number;
    }

    const messageResult = db.prepare(`
      INSERT INTO messages (thread_id, role_id, sender_type, content, task_id, subtask_id, requires_response, is_read)
      VALUES (?, ?, 'agent', ?, ?, NULL, 1, 0)
    `).run(threadId, roleId, clarificationText, task.id);

    const preview = clarificationText.length > 180 ? `${clarificationText.slice(0, 177)}...` : clarificationText;
    db.prepare(`
      INSERT INTO notifications (sender_role, message, task_id, thread_id)
      VALUES (?, ?, ?, ?)
    `).run(roleName, preview, task.id, threadId);

    const thread = db.prepare(`
      SELECT mt.*, r.name as role_name
      FROM message_threads mt
      LEFT JOIN roles r ON r.id = mt.role_id
      WHERE mt.id = ?
    `).get(threadId);
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageResult.lastInsertRowid as number);

    execEventBus.emit('notification', {
      id: Date.now(),
      sender_role: roleName,
      message: preview,
      task_id: task.id,
      thread_id: threadId,
      is_read: 0,
      created_at: new Date().toISOString(),
    });
    execEventBus.emit('message_created', { thread_id: threadId, message, thread });
    execEventBus.emit('message_updated', { thread_id: threadId, thread });
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

    throw new Error('INVALID_DECOMPOSITION_FORMAT');
  }

  private normalizeSubtasks(raw: any[], task: any): Array<{ title: string; description: string; role_id: number; role_name: string; priority: string }> {
    const availableRoles = db.prepare('SELECT id, name FROM roles').all() as Array<{ id: number; name: string }>;
    const roleByName = new Map(availableRoles.map(r => [r.name, r]));

    const invalidRoles = new Set<string>();
    const missingConfiguredRoles = new Set<string>();

    const normalized = raw.map((st: any) => {
      const title = typeof st.title === 'string' && st.title.trim() ? st.title.trim() : `Subtask for ${task.title}`;
      const description = typeof st.description === 'string' && st.description.trim() ? st.description.trim() : task.description;

      const requestedRole = typeof st.role === 'string' ? st.role : '';
      const normalizedRole = requestedRole.toLowerCase().replace(/[\s-]+/g, '_');

      if (!CEO_ASSIGNABLE_ROLES.includes(normalizedRole as typeof CEO_ASSIGNABLE_ROLES[number])) {
        invalidRoles.add(normalizedRole || '(empty)');
      }

      const resolvedRole = roleByName.get(normalizedRole);
      if (!resolvedRole) {
        missingConfiguredRoles.add(normalizedRole || '(empty)');
      }

      const priority = ['high', 'medium', 'low'].includes(st.priority) ? st.priority : 'medium';

      return {
        title,
        description,
        role_id: resolvedRole?.id || 0,
        role_name: resolvedRole?.name || normalizedRole,
        priority,
      };
    });

    if (invalidRoles.size > 0) {
      throw new Error(`INVALID_ROLE_ASSIGNMENT:${Array.from(invalidRoles).join(',')}`);
    }

    if (missingConfiguredRoles.size > 0) {
      throw new Error(`MISSING_ROLE_CONFIGURATION:${Array.from(missingConfiguredRoles).join(',')}`);
    }

    return normalized;
  }

  private buildDecompositionClarification(error: unknown): string | null {
    const message = error instanceof Error ? error.message : String(error);
    const allowed = CEO_ASSIGNABLE_ROLES.join(', ');

    if (message.startsWith('INVALID_ROLE_ASSIGNMENT:')) {
      const invalid = message.replace('INVALID_ROLE_ASSIGNMENT:', '').split(',').filter(Boolean);
      return JSON.stringify({
        type: 'clarification_request',
        needs_clarification: true,
        reason: `Decomposition used unsupported role names: ${invalid.join(', ')}`,
        questions: [
          `Please re-send subtasks using only these role values: ${allowed}`,
        ],
        missing_fields: ['role'],
      }, null, 2);
    }

    if (message.startsWith('MISSING_ROLE_CONFIGURATION:')) {
      const missing = message.replace('MISSING_ROLE_CONFIGURATION:', '').split(',').filter(Boolean);
      return JSON.stringify({
        type: 'clarification_request',
        needs_clarification: true,
        reason: `Role configuration is missing for: ${missing.join(', ')}`,
        questions: [
          `Please pick roles only from the configured library: ${allowed}`,
        ],
        missing_fields: ['role'],
      }, null, 2);
    }

    if (message === 'INVALID_DECOMPOSITION_FORMAT') {
      return JSON.stringify({
        type: 'clarification_request',
        needs_clarification: true,
        reason: 'Decomposition output was not valid JSON in the required subtasks format.',
        questions: [
          'Please return only valid JSON with a root object containing a subtasks array.',
        ],
        missing_fields: ['subtasks'],
      }, null, 2);
    }

    return null;
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
}

export const scheduler = new Scheduler();
