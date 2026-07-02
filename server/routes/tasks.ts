import { Router, Request, Response } from 'express';
import { db } from '../db';
import { scheduler } from '../scheduler';
import { logTask, logTaskError } from '../lib/logger';
import { recomputeTaskStatus } from '../lib/taskProgress';
import { execEventBus } from '../events';

const router = Router();

// Get all tasks
router.get('/', (req: Request, res: Response) => {
  const parsedProjectId = typeof req.query.project_id === 'string' ? parseInt(req.query.project_id, 10) : NaN;
  const projectId = Number.isFinite(parsedProjectId) ? parsedProjectId : null;

  const tasks = db.prepare(`
    SELECT t.*, r.name as role_name, p.name as project_name, p.folder_path as project_folder_path
    FROM tasks t
    JOIN roles r ON t.role_id = r.id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE (? IS NULL OR t.project_id = ?)
    ORDER BY t.created_at DESC
  `).all(projectId, projectId);
  
  res.json(tasks);
});

// Get task by ID with subtasks
router.get('/:id', (req: Request, res: Response) => {
  const task = db.prepare(`
    SELECT t.*, r.name as role_name, r.description as role_description, p.name as project_name, p.folder_path as project_folder_path
    FROM tasks t
    JOIN roles r ON t.role_id = r.id
    LEFT JOIN projects p ON p.id = t.project_id
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
  try {
    const { title, description, priority, role_id, status, project_id } = req.body;
    
    if (!title || !description) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    // Get CEO role ID for task assignment (default if not specified)
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

    let assignedProjectId: number | null = null;
    if (project_id !== undefined && project_id !== null) {
      const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id) as { id: number } | undefined;
      if (!project) {
        res.status(400).json({ error: 'Invalid project_id. Project not found.' });
        return;
      }
      assignedProjectId = project.id;
    }
    
    // Validate and default status
    const validStatuses = ['backlog', 'in_progress'];
    let taskStatus = 'backlog';
    if (status && validStatuses.includes(status)) {
      taskStatus = status;
    }
    
    // Default priority to medium if not provided
    const taskPriority = priority || 'medium';
    
    const result = db.prepare(`
      INSERT INTO tasks (title, description, project_id, role_id, priority, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, description, assignedProjectId, assignedRoleId, taskPriority, taskStatus);
    
    logTask('Created', { title, id: result.lastInsertRowid, role_id: assignedRoleId });
    
    const task = db.prepare(`
      SELECT t.*, r.name as role_name, p.name as project_name, p.folder_path as project_folder_path
      FROM tasks t
      JOIN roles r ON t.role_id = r.id
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(task);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logTaskError(error, { title });
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Trigger: tell scheduler to check for backlog tasks
router.post('/process-next', async (req: Request, res: Response) => {
  try {
    const pending = scheduler.pendingCount;
    res.json({ success: true, message: 'Scheduler is running', pending_subtasks: pending });
  } catch (error) {
    console.error('Error triggering scheduler:', error);
    res.status(500).json({ error: 'Failed to trigger scheduler' });
  }
});

// Update task status
router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['backlog', 'in_progress', 'review', 'done'];
    
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id) as { id: number } | undefined;
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (status === 'done') {
      const pendingSubtasks = db.prepare(`
        SELECT COUNT(*) as count
        FROM subtasks
        WHERE task_id = ? AND status NOT IN ('done', 'review')
      `).get(req.params.id) as { count: number };

      if (pendingSubtasks.count > 0) {
        res.status(409).json({
          error: 'Cannot mark task as done until all subtasks are done or review',
          pendingSubtasks: pendingSubtasks.count,
        });
        return;
      }
    }
    
    db.prepare(`
      UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, req.params.id);
    
    execEventBus.emit('task_status_changed', { task_id: parseInt(req.params.id), new_status: status });
    
    logTask('Status Changed', { id: req.params.id, status });
    
    res.json({ success: true });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logTaskError(error, { id: req.params.id, status: req.body.status });
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Redecompose task (manual retry)
router.post('/:id/redecompose', (req: Request, res: Response) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
    
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    if (task.ceo_status !== 'error' && task.ceo_status !== 'decomposed') {
      res.status(409).json({ error: 'Task is not in error or decomposed state' });
      return;
    }
    
    db.prepare(`UPDATE tasks SET ceo_status = 'idle', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    
    logTask('Redecompose requested', { id: req.params.id });
    res.json({ success: true, message: 'Task reset to idle for redecomposition' });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logTaskError(error, { id: req.params.id });
    res.status(500).json({ error: 'Failed to redecompose task' });
  }
});

// Delete task
router.delete('/:id', (req: Request, res: Response) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  scheduler.removeTask(parseInt(req.params.id));
  
  db.prepare('DELETE FROM execution_logs WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id = ?)').run(req.params.id);
  db.prepare('DELETE FROM outputs WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id = ?)').run(req.params.id);
  db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  
  res.json({ success: true });
});

export default router;
