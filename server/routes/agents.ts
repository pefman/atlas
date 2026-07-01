import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Get all agents with status
router.get('/', (req: Request, res: Response) => {
  const agents = db.prepare(`
    SELECT r.*, 
           CASE WHEN t.id IS NOT NULL THEN t.title ELSE NULL END as current_task_title,
           CASE WHEN t.id IS NOT NULL THEN 'executing' ELSE 'idle' END as status
    FROM roles r
    LEFT JOIN tasks t ON t.role_id = r.id AND t.status = 'in_progress'
    ORDER BY r.name ASC
  `).all();
  
  res.json(agents);
});

// Get agent by ID
router.get('/:id', (req: Request, res: Response) => {
  const agent = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  
  const currentTask = db.prepare(`
    SELECT t.title, t.status
    FROM tasks t
    WHERE t.role_id = ? AND t.status = 'in_progress'
    LIMIT 1
  `).get(req.params.id);
  
  res.json({
    ...agent,
    status: currentTask ? 'executing' : 'idle',
    current_task: currentTask ? currentTask.title : null
  });
});

// Update agent
router.put('/:id', (req: Request, res: Response) => {
  const { name, description, system_prompt } = req.body;
  const agentId = parseInt(req.params.id);
  
  const agent = db.prepare('SELECT * FROM roles WHERE id = ?').get(agentId);
  
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  
  if (name) {
    db.prepare('UPDATE roles SET name = ? WHERE id = ?').run(name, agentId);
  }
  if (description) {
    db.prepare('UPDATE roles SET description = ? WHERE id = ?').run(description, agentId);
  }
  if (system_prompt) {
    db.prepare('UPDATE roles SET system_prompt = ? WHERE id = ?').run(system_prompt, agentId);
  }
  
  res.json({ success: true });
});

// Delete agent
router.delete('/:id', (req: Request, res: Response) => {
  const agentId = parseInt(req.params.id);
  
  const agent = db.prepare('SELECT * FROM roles WHERE id = ?').get(agentId);
  
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  
  // Prevent deletion of CEO role
  if (agent.name === 'ceo') {
    res.status(400).json({ error: 'Cannot delete the CEO role' });
    return;
  }

  // Check if agent has active tasks
  const activeTasks = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE role_id = ? AND status IN ('backlog', 'in_progress')"
  ).get(agentId) as { count: number };
  
  if (activeTasks.count > 0) {
    res.status(400).json({ error: 'Agent has active tasks and cannot be deleted' });
    return;
  }
  
  // Delete agent
  db.prepare('DELETE FROM roles WHERE id = ?').run(agentId);
  
  res.json({ success: true });
});

export default router;
