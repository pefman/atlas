import { Router, Request, Response } from 'express';
import { db } from '../db';
import { execEventBus } from '../events';

const router = Router();

// GET /api/notifications - fetch all notifications
router.get('/', (req: Request, res: Response) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all() as any[];
  
  res.json(notifications);
});

// PATCH /api/notifications/:id/read - mark as read
router.patch('/:id/read', (req: Request, res: Response) => {
  const notificationId = parseInt(req.params.id);
  const result = db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ?'
  ).run(notificationId);
  
  if (result.changes === 0) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  
  res.json({ success: true });
});

// POST /api/notifications - internal: create notification
router.post('/', (req: Request, res: Response) => {
  const { sender_role, message, task_id, thread_id } = req.body;
  
  if (!sender_role || !message) {
    res.status(400).json({ error: 'sender_role and message are required' });
    return;
  }
  
  const result = db.prepare(`
    INSERT INTO notifications (sender_role, message, task_id, thread_id)
    VALUES (?, ?, ?, ?)
  `).run(sender_role, message, task_id || null, thread_id || null);

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
  execEventBus.emit('notification', notification);

  res.status(201).json({ id: result.lastInsertRowid });
});

export default router;
