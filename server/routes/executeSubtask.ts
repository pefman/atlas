import { Router, Request, Response } from 'express';
import { executeSubtask } from '../executor';

const router = Router();

router.post('/subtask/:id', async (req: Request, res: Response) => {
  try {
    const subtaskId = parseInt(req.params.id);
    await executeSubtask(subtaskId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute subtask' });
  }
});

export default router;
