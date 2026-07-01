import { Router, Request, Response } from 'express';
import { db } from '../db';
import { OllamaProvider } from '../ai/ollama';
import { OpenAIProvider } from '../ai/openai';
import { AIProvider, Message } from '../ai/provider';

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

// Test AI connection
async function testSettings(req: Request, res: Response) {
  try {
    const { provider, endpoint, api_key, model } = req.body;
    
    if (!provider || (provider !== 'ollama' && provider !== 'openai')) {
      return res.status(400).json({ success: false, error: 'Unknown provider' });
    }
    
    if (!model) {
      return res.status(400).json({ success: false, error: 'model is required' });
    }
    
    let aiProvider: AIProvider;
    
    if (provider === 'openai') {
      aiProvider = new OpenAIProvider(api_key || '', model);
    } else {
      aiProvider = new OllamaProvider(endpoint || 'http://localhost:11434', model);
    }
    
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant. Respond with exactly "pong".' },
      { role: 'user', content: 'Hello' }
    ];
    
    const response = await aiProvider.chat(messages);
    
    res.json({ success: true, response });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Test failed';
    res.status(500).json({ success: false, error: errorMessage });
  }
}

router.post('/test', testSettings);

export default router;
