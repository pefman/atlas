import { Router, Request, Response } from 'express';
import { executeTask } from '../executor';
import { db } from '../db';

const router = Router();

// Execute a task
router.post('/task/:id', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);

    // Start execution in background
    executeTask(taskId).catch(error => {
      console.error(`Error executing task ${taskId}:`, error);
    });

    res.json({ success: true, message: 'Task execution started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start execution' });
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
