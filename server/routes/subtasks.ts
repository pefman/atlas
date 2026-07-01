import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Get all subtasks (no task filter)
router.get('/', (req: Request, res: Response) => {
  const subtasks = db.prepare(`
    SELECT s.*, r.name as role_name
    FROM subtasks s
    JOIN roles r ON s.role_id = r.id
    ORDER BY s.created_at ASC
  `).all();
  
  res.json(subtasks);
});

// Get subtasks for a task
router.get('/task/:taskId', (req: Request, res: Response) => {
  const subtasks = db.prepare(`
    SELECT s.*, r.name as role_name
    FROM subtasks s
    JOIN roles r ON s.role_id = r.id
    WHERE s.task_id = ?
    ORDER BY s.created_at ASC
  `).all(req.params.taskId);
  
  res.json(subtasks);
});

// Create subtask
router.post('/', (req: Request, res: Response) => {
  const { task_id, title, description, role_id } = req.body;
  
  if (!task_id || !title || !description || !role_id) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  
  const result = db.prepare(`
    INSERT INTO subtasks (task_id, title, description, role_id)
    VALUES (?, ?, ?, ?)
  `).run(task_id, title, description, role_id);
  
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid);
  
  res.status(201).json(subtask);
});

// Update subtask status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['backlog', 'in_progress', 'review', 'done'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  
  db.prepare(`
    UPDATE subtasks SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, req.params.id);
  
  res.json({ success: true });
});

// Get outputs for a subtask
router.get('/:id/outputs', (req: Request, res: Response) => {
  const outputs = db.prepare(`
    SELECT * FROM outputs
    WHERE subtask_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);
  
  res.json(outputs);
});

export default router;
