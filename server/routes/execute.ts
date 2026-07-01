import { Router, Request, Response } from 'express';
import { scheduler } from '../scheduler';
import { db } from '../db';

const router = Router();

// Execute a task
router.post('/task/:id', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Move to in_progress if still in backlog
    if (task.status === 'backlog') {
      db.prepare(`UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(taskId);
    }

    // If not yet decomposed, the scheduler will pick it up on its next poll
    // If already decomposed, enqueue existing subtasks
    if (task.ceo_status === 'decomposed') {
      const subtasks = db.prepare(`
        SELECT * FROM subtasks WHERE task_id = ? AND status = 'backlog'
        ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END ASC
      `).all(taskId) as any[];

      for (const subtask of subtasks) {
        scheduler.enqueue(subtask.id, subtask.title, subtask.priority as 'high' | 'medium' | 'low');
      }
    }

    res.json({ success: true, message: 'Task queued for execution' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue task' });
  }
});

// Get execution logs for a subtask
router.get('/logs/:subtaskId', (req: Request, res: Response) => {
  const logs = db.prepare(`
    SELECT el.*, r.name as role_name
    FROM execution_logs el
    JOIN roles r ON el.role_id = r.id
    WHERE el.subtask_id = ?
    ORDER BY el.step ASC
  `).all(req.params.subtaskId);

  res.json(logs);
});

export default router;
