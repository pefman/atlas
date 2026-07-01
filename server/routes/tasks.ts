import { Router, Request, Response } from 'express';
import { db } from '../db';
import { executeTask, processNextTask } from '../executor';

const router = Router();

// Get all tasks
router.get('/', (req: Request, res: Response) => {
  const tasks = db.prepare(`
    SELECT t.*, r.name as role_name
    FROM tasks t
    JOIN roles r ON t.role_id = r.id
    ORDER BY t.created_at DESC
  `).all();
  
  res.json(tasks);
});

// Get task by ID with subtasks
router.get('/:id', (req: Request, res: Response) => {
  const task = db.prepare(`
    SELECT t.*, r.name as role_name, r.description as role_description
    FROM tasks t
    JOIN roles r ON t.role_id = r.id
    WHERE t.id = ?
  `).get(req.params.id);
  
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  const subtasks = db.prepare(`
    SELECT s.*, r.name as role_name
    FROM subtasks s
    JOIN roles r ON s.role_id = r.id
    WHERE s.task_id = ?
    ORDER BY s.created_at ASC
  `).all(req.params.id);
  
  res.json({ ...task, subtasks });
});

// Create task
router.post('/', (req: Request, res: Response) => {
  const { title, description, priority, role_id } = req.body;
  
  if (!title || !description) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  
  // Get CEO role ID for task assignment
  const ceoRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('ceo') as { id: number } | undefined;
  if (!ceoRole) {
    res.status(500).json({ error: 'CEO role not found' });
    return;
  }
  
  // Validate priority if provided
  const validPriorities = ['low', 'medium', 'high'];
  if (priority && !validPriorities.includes(priority)) {
    res.status(400).json({ error: 'Invalid priority. Must be one of: low, medium, high' });
    return;
  }
  
  // Validate role_id if provided - must match an existing role
  let assignedRoleId = ceoRole.id;
  if (role_id) {
    const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(role_id) as { id: number } | undefined;
    if (!role) {
      res.status(400).json({ error: 'Invalid role_id. Role not found.' });
      return;
    }
    assignedRoleId = role.id;
  }
  
  const result = db.prepare(`
    INSERT INTO tasks (title, description, role_id, priority, status)
    VALUES (?, ?, ?, ?, 'backlog')
  `).run(title, description, assignedRoleId, priority || null);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  
  res.status(201).json(task);
});

// Pick up task from backlog (called by CEO)
router.patch('/:id/pickup', (req: Request, res: Response) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  if (task.status !== 'backlog') {
    res.status(400).json({ error: 'Task is not in backlog' });
    return;
  }
  
  db.prepare(`
    UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?
  `).run(req.params.id);
  
  executeTask(req.params.id).catch(error => {
    console.error(`Error executing task ${req.params.id}:`, error);
  });
  
  res.json({ success: true });
});

// CEO: Process next task from backlog
router.post('/process-next', async (req: Request, res: Response) => {
  try {
    const processed = await processNextTask();
    if (processed) {
      res.json({ success: true, message: 'Next task processed' });
    } else {
      res.json({ success: true, message: 'No tasks in backlog' });
    }
  } catch (error) {
    console.error('Error processing next task:', error);
    res.status(500).json({ error: 'Failed to process next task' });
  }
});

// Update task status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['backlog', 'in_progress', 'review', 'done'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  
  db.prepare(`
    UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, req.params.id);
  
  res.json({ success: true });
});

// Delete task
router.delete('/:id', (req: Request, res: Response) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  db.prepare('DELETE FROM execution_logs WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id = ?)').run(req.params.id);
  db.prepare('DELETE FROM outputs WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id = ?)').run(req.params.id);
  db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  
  res.json({ success: true });
});

export default router;
