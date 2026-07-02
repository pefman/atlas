import { Router, Request, Response } from 'express';
import { db } from '../db';
import { execEventBus } from '../events';
import { scheduler } from '../scheduler';
import { logCEO } from '../lib/logger';

const router = Router();

type SenderType = 'user' | 'agent' | 'system';

const CEO_START_TASK_COMMAND = '__CEO_START_TASK__';
const CEO_DECLINE_TASK_COMMAND = '__CEO_DECLINE_TASK__';

function markAgentEmailActivity(roleId: number): void {
  db.prepare(`
    INSERT INTO agent_email_activity (role_id, last_user_message_at, updated_at)
    VALUES (?, datetime('now'), datetime('now'))
    ON CONFLICT(role_id) DO UPDATE SET
      last_user_message_at = datetime('now'),
      updated_at = datetime('now')
  `).run(roleId);
}

function isAffirmativeReply(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) return false;

  const negativeHints = ['no', 'not now', 'dont', "don't", 'later', 'wait', 'stop'];
  if (negativeHints.some((hint) => normalized.includes(hint))) {
    return false;
  }

  return [
    /^y(es)?\b/.test(normalized),
    /^ok(ay)?\b/.test(normalized),
    /^sure\b/.test(normalized),
    /\b(go ahead|start|proceed|do it|begin)\b/.test(normalized),
  ].some(Boolean);
}

function threadRow(threadId: number) {
  return db.prepare(`
    SELECT
      mt.*,
      r.name as role_name,
      (
        SELECT m.content
        FROM messages m
        WHERE m.thread_id = mt.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) as last_message,
      (
        SELECT m.created_at
        FROM messages m
        WHERE m.thread_id = mt.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) as last_message_at,
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.thread_id = mt.id AND m.sender_type = 'agent' AND m.is_read = 0
      ) as unread_agent_messages
    FROM message_threads mt
    LEFT JOIN roles r ON r.id = mt.role_id
    WHERE mt.id = ?
  `).get(threadId) as any;
}

function validateRoleTaskLink(roleId: number, taskId?: number, subtaskId?: number): { valid: boolean; error?: string } {
  if (!taskId && !subtaskId) {
    return { valid: true };
  }

  if (subtaskId) {
    const subtask = db.prepare('SELECT id, task_id, role_id FROM subtasks WHERE id = ?').get(subtaskId) as any;
    if (!subtask) {
      return { valid: false, error: 'Subtask not found' };
    }
    if (subtask.role_id !== roleId) {
      return { valid: false, error: 'Selected subtask is not assigned to this agent' };
    }
    if (taskId && subtask.task_id !== taskId) {
      return { valid: false, error: 'Subtask does not belong to selected task' };
    }
    return { valid: true };
  }

  const exists = db.prepare(`
    SELECT 1
    FROM subtasks
    WHERE role_id = ? AND task_id = ?
    LIMIT 1
  `).get(roleId, taskId) as any;

  if (!exists) {
    return { valid: false, error: 'Selected task has no work assigned to this agent' };
  }

  return { valid: true };
}

// GET /api/messages/threads
router.get('/threads', (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';

  const threads = db.prepare(`
    SELECT
      mt.*,
      r.name as role_name,
      (
        SELECT m.content
        FROM messages m
        WHERE m.thread_id = mt.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) as last_message,
      (
        SELECT m.created_at
        FROM messages m
        WHERE m.thread_id = mt.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) as last_message_at,
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.thread_id = mt.id AND m.sender_type = 'agent' AND m.is_read = 0
      ) as unread_agent_messages
    FROM message_threads mt
    LEFT JOIN roles r ON r.id = mt.role_id
    WHERE (? = '' OR mt.status = ?)
      AND (? = '' OR mt.category = ?)
    ORDER BY COALESCE(last_message_at, mt.updated_at) DESC, mt.id DESC
    LIMIT 100
  `).all(status, status, category, category);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM messages
    WHERE sender_type = 'agent' AND is_read = 0
  `).get() as { count: number };

  res.json({ threads, unreadCount: unreadCount.count });
});

// GET /api/messages/threads/:id
router.get('/threads/:id', (req: Request, res: Response) => {
  const threadId = parseInt(req.params.id);
  const thread = threadRow(threadId);

  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  const messages = db.prepare(`
    SELECT
      m.*,
      r.name as role_name,
      t.title as task_title,
      s.title as subtask_title
    FROM messages m
    LEFT JOIN roles r ON r.id = m.role_id
    LEFT JOIN tasks t ON t.id = m.task_id
    LEFT JOIN subtasks s ON s.id = m.subtask_id
    WHERE m.thread_id = ?
    ORDER BY m.created_at ASC, m.id ASC
  `).all(threadId);

  res.json({ thread, messages });
});

// POST /api/messages/threads
router.post('/threads', (req: Request, res: Response) => {
  const { role_id, subject, content, task_id, subtask_id, requires_response, category } = req.body;

  if (!role_id || !content) {
    res.status(400).json({ error: 'role_id and content are required' });
    return;
  }

  const role = db.prepare('SELECT id, name FROM roles WHERE id = ?').get(role_id) as any;
  if (!role) {
    res.status(400).json({ error: 'Invalid role_id' });
    return;
  }

  const validation = validateRoleTaskLink(role.id, task_id, subtask_id);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const normalizedCategory = category === 'clarification' ? 'clarification' : 'general';

  const threadResult = db.prepare(`
    INSERT INTO message_threads (role_id, task_id, subtask_id, subject, category, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'open', 'user')
  `).run(role.id, task_id || null, subtask_id || null, subject || null, normalizedCategory);

  const threadId = threadResult.lastInsertRowid as number;

  const messageResult = db.prepare(`
    INSERT INTO messages (thread_id, role_id, sender_type, content, task_id, subtask_id, requires_response)
    VALUES (?, ?, 'user', ?, ?, ?, ?)
  `).run(threadId, role.id, content, task_id || null, subtask_id || null, requires_response ? 1 : 0);

  db.prepare(`
    UPDATE message_threads
    SET updated_at = datetime('now')
    WHERE id = ?
  `).run(threadId);

  markAgentEmailActivity(role.id);

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageResult.lastInsertRowid as number);
  const thread = threadRow(threadId);

  execEventBus.emit('message_created', { thread_id: threadId, message, thread });

  res.status(201).json({ thread, message });
});

// POST /api/messages/threads/:id/reply
router.post('/threads/:id/reply', (req: Request, res: Response) => {
  const threadId = parseInt(req.params.id);
  const { sender_type, role_id, content, requires_response } = req.body as {
    sender_type?: SenderType;
    role_id?: number;
    content?: string;
    requires_response?: boolean;
  };

  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const thread = db.prepare('SELECT * FROM message_threads WHERE id = ?').get(threadId) as any;
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  const senderType = sender_type || 'user';
  let senderRoleId: number | null = null;
  if (senderType === 'agent') {
    senderRoleId = role_id || thread.role_id;
    const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(senderRoleId) as any;
    if (!role) {
      res.status(400).json({ error: 'Invalid role_id for agent message' });
      return;
    }
  } else if (senderType === 'user') {
    senderRoleId = thread.role_id;
    markAgentEmailActivity(thread.role_id);
  }

  const isCeoReadyThread =
    senderType === 'user' &&
    !thread.subtask_id &&
    !!thread.task_id &&
    thread.created_by === 'agent' &&
    thread.subject === 'CEO ready to start backlog work';

  const rawContent = content;
  let storedContent = content;
  if (isCeoReadyThread && rawContent === CEO_START_TASK_COMMAND) {
    storedContent = 'Yes, start the task.';
  }
  if (isCeoReadyThread && rawContent === CEO_DECLINE_TASK_COMMAND) {
    storedContent = 'No, do not start yet.';
  }

  const result = db.prepare(`
    INSERT INTO messages (thread_id, role_id, sender_type, content, task_id, subtask_id, requires_response)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    threadId,
    senderRoleId,
    senderType,
    storedContent,
    thread.task_id || null,
    thread.subtask_id || null,
    requires_response ? 1 : 0
  );

  let nextStatus = senderType === 'user' && thread.status === 'awaiting_user'
    ? 'awaiting_agent'
    : 'open';

  if (senderType === 'user' && thread.subtask_id && thread.status === 'awaiting_user') {
    const subtask = db.prepare('SELECT id, title, priority, status, task_id FROM subtasks WHERE id = ?').get(thread.subtask_id) as any;
    if (subtask && subtask.status === 'review') {
      db.prepare(`
        UPDATE subtasks SET status = 'backlog', updated_at = datetime('now') WHERE id = ?
      `).run(subtask.id);
      execEventBus.emit('subtask_status_changed', { subtask_id: subtask.id, task_id: subtask.task_id, new_status: 'backlog' });
      scheduler.enqueue(subtask.id, subtask.title, (subtask.priority || 'medium') as 'high' | 'medium' | 'low', 0);
    }
  }

  if (senderType === 'user' && !thread.subtask_id && thread.task_id && thread.status === 'awaiting_user') {
    const task = db.prepare('SELECT id, status, ceo_status FROM tasks WHERE id = ?').get(thread.task_id) as any;
    if (task) {
      const nextTaskStatus = task.status === 'review' ? 'in_progress' : task.status;
      db.prepare(`
        UPDATE tasks SET status = ?, ceo_status = 'idle', updated_at = datetime('now') WHERE id = ?
      `).run(nextTaskStatus, task.id);
      execEventBus.emit('task_status_changed', { task_id: task.id, new_status: nextTaskStatus });
    }
  }

  if (isCeoReadyThread && (rawContent === CEO_START_TASK_COMMAND || rawContent === CEO_DECLINE_TASK_COMMAND || isAffirmativeReply(rawContent))) {
    const wantsStart = rawContent === CEO_START_TASK_COMMAND || isAffirmativeReply(rawContent);

    if (wantsStart) {
      const startResult = db.prepare(`
      UPDATE tasks
      SET status = 'in_progress', ceo_status = 'idle', updated_at = datetime('now')
      WHERE id = ? AND status = 'backlog'
    `).run(thread.task_id);

      if (startResult.changes > 0) {
        execEventBus.emit('task_status_changed', { task_id: thread.task_id, new_status: 'in_progress' });
        logCEO('User approved CEO backlog start prompt', {
          task_id: thread.task_id,
          thread_id: threadId,
          decision: 'start',
          source: rawContent === CEO_START_TASK_COMMAND ? 'quick_action' : 'text_reply',
        });
      } else {
        logCEO('User approved backlog start but task was not startable', {
          task_id: thread.task_id,
          thread_id: threadId,
          decision: 'start',
          source: rawContent === CEO_START_TASK_COMMAND ? 'quick_action' : 'text_reply',
        });
      }
    } else {
      logCEO('User declined CEO backlog start prompt', {
        task_id: thread.task_id,
        thread_id: threadId,
        decision: 'decline',
        source: rawContent === CEO_DECLINE_TASK_COMMAND ? 'quick_action' : 'text_reply',
      });
    }

    nextStatus = 'resolved';
  }

  db.prepare(`
    UPDATE message_threads
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nextStatus, threadId);

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid as number);
  const updatedThread = threadRow(threadId);

  if (senderType === 'agent') {
    const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(senderRoleId) as { name: string } | undefined;
    const preview = content.length > 180 ? `${content.slice(0, 177)}...` : content;
    db.prepare(`
      INSERT INTO notifications (sender_role, message, task_id, thread_id)
      VALUES (?, ?, ?, ?)
    `).run(role?.name || 'agent', preview, thread.task_id || null, threadId);
    execEventBus.emit('notification', {
      id: Date.now(),
      sender_role: role?.name || 'agent',
      message: preview,
      task_id: thread.task_id || null,
      thread_id: threadId,
      is_read: 0,
      created_at: new Date().toISOString(),
    });
  }

  execEventBus.emit('message_created', { thread_id: threadId, message, thread: updatedThread });

  res.status(201).json({ message, thread: updatedThread });
});

// PATCH /api/messages/threads/:id/status
router.patch('/threads/:id/status', (req: Request, res: Response) => {
  const threadId = parseInt(req.params.id);
  const { status } = req.body as { status?: string };
  const validStatuses = ['open', 'awaiting_user', 'awaiting_agent', 'resolved'];

  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const result = db.prepare(`
    UPDATE message_threads
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, threadId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  const thread = threadRow(threadId);
  execEventBus.emit('message_updated', { thread_id: threadId, thread });

  res.json({ success: true, thread });
});

// DELETE /api/messages/threads/:id
router.delete('/threads/:id', (req: Request, res: Response) => {
  const threadId = parseInt(req.params.id);
  const thread = db.prepare('SELECT id FROM message_threads WHERE id = ?').get(threadId) as { id: number } | undefined;

  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  db.prepare('DELETE FROM notifications WHERE thread_id = ?').run(threadId);
  db.prepare('DELETE FROM messages WHERE thread_id = ?').run(threadId);
  db.prepare('DELETE FROM message_threads WHERE id = ?').run(threadId);

  execEventBus.emit('message_updated', { thread_id: threadId, deleted: true });

  res.json({ success: true });
});

// POST /api/messages/threads/:id/read
router.post('/threads/:id/read', (req: Request, res: Response) => {
  const threadId = parseInt(req.params.id);

  const thread = db.prepare('SELECT id FROM message_threads WHERE id = ?').get(threadId) as any;
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  db.prepare(`
    UPDATE messages
    SET is_read = 1
    WHERE thread_id = ? AND sender_type = 'agent' AND is_read = 0
  `).run(threadId);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM messages
    WHERE sender_type = 'agent' AND is_read = 0
  `).get() as { count: number };

  const updatedThread = threadRow(threadId);
  execEventBus.emit('message_updated', { thread_id: threadId, thread: updatedThread, unreadCount: unreadCount.count });

  res.json({ success: true, unreadCount: unreadCount.count, thread: updatedThread });
});

export default router;
