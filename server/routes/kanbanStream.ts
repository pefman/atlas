import { Router, Request, Response } from 'express';
import { execEventBus } from '../events';

const router = Router();

const KANBAN_EVENTS = [
  'subtask_start',
  'subtask_progress',
  'subtask_complete',
  'subtask_failed',
  'task_decomposed',
  'task_completed',
  'task_status_changed',
  'subtask_status_changed',
];

router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const subscriptions: { unsubscribe: () => void }[] = [];

  for (const event of KANBAN_EVENTS) {
    const subscription = execEventBus.on(event, (data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
    subscriptions.push(subscription);
  }

  res.write(`event: connected\ndata: {}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
  });
});

export default router;
