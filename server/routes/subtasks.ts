import { Router, Request, Response } from 'express';
import { db } from '../db';
import { logTask } from '../lib/logger';
import { recomputeTaskStatus } from '../lib/taskProgress';
import { execEventBus } from '../events';

const router = Router();

// Get all subtasks (no task filter)
router.get('/', (req: Request, res: Response) => {
  const parsedProjectId = typeof req.query.project_id === 'string' ? parseInt(req.query.project_id, 10) : NaN;
  const projectId = Number.isFinite(parsedProjectId) ? parsedProjectId : null;

  const subtasks = db.prepare(`
    SELECT s.*, r.name as role_name, t.title as task_title
    FROM subtasks s
    JOIN roles r ON s.role_id = r.id
    JOIN tasks t ON s.task_id = t.id
    WHERE (? IS NULL OR t.project_id = ?)
    ORDER BY s.created_at ASC
  `).all(projectId, projectId);
  
  res.json(subtasks);
});

// Get subtasks for a task
router.get('/task/:taskId', (req: Request, res: Response) => {
  const subtasks = db.prepare(`
    SELECT s.*, r.name as role_name, t.title as task_title
    FROM subtasks s
    JOIN roles r ON s.role_id = r.id
    JOIN tasks t ON s.task_id = t.id
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
  const validStatuses = ['backlog', 'in_progress', 'review', 'done', 'failed'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const subtask = db.prepare('SELECT id, task_id FROM subtasks WHERE id = ?').get(req.params.id) as { id: number; task_id: number } | undefined;
  if (!subtask) {
    res.status(404).json({ error: 'Subtask not found' });
    return;
  }
  
  db.prepare(`
    UPDATE subtasks SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, req.params.id);

  execEventBus.emit('subtask_status_changed', { subtask_id: subtask.id, task_id: subtask.task_id, new_status: status });

  const { newStatus } = recomputeTaskStatus(subtask.task_id);
  logTask('Subtask status changed', { subtask_id: subtask.id, task_id: subtask.task_id, status, task_new_status: newStatus });
  
  res.json({ success: true, newTaskStatus: newStatus });
});

// Retry failed subtask
router.post('/:id/retry', (req: Request, res: Response) => {
  try {
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id) as any;
    
    if (!subtask) {
      res.status(404).json({ error: 'Subtask not found' });
      return;
    }
    
    if (subtask.status !== 'failed') {
      res.status(409).json({ error: 'Subtask is not in failed state' });
      return;
    }
    
    db.prepare(`UPDATE subtasks SET status = 'backlog', failure_count = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(subtask.role_id) as any;
    
    logTask('Subtask retry requested', { subtask_id: subtask.id, task_id: subtask.task_id });
    res.json({ success: true, message: 'Subtask reset to backlog for retry' });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logTask('Failed to retry subtask', { subtask_id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Failed to retry subtask' });
  }
});

// Get single subtask with outputs and logs
router.get('/:id', (req: Request, res: Response) => {
  const subtask = db.prepare(`
    SELECT s.*, r.name as role_name, t.title as task_title
    FROM subtasks s
    JOIN roles r ON s.role_id = r.id
    JOIN tasks t ON s.task_id = t.id
    WHERE s.id = ?
  `).get(req.params.id) as any;
  
  if (!subtask) {
    res.status(404).json({ error: 'Subtask not found' });
    return;
  }
  
  const outputs = db.prepare(`
    SELECT * FROM outputs
    WHERE subtask_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);
  
  const logs = db.prepare(`
    SELECT el.*, r.name as role_name
    FROM execution_logs el
    JOIN roles r ON el.role_id = r.id
    WHERE el.subtask_id = ?
    ORDER BY el.created_at ASC
  `).all(req.params.id);
  
  res.json({ subtask, outputs, logs });
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
