import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

const CANONICAL_ROLE_NAMES = new Set([
  'ceo',
  'product_manager',
  'tech_lead',
  'frontend_developer',
  'backend_developer',
  'qa_engineer',
  'seo_specialist',
]);

// Get all agents with status
router.get('/', (req: Request, res: Response) => {
  const canonicalFilter = req.query.canonical === 'true'
    ? true
    : req.query.canonical === 'false'
      ? false
      : null;
  const selectableFilter = req.query.selectable_by_ceo === 'true'
    ? true
    : req.query.selectable_by_ceo === 'false'
      ? false
      : null;

  const agents = db.prepare(`
    SELECT r.*, r.personality, r.portrait, r.gender, r.funny_name,
           (SELECT t.title FROM tasks t WHERE t.role_id = r.id AND t.status = 'in_progress' LIMIT 1) as current_task_title,
           CASE
             WHEN a.last_user_message_at IS NOT NULL
               AND ((julianday('now') - julianday(a.last_user_message_at)) * 86400.0) < 3
               THEN 'reading_email'
             WHEN a.last_user_message_at IS NOT NULL
               AND ((julianday('now') - julianday(a.last_user_message_at)) * 86400.0) < 8
               THEN 'answering_email'
             WHEN r.name = 'ceo' AND EXISTS (
               SELECT 1 FROM tasks t WHERE t.status = 'in_progress' AND t.ceo_status = 'decomposing'
             ) THEN 'decomposing'
             WHEN EXISTS (
               SELECT 1 FROM subtasks s WHERE s.role_id = r.id AND s.status = 'in_progress'
             ) THEN 'executing'
             ELSE 'idle'
           END as status
    FROM roles r
    LEFT JOIN agent_email_activity a ON a.role_id = r.id
    ORDER BY r.name ASC
  `).all();
  
  // Enrich each agent with stats and latest activity
  const enrichedAgents = agents.map((agent: any) => {
    const stats = db.prepare(`
      SELECT * FROM agent_stats WHERE role_id = ?
    `).get(agent.id) as any;
    
    const latestLog = db.prepare(`
      SELECT el.*, r.name as role_name
      FROM execution_logs el
      JOIN roles r ON el.role_id = r.id
      WHERE el.role_id = ?
      ORDER BY el.created_at DESC
      LIMIT 1
    `).get(agent.id) as any;

    const canonical = CANONICAL_ROLE_NAMES.has(agent.name);
    const selectableByCeo = canonical && agent.name !== 'ceo';
    
    return {
      ...agent,
      current_task: agent.current_task_title || null,
      canonical,
      selectable_by_ceo: selectableByCeo,
      stats: stats ? {
        inputTokens: stats.total_input_tokens,
        outputTokens: stats.total_output_tokens,
        totalCalls: stats.total_calls,
      } : null,
      latestActivity: latestLog ? {
        step_type: latestLog.step_type,
        output: latestLog.output,
        created_at: latestLog.created_at,
        role_name: latestLog.role_name,
      } : null,
    };
  });

  const filteredAgents = enrichedAgents.filter((agent: any) => {
    if (canonicalFilter !== null && agent.canonical !== canonicalFilter) {
      return false;
    }
    if (selectableFilter !== null && agent.selectable_by_ceo !== selectableFilter) {
      return false;
    }
    return true;
  });
  
  res.json(filteredAgents);
});

// Get agent by ID
router.get('/:id', (req: Request, res: Response) => {
  const agent = db.prepare(`
    SELECT r.*,
           (SELECT t.title FROM tasks t WHERE t.role_id = r.id AND t.status = 'in_progress' LIMIT 1) as current_task_title,
           CASE
             WHEN a.last_user_message_at IS NOT NULL
               AND ((julianday('now') - julianday(a.last_user_message_at)) * 86400.0) < 3
               THEN 'reading_email'
             WHEN a.last_user_message_at IS NOT NULL
               AND ((julianday('now') - julianday(a.last_user_message_at)) * 86400.0) < 8
               THEN 'answering_email'
             WHEN r.name = 'ceo' AND EXISTS (
               SELECT 1 FROM tasks t WHERE t.status = 'in_progress' AND t.ceo_status = 'decomposing'
             ) THEN 'decomposing'
             WHEN EXISTS (
               SELECT 1 FROM subtasks s WHERE s.role_id = r.id AND s.status = 'in_progress'
             ) THEN 'executing'
             ELSE 'idle'
           END as status
    FROM roles r
    LEFT JOIN agent_email_activity a ON a.role_id = r.id
    WHERE r.id = ?
  `).get(req.params.id) as any;
  
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  
  res.json({
    ...agent,
    status: agent.status,
    current_task: agent.current_task_title || null
  });
});

// Get assigned work context for agent messaging
router.get('/:id/assigned-work', (req: Request, res: Response) => {
  const agentId = parseInt(req.params.id);
  const agent = db.prepare('SELECT id, name FROM roles WHERE id = ?').get(agentId) as any;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const subtasks = db.prepare(`
    SELECT s.id, s.task_id, s.title, s.status, s.priority, t.title as task_title
    FROM subtasks s
    JOIN tasks t ON t.id = s.task_id
    WHERE s.role_id = ?
    ORDER BY
      CASE s.status
        WHEN 'in_progress' THEN 1
        WHEN 'backlog' THEN 2
        WHEN 'review' THEN 3
        WHEN 'failed' THEN 4
        WHEN 'done' THEN 5
        ELSE 6
      END ASC,
      s.updated_at DESC
    LIMIT 100
  `).all(agentId) as Array<{
    id: number;
    task_id: number;
    title: string;
    status: string;
    priority: string;
    task_title: string;
  }>;

  const taskMap = new Map<number, { id: number; title: string; open_subtasks: number; total_subtasks: number }>();
  for (const subtask of subtasks) {
    if (!taskMap.has(subtask.task_id)) {
      taskMap.set(subtask.task_id, {
        id: subtask.task_id,
        title: subtask.task_title,
        open_subtasks: 0,
        total_subtasks: 0,
      });
    }
    const task = taskMap.get(subtask.task_id)!;
    task.total_subtasks += 1;
    if (subtask.status !== 'done') {
      task.open_subtasks += 1;
    }
  }

  res.json({
    agent: { id: agent.id, name: agent.name },
    tasks: Array.from(taskMap.values()),
    subtasks,
  });
});

// Update agent
router.put('/:id', (req: Request, res: Response) => {
  const { name, description, system_prompt, personality, portrait } = req.body;
  const agentId = parseInt(req.params.id);
  
  const agent = db.prepare('SELECT * FROM roles WHERE id = ?').get(agentId);
  
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  
  if (name !== undefined) {
    db.prepare('UPDATE roles SET name = ? WHERE id = ?').run(name, agentId);
  }
  if (description !== undefined) {
    db.prepare('UPDATE roles SET description = ? WHERE id = ?').run(description, agentId);
  }
  if (system_prompt !== undefined) {
    db.prepare('UPDATE roles SET system_prompt = ? WHERE id = ?').run(system_prompt, agentId);
  }
  if (personality !== undefined) {
    db.prepare('UPDATE roles SET personality = ? WHERE id = ?').run(personality, agentId);
  }
  if (portrait !== undefined) {
    db.prepare('UPDATE roles SET portrait = ? WHERE id = ?').run(portrait, agentId);
  }
  
  res.json({ success: true });
});

// Regenerate portrait
router.post('/:id/regenerate-portrait', async (req: Request, res: Response) => {
  const agentId = parseInt(req.params.id);
  const role = db.prepare('SELECT id, name FROM roles WHERE id = ?').get(agentId) as any;

  if (!role) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  try {
    const portrait = await scheduler.generatePortrait(role.name);
    db.prepare('UPDATE roles SET portrait = ? WHERE id = ?').run(portrait, agentId);
    res.json({ success: true, portrait });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Portrait generation failed' });
  }
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
