import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  
  const logs = db.prepare(`
    SELECT 
      el.*,
      r.name as role_name,
      s.title as subtask_title,
      s.task_id as subtask_task_id,
      t.title as task_title
    FROM execution_logs el
    JOIN roles r ON el.role_id = r.id
    JOIN subtasks s ON el.subtask_id = s.id
    JOIN tasks t ON s.task_id = t.id
    ORDER BY el.created_at DESC
    LIMIT ?
  `).all(limit);
  
  const normalized = logs.map((log: any) => ({
    time: log.created_at,
    role: log.role_name,
    action: log.step_type,
    subtask_id: log.subtask_id,
    task_id: log.subtask_task_id,
    title: log.subtask_title,
    task_title: log.task_title,
    output: log.output?.substring(0, 200),
  }));
  
  res.json(normalized);
});

export default router;
