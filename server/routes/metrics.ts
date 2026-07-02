import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const subtaskCounts = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM subtasks
    GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  const statusMap = new Map(subtaskCounts.map((c: any) => [c.status, c.count]));

  const totalSubtasks = statusMap.get('done') || 0 + 
                        (statusMap.get('in_progress') || 0) + 
                        (statusMap.get('review') || 0) + 
                        (statusMap.get('backlog') || 0) + 
                        (statusMap.get('failed') || 0);

  const doneSubtasks = statusMap.get('done') || 0;
  const failedSubtasks = statusMap.get('failed') || 0;
  const activeSubtasks = (statusMap.get('in_progress') || 0) + (statusMap.get('review') || 0);

  const successRate = doneSubtasks + failedSubtasks > 0 
    ? Math.round((doneSubtasks / (doneSubtasks + failedSubtasks)) * 100) 
    : 0;

  const stats = db.prepare(`
    SELECT 
      SUM(total_input_tokens) as total_input,
      SUM(total_output_tokens) as total_output,
      SUM(total_calls) as total_calls
    FROM agent_stats
  `).get() as { total_input: number | null; total_output: number | null; total_calls: number | null } | undefined;

  const tasksDoneToday = db.prepare(`
    SELECT COUNT(*) as count
    FROM tasks
    WHERE status = 'done' AND date(created_at) = date('now')
  `).get() as { count: number };

  res.json({
    subtasks: {
      total: totalSubtasks,
      done: doneSubtasks,
      in_progress: statusMap.get('in_progress') || 0,
      review: statusMap.get('review') || 0,
      failed: failedSubtasks,
      backlog: statusMap.get('backlog') || 0,
    },
    successRate,
    tokens: {
      input: stats?.total_input || 0,
      output: stats?.total_output || 0,
    },
    calls: stats?.total_calls || 0,
    tasksDoneToday: tasksDoneToday.count,
  });
});

export default router;
