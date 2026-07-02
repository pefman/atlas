import { db } from '../db';
import { execEventBus } from '../events';

const TERMINAL_STATUSES = ['done', 'failed', 'review'];

export function recomputeTaskStatus(taskId: number): { newStatus: string; emitted: string | null } {
  const subtasks = db.prepare(`
    SELECT status FROM subtasks WHERE task_id = ?
  `).all(taskId) as Array<{ status: string }>;

  if (subtasks.length === 0) {
    return { newStatus: 'done', emitted: null };
  }

  const allTerminal = subtasks.every(s => TERMINAL_STATUSES.includes(s.status));

  if (!allTerminal) {
    return { newStatus: 'in_progress', emitted: null };
  }

  const hasFailed = subtasks.some(s => s.status === 'failed');

  if (hasFailed) {
    db.prepare(`
      UPDATE tasks SET status = 'review', ceo_status = 'idle', updated_at = datetime('now')
      WHERE id = ?
    `).run(taskId);

    const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId) as { title: string } | undefined;
    const notification = {
      sender_role: 'system',
      message: `Task "${task?.title || `#${taskId}`}" needs review — some subtasks failed`,
      task_id: taskId,
    };
    db.prepare(`INSERT INTO notifications (sender_role, message, task_id) VALUES (?, ?, ?)`).run(notification.sender_role, notification.message, notification.task_id);
    execEventBus.emit('notification', { ...notification, id: Date.now(), is_read: false, created_at: new Date().toISOString() });
    execEventBus.emit('task_status_changed', { task_id: taskId, new_status: 'review' });
    return { newStatus: 'review', emitted: 'task_status_changed' };
  }

  db.prepare(`
    UPDATE tasks SET status = 'done', ceo_status = 'idle', updated_at = datetime('now')
    WHERE id = ?
  `).run(taskId);

  const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId) as { title: string } | undefined;
  const notification = {
    sender_role: 'system',
    message: `Task "${task?.title || `#${taskId}`}" completed successfully`,
    task_id: taskId,
  };
  db.prepare(`INSERT INTO notifications (sender_role, message, task_id) VALUES (?, ?, ?)`).run(notification.sender_role, notification.message, notification.task_id);
  execEventBus.emit('notification', { ...notification, id: Date.now(), is_read: false, created_at: new Date().toISOString() });
  execEventBus.emit('task_completed', { task_id: taskId });
  return { newStatus: 'done', emitted: 'task_completed' };
}
