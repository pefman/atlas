import { db } from './db';
import { logCEO, logSubtask, logSubtaskError, logSystem } from './lib/logger';
import { execEventBus } from './events';
import { recomputeTaskStatus } from './lib/taskProgress';
import { OllamaProvider } from './ai/ollama';
import { OpenAIProvider } from './ai/openai';
import * as zlib from 'zlib';

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

interface ToolCall {
  tool: string;
  query: string;
  maxResults: number;
}

const MAX_ATTEMPTS = 3;
const DECOMP_MAX_ATTEMPTS = 3;
const MAX_TOOL_ROUNDS = 1;
const DEFAULT_SEARCH_RESULTS = 5;
const MAX_SEARCH_RESULTS = 8;
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
  private replyingThreadIds = new Set<number>();

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
        await this.maybeNotifyCeoReadyForBacklog();
        await this.processAgentInbox();
        await this.processNextBacklog();
      } catch (error) {
        console.error('Scheduler CEO worker error:', error);
      }
    }, 5000);
  }

  private async processAgentInbox(): Promise<void> {
    const pendingThread = db.prepare(`
      SELECT
        mt.*,
        r.name as role_name,
        r.system_prompt,
        r.personality,
        s.status as subtask_status,
        s.title as subtask_title,
        s.description as subtask_description,
        t.title as task_title,
        t.description as task_description,
        p.name as project_name,
        p.folder_path as project_folder_path,
        (
          SELECT MAX(m.created_at)
          FROM messages m
          WHERE m.thread_id = mt.id AND m.sender_type = 'user'
        ) as last_user_message_at,
        (
          SELECT MAX(m.created_at)
          FROM messages m
          WHERE m.thread_id = mt.id AND m.sender_type = 'agent'
        ) as last_agent_message_at
      FROM message_threads mt
      JOIN roles r ON r.id = mt.role_id
      LEFT JOIN subtasks s ON s.id = mt.subtask_id
      LEFT JOIN tasks t ON t.id = mt.task_id
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE mt.status IN ('open', 'awaiting_agent')
        AND mt.created_by = 'user'
        AND (
          mt.subtask_id IS NULL
          OR s.status IN ('done', 'failed', 'review')
        )
        AND EXISTS (
          SELECT 1
          FROM messages m
          WHERE m.thread_id = mt.id AND m.sender_type = 'user'
        )
        AND (
          last_agent_message_at IS NULL
          OR last_user_message_at > last_agent_message_at
        )
      ORDER BY mt.updated_at ASC, mt.id ASC
      LIMIT 1
    `).get() as any;

    if (!pendingThread) {
      return;
    }

    if (this.replyingThreadIds.has(pendingThread.id)) {
      return;
    }

    this.replyingThreadIds.add(pendingThread.id);
    try {
      const threadMessages = db.prepare(`
        SELECT sender_type, content
        FROM messages
        WHERE thread_id = ?
        ORDER BY created_at ASC, id ASC
      `).all(pendingThread.id) as Array<{ sender_type: string; content: string }>;

      const threadContext = [
        `Thread subject: ${pendingThread.subject || 'General conversation'}`,
        pendingThread.project_name ? `Project: ${pendingThread.project_name}` : null,
        pendingThread.project_folder_path ? `Project folder: ${pendingThread.project_folder_path}` : null,
        pendingThread.task_id ? `Task ID: ${pendingThread.task_id}` : null,
        pendingThread.task_title ? `Task title: ${pendingThread.task_title}` : null,
        pendingThread.task_description ? `Task description: ${pendingThread.task_description}` : null,
        pendingThread.subtask_id ? `Subtask ID: ${pendingThread.subtask_id}` : null,
        pendingThread.subtask_title ? `Subtask title: ${pendingThread.subtask_title}` : null,
        pendingThread.subtask_description ? `Subtask description: ${pendingThread.subtask_description}` : null,
      ].filter(Boolean).join('\n');

      const personalityHint = pendingThread.personality
        ? `\n\nYour email style: ${pendingThread.personality}. Let this shape your tone, word choice, and formality in replies.`
        : '';

      const conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content: `${pendingThread.system_prompt || ''}\n\nYou are replying in an internal team chat. Format your reply like a short professional email (greeting, concise body, clear closing line). Keep replies concise, practical, and directly answer the user's latest message.${personalityHint} Never output tool calls, JSON tool payloads, command payloads, or any structured function-calling format; respond with plain text only.`,
        },
        {
          role: 'user',
          content: `Conversation context:\n${threadContext}`,
        },
      ];

      for (const msg of threadMessages) {
        conversation.push({
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }

      const { provider } = await this.getProvider();
      const isAnyToolCallPayload = (output: string): boolean => {
        const text = (output || '').trim();
        if (!text) return false;

        // Catch partial/truncated tool-call payloads that are not valid JSON.
        const lowered = text.toLowerCase();
        if (
          lowered.includes('"type":"tool_call"') ||
          lowered.includes("'type':'tool_call'") ||
          lowered.includes('"tool":"') ||
          lowered.includes("'tool':'") ||
          lowered.includes('"arguments":{') ||
          lowered.includes("'arguments':{") ||
          lowered.includes('{"type":"tool_call"') ||
          lowered.startsWith('{"type":"tool_call"') ||
          lowered.startsWith('{"tool":"')
        ) {
          return true;
        }

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
            const type = String(parsed.type || '').trim();
            const tool = String(parsed.tool || parsed.name || '').trim();
            if (type === 'tool_call' || tool.length > 0) {
              return true;
            }
          } catch {
            continue;
          }
        }

        return false;
      };

      let replyContent = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await provider.chat(conversation);
        await this.updateAgentStats(pendingThread.role_id, response.usage);

        const candidate = (response.content || '').trim();

        if (isAnyToolCallPayload(candidate)) {
          conversation.push({ role: 'assistant', content: candidate });
          conversation.push({
            role: 'user',
            content: 'Do not output tool calls or JSON. Reply directly to the user in plain text only.',
          });
          if (attempt === 0) {
            continue;
          }
          replyContent = 'Hi,\n\nThanks for your message. I can answer directly here in plain text and do not need tool commands for this conversation.\n\nBest regards,';
          break;
        }

        replyContent = candidate;
        break;
      }

      replyContent = replyContent || 'Acknowledged.';

      const messageResult = db.prepare(`
        INSERT INTO messages (thread_id, role_id, sender_type, content, task_id, subtask_id, requires_response, is_read)
        VALUES (?, ?, 'agent', ?, ?, ?, 0, 0)
      `).run(
        pendingThread.id,
        pendingThread.role_id,
        replyContent,
        pendingThread.task_id || null,
        pendingThread.subtask_id || null
      );

      db.prepare(`
        UPDATE message_threads
        SET status = 'open', updated_at = datetime('now')
        WHERE id = ?
      `).run(pendingThread.id);

      const preview = replyContent.length > 180 ? `${replyContent.slice(0, 177)}...` : replyContent;
      db.prepare(`
        INSERT INTO notifications (sender_role, message, task_id, thread_id)
        VALUES (?, ?, ?, ?)
      `).run(pendingThread.role_name || 'agent', preview, pendingThread.task_id || null, pendingThread.id);

      const thread = db.prepare(`
        SELECT mt.*, r.name as role_name
        FROM message_threads mt
        LEFT JOIN roles r ON r.id = mt.role_id
        WHERE mt.id = ?
      `).get(pendingThread.id);
      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageResult.lastInsertRowid as number);

      execEventBus.emit('notification', {
        id: Date.now(),
        sender_role: pendingThread.role_name || 'agent',
        message: preview,
        task_id: pendingThread.task_id || null,
        thread_id: pendingThread.id,
        is_read: 0,
        created_at: new Date().toISOString(),
      });
      execEventBus.emit('message_created', { thread_id: pendingThread.id, message, thread });
      execEventBus.emit('message_updated', { thread_id: pendingThread.id, thread });
    } catch (error) {
      logSystem(`Failed to process agent inbox thread ${pendingThread.id}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.replyingThreadIds.delete(pendingThread.id);
    }
  }

  private async maybeNotifyCeoReadyForBacklog(): Promise<void> {
    const ceoRole = db.prepare('SELECT id, name FROM roles WHERE name = ?').get('ceo') as { id: number; name: string } | undefined;
    if (!ceoRole) {
      return;
    }

    const backlogSummary = db.prepare(`
      SELECT id, title
      FROM tasks
      WHERE status = 'backlog'
      ORDER BY
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 2
        END ASC,
        created_at ASC
      LIMIT 1
    `).get() as { id: number; title: string } | undefined;

    if (!backlogSummary) {
      return;
    }

    const ceoBusy = db.prepare(`
      SELECT 1
      FROM tasks
      WHERE status = 'in_progress' AND ceo_status = 'decomposing'
      LIMIT 1
    `).get() as { 1: number } | undefined;

    if (ceoBusy) {
      return;
    }

    const existingThread = db.prepare(`
      SELECT mt.id
      FROM message_threads mt
      WHERE mt.role_id = ?
        AND mt.subtask_id IS NULL
        AND mt.category = 'general'
        AND mt.created_by = 'agent'
        AND mt.subject = 'CEO ready to start backlog work'
        AND mt.status IN ('open', 'awaiting_user', 'awaiting_agent')
      ORDER BY mt.updated_at DESC, mt.id DESC
      LIMIT 1
    `).get(ceoRole.id) as { id: number } | undefined;

    if (existingThread) {
      return;
    }

    const backlogCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE status = 'backlog'
    `).get() as { count: number };

    const backlogCount = backlogCountRow.count;
    const prompt = `I am ready to work. There ${backlogCount === 1 ? 'is' : 'are'} ${backlogCount} task${backlogCount === 1 ? '' : 's'} in backlog. Should I start "${backlogSummary.title}" now?`;

    const threadResult = db.prepare(`
      INSERT INTO message_threads (role_id, task_id, subtask_id, subject, category, status, created_by)
      VALUES (?, ?, NULL, 'CEO ready to start backlog work', 'general', 'awaiting_user', 'agent')
    `).run(ceoRole.id, backlogSummary.id);

    const threadId = threadResult.lastInsertRowid as number;

    const messageResult = db.prepare(`
      INSERT INTO messages (thread_id, role_id, sender_type, content, task_id, subtask_id, requires_response, is_read)
      VALUES (?, ?, 'agent', ?, ?, NULL, 1, 0)
    `).run(threadId, ceoRole.id, prompt, backlogSummary.id);

    const preview = prompt.length > 180 ? `${prompt.slice(0, 177)}...` : prompt;
    db.prepare(`
      INSERT INTO notifications (sender_role, message, task_id, thread_id)
      VALUES (?, ?, ?, ?)
    `).run(ceoRole.name, preview, backlogSummary.id, threadId);

    const thread = db.prepare(`
      SELECT mt.*, r.name as role_name
      FROM message_threads mt
      LEFT JOIN roles r ON r.id = mt.role_id
      WHERE mt.id = ?
    `).get(threadId);
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageResult.lastInsertRowid as number);

    logCEO('Asked user whether to start backlog task', {
      task_id: backlogSummary.id,
      task_title: backlogSummary.title,
      thread_id: threadId,
      backlog_count: backlogCount,
    });

    execEventBus.emit('notification', {
      id: Date.now(),
      sender_role: ceoRole.name,
      message: preview,
      task_id: backlogSummary.id,
      thread_id: threadId,
      is_read: 0,
      created_at: new Date().toISOString(),
    });
    execEventBus.emit('message_created', { thread_id: threadId, message, thread });
    execEventBus.emit('message_updated', { thread_id: threadId, thread });
  }

  private async processNextBacklog(): Promise<void> {
    const task = db.prepare(`
      SELECT t.*, p.name as project_name, p.folder_path as project_folder_path
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
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

    const projectContext = task.project_name
      ? `\nProject: ${task.project_name}\nProject folder: ${task.project_folder_path || 'n/a'}`
      : '';

    const messages = [
      { role: 'system' as const, content: ceoRole.system_prompt },
      { role: 'user' as const, content: `Task: ${task.title}\n\nDescription: ${task.description}${projectContext}` },
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
    const taskContext = db.prepare(`
      SELECT t.id, t.title, p.name as project_name, p.folder_path as project_folder_path
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = ?
    `).get(subtask.task_id) as any;
    const taskId = subtask.task_id;
    const { provider, name: providerName } = await this.getProvider();

    try {
      db.prepare(`UPDATE subtasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(item.id);
      logSubtask('Started', { id: item.id, title: item.title }, providerName);
      execEventBus.emit('subtask_start', { subtask_id: item.id, task_id: taskId, title: item.title });

      const projectContext = taskContext?.project_name
        ? `\n\nProject: ${taskContext.project_name}\nProject folder: ${taskContext.project_folder_path || 'n/a'}`
        : '';

      let conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system' as const, content: role?.system_prompt || '' },
        { role: 'user' as const, content: `${subtask.description}${projectContext}` },
      ];

      // Append prior conversation from message thread, if any
      const existingThread = db.prepare(`
        SELECT id FROM message_threads
        WHERE subtask_id = ? AND status IN ('awaiting_agent', 'open')
        ORDER BY id DESC
        LIMIT 1
      `).get(item.id) as { id: number } | undefined;

      if (existingThread) {
        const threadMessages = db.prepare(`
          SELECT sender_type, content
          FROM messages
          WHERE thread_id = ?
          ORDER BY created_at ASC, id ASC
        `).all(existingThread.id) as Array<{ sender_type: string; content: string }>;

        for (const msg of threadMessages) {
          conversation.push({
            role: msg.sender_type === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      }

      const logEntry = db.prepare(`
        INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
        VALUES (?, ?, ?, ?, ?)
      `).run(item.id, item.failureCount, role?.id || 0, JSON.stringify(conversation), '');

      let output = '';

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const chatResponse = await provider.chat(conversation);
        await this.updateAgentStats(role?.id || 0, chatResponse.usage);

        const candidate = chatResponse.content;
        const toolCall = this.parseToolCall(candidate);
        if (!toolCall || round >= MAX_TOOL_ROUNDS) {
          output = candidate;
          break;
        }

        const toolResult = await this.executeToolCall(toolCall);
        db.prepare(`
          INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          item.id,
          item.failureCount,
          role?.id || 0,
          JSON.stringify({ tool: toolCall.tool, query: toolCall.query, max_results: toolCall.maxResults }),
          toolResult
        );

        conversation.push({ role: 'assistant', content: candidate });
        conversation.push({
          role: 'user',
          content: `Tool result (search_web):\n${toolResult}\n\nUse this information to complete the subtask.`,
        });
      }

      if (!output) {
        output = 'No output produced.';
      }

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

  private parseToolCall(output: string): ToolCall | null {
    const text = (output || '').trim();
    if (!text) return null;

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
        const tool = String(parsed.tool || parsed.name || '').trim();
        const type = String(parsed.type || '').trim();
        const args = parsed.arguments && typeof parsed.arguments === 'object' ? parsed.arguments : parsed;
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        const requestedMax = Number(args.max_results ?? args.maxResults ?? DEFAULT_SEARCH_RESULTS);
        const maxResults = Number.isFinite(requestedMax)
          ? Math.max(1, Math.min(MAX_SEARCH_RESULTS, Math.floor(requestedMax)))
          : DEFAULT_SEARCH_RESULTS;

        if ((type === 'tool_call' || tool.length > 0) && tool === 'search_web' && query.length > 0) {
          return { tool, query, maxResults };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async executeToolCall(toolCall: ToolCall): Promise<string> {
    if (toolCall.tool !== 'search_web') {
      return JSON.stringify({ error: `Unsupported tool: ${toolCall.tool}` }, null, 2);
    }
    return this.searchWeb(toolCall.query, toolCall.maxResults);
  }

  private async searchWeb(query: string, maxResults: number): Promise<string> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return JSON.stringify({ error: 'Empty query' }, null, 2);
    }

    try {
      const searxResults = await this.searchViaSearxng(normalizedQuery, maxResults);
      return JSON.stringify({ source: 'searxng', query: normalizedQuery, results: searxResults }, null, 2);
    } catch (searxError) {
      try {
        const ddgResults = await this.searchViaDuckDuckGo(normalizedQuery, maxResults);
        return JSON.stringify({ source: 'duckduckgo', query: normalizedQuery, results: ddgResults }, null, 2);
      } catch (ddgError) {
        return JSON.stringify({
          error: 'search_failed',
          query: normalizedQuery,
          searxng: searxError instanceof Error ? searxError.message : String(searxError),
          duckduckgo: ddgError instanceof Error ? ddgError.message : String(ddgError),
        }, null, 2);
      }
    }
  }

  private async searchViaSearxng(query: string, maxResults: number): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const baseUrl = (process.env.SEARXNG_BASE_URL || 'https://searx.be').replace(/\/$/, '');
    const url = `${baseUrl}/search?format=json&language=en&safesearch=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`SearxNG HTTP ${response.status}`);
    }

    const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
    const results = (data.results || [])
      .filter((item) => item.url && item.title)
      .slice(0, maxResults)
      .map((item) => ({
        title: item.title || 'Untitled',
        url: item.url || '',
        snippet: (item.content || '').slice(0, 320),
      }));

    if (results.length === 0) {
      throw new Error('SearxNG returned no results');
    }

    return results;
  }

  private async searchViaDuckDuckGo(query: string, maxResults: number): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DuckDuckGo HTTP ${response.status}`);
    }

    const data = await response.json() as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
    };

    const results: Array<{ title: string; url: string; snippet: string }> = [];
    if (data.AbstractURL && data.AbstractText) {
      results.push({
        title: data.Heading || 'DuckDuckGo Result',
        url: data.AbstractURL,
        snippet: data.AbstractText.slice(0, 320),
      });
    }

    const appendTopic = (topic: { Text?: string; FirstURL?: string }) => {
      if (!topic.FirstURL || !topic.Text) return;
      results.push({
        title: topic.Text.slice(0, 100),
        url: topic.FirstURL,
        snippet: topic.Text.slice(0, 320),
      });
    };

    for (const topic of data.RelatedTopics || []) {
      if (topic.Topics && Array.isArray(topic.Topics)) {
        for (const nested of topic.Topics) {
          appendTopic(nested);
          if (results.length >= maxResults) break;
        }
      } else {
        appendTopic(topic);
      }
      if (results.length >= maxResults) break;
    }

    const limited = results.slice(0, maxResults);
    if (limited.length === 0) {
      throw new Error('DuckDuckGo returned no results');
    }
    return limited;
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

  private async generatePortrait(roleName: string): Promise<string> {
    const { provider } = await this.getProvider();

    const systemPrompt = `Output a 32x32 pixel art grid as a JSON 2D array of hex colors. ${roleName} character portrait. No markdown, no text, just the array.`;

    const userMessage = `Return exactly 32 rows of 32 hex colors each for a pixel art portrait of a ${roleName}. JSON array only.`;

    const response = await provider.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);

    const grid = this.parsePixelGrid(response.content);
    if (!grid) {
      logSystem(`Portrait generation raw response for ${roleName}: ${response.content.substring(0, 500)}`);
      throw new Error('Failed to parse pixel grid from AI response');
    }

    return this.renderPixelGridToBase64(grid);
  }

  private parsePixelGrid(response: string): string[][] | null {
    try {
      // Strip markdown code fences
      let cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logSystem(`parsePixelGrid: no JSON array found in response`);
        return null;
      }

      const grid = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(grid)) {
        logSystem(`parsePixelGrid: not an array`);
        return null;
      }
      
      if (grid.length !== 32) {
        logSystem(`parsePixelGrid: expected 32 rows, got ${grid.length}. Truncating/padding to 32.`);
        if (grid.length > 32) {
          while (grid.length > 32) grid.pop();
        }
        while (grid.length < 32) {
          grid.push(new Array(32).fill('#000000'));
        }
      }

      const result = grid.map((row: any, rowIndex: number) => {
        if (!Array.isArray(row)) {
          logSystem(`parsePixelGrid: row ${rowIndex} is not an array`);
          return new Array(32).fill('#000000');
        }
        let normalizedRow = row;
        if (row.length > 32) {
          normalizedRow = row.slice(0, 32);
        } else if (row.length < 32) {
          normalizedRow = [...row, ...new Array(32 - row.length).fill('#000000')];
        }
        return normalizedRow.map((color: string) => {
          if (color.length === 4) {
            return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
          }
          return color;
        });
      });
      
      return result as string[][];
    } catch (err) {
      logSystem(`parsePixelGrid error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private renderPixelGridToBase64(grid: string[][]): string {
    const SIZE = 32;
    const rawData: number[] = [];

    for (let y = 0; y < SIZE; y++) {
      rawData.push(0);
      for (let x = 0; x < SIZE; x++) {
        const color = grid[y][x];
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        rawData.push(r, g, b);
      }
    }

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(SIZE, 0);
    ihdrData.writeUInt32BE(SIZE, 4);
    ihdrData[8] = 8;
    ihdrData[9] = 2;
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;
    const ihdr = this.makeChunk('IHDR', ihdrData);

    const rawBuffer = Buffer.from(rawData);
    const compressed = zlib.deflateSync(rawBuffer);
    const idat = this.makeChunk('IDAT', compressed);

    const iend = this.makeChunk('IEND', Buffer.alloc(0));

    const png = Buffer.concat([signature, ihdr, idat, iend]);
    return png.toString('base64');
  }

  private makeChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData) >>> 0, 0);
    return Buffer.concat([length, typeBuf, data, crc]);
  }

  async seedPortraits(): Promise<void> {
    const rolesWithoutPortraits = db.prepare(
      "SELECT id, name FROM roles WHERE portrait = ''"
    ).all() as Array<{ id: number; name: string }>;

    if (rolesWithoutPortraits.length === 0) return;

    logSystem(`Generating portraits for ${rolesWithoutPortraits.length} roles...`);

    for (const role of rolesWithoutPortraits) {
      let success = false;
      const maxRetries = 3;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const portrait = await this.generatePortrait(role.name);
          db.prepare('UPDATE roles SET portrait = ? WHERE id = ?').run(portrait, role.id);
          logSystem(`Generated portrait for ${role.name} (attempt ${attempt + 1})`);
          success = true;
          break;
        } catch (err) {
          logSystem(`Portrait attempt ${attempt + 1} for ${role.name} failed: ${err instanceof Error ? err.message : String(err)}`);
          if (attempt < maxRetries - 1) {
            const delay = 5000 * Math.pow(2, attempt);
            logSystem(`Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (!success) {
        logSystem(`All retries exhausted for ${role.name}, leaving portrait empty`);
      }
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

// Minimal CRC32 lookup table
const crc32Table: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crc32Table[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crc32Table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export const scheduler = new Scheduler();
