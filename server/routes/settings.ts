import { Router, Request, Response } from 'express';
import { db } from '../db';
import { OllamaProvider } from '../ai/ollama';
import { OpenAIProvider } from '../ai/openai';
import { AIProvider, Message, AIModel } from '../ai/provider';

const router = Router();

// Get settings
router.get('/', (req: Request, res: Response) => {
  const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
  
  if (!settings) {
    res.json({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      has_api_key: false,
    });
  } else {
    res.json({
      provider: settings.provider,
      endpoint: settings.endpoint,
      model: settings.model,
      has_api_key: !!settings.api_key,
    });
  }
});

// Update settings
router.put('/', (req: Request, res: Response) => {
  const { provider, endpoint, api_key, model } = req.body;
  
  const existing = db.prepare('SELECT id, api_key FROM settings ORDER BY id DESC LIMIT 1').get() as { id: number; api_key: string } | undefined;
  
  const storedKey = existing?.api_key;
  const newKey = api_key || storedKey;
  
  if (existing) {
    db.prepare(`
      UPDATE settings SET provider = ?, endpoint = ?, api_key = ?, model = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(provider, endpoint, newKey, model, existing.id);
  } else {
    db.prepare(`
      INSERT INTO settings (provider, endpoint, api_key, model)
      VALUES (?, ?, ?, ?)
    `).run(provider, endpoint, newKey, model);
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
      aiProvider = new OpenAIProvider(api_key || '', model, endpoint);
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

// Get available models
router.get('/models', async (req: Request, res: Response) => {
  try {
    let settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get() as any;
    
    if (!settings) {
      settings = { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3' };
    }
    
    let aiProvider: AIProvider;
    
    if (settings.provider === 'openai') {
      aiProvider = new OpenAIProvider(settings.api_key || '', settings.model, settings.endpoint);
    } else {
      aiProvider = new OllamaProvider(settings.endpoint || 'http://localhost:11434', settings.model);
    }
    
    const models = await aiProvider.getModels();
    res.json(models);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models';
    res.status(500).json({ error: errorMessage });
  }
});

// Clear settings
router.delete('/', (req: Request, res: Response) => {
  db.prepare('DELETE FROM settings').run();
  res.json({ success: true });
});

// Reset execution data while preserving role templates
router.post('/reset', (req: Request, res: Response) => {
  try {
    const tables = [
      'project_repos',
      'projects',
      'tasks',
      'subtasks',
      'outputs',
      'execution_logs',
      'agent_stats',
      'agent_email_activity',
      'notifications',
      'messages',
      'message_threads',
    ];

    db.exec('PRAGMA foreign_keys = OFF');
    db.prepare('BEGIN TRANSACTION').run();
    try {
      for (const table of tables) {
        const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table) as { name: string } | undefined;
        if (tableExists) {
          db.prepare(`DELETE FROM "${table}"`).run();
        }
      }
      db.prepare('COMMIT').run();
      db.exec('PRAGMA foreign_keys = ON');
      res.json({ success: true, message: 'Execution data cleared. Agent templates were preserved.' });
    } catch (err) {
      db.prepare('ROLLBACK').run();
      db.exec('PRAGMA foreign_keys = ON');
      throw err;
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: `Failed to reset data: ${error.message}` });
  }
});

export default router;
