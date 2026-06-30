import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Get settings
router.get('/', (req: Request, res: Response) => {
  const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
  
  if (!settings) {
    res.json({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
    });
  } else {
    res.json(settings);
  }
});

// Update settings
router.put('/', (req: Request, res: Response) => {
  const { provider, endpoint, api_key, model } = req.body;
  
  const existing = db.prepare('SELECT id FROM settings ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
  
  if (existing) {
    db.prepare(`
      UPDATE settings SET provider = ?, endpoint = ?, api_key = ?, model = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(provider, endpoint, api_key, model, existing.id);
  } else {
    db.prepare(`
      INSERT INTO settings (provider, endpoint, api_key, model)
      VALUES (?, ?, ?, ?)
    `).run(provider, endpoint, api_key, model);
  }
  
  res.json({ success: true });
});

export default router;
