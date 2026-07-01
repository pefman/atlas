import { Router, Request, Response } from 'express';
import { execEventBus } from '../events';

const router = Router();

// GET /api/notifications/stream - SSE endpoint
router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const subscription = execEventBus.on('notification', (data: any) => {
    res.write(`event: notification\ndata: ${JSON.stringify(data)}\n\n`);
  });

  req.on('close', () => {
    subscription.unsubscribe();
  });
});

export default router;
