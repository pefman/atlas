import { Router, Request, Response } from 'express';
import { scheduler } from '../scheduler';
import { db } from '../db';

const router = Router();

router.post('/subtask/:id', async (req: Request, res: Response) => {
  try {
    const subtaskId = parseInt(req.params.id);
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(subtaskId) as any;

    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    // Move parent task to in_progress if still in backlog
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(subtask.task_id) as any;
    if (task && task.status === 'backlog') {
      db.prepare(`UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(task.id);
    }

    scheduler.enqueue(subtaskId, subtask.title, subtask.priority as 'high' | 'medium' | 'low');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enqueue subtask' });
  }
});

export default router;
