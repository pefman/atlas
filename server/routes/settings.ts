import { Router, Request, Response } from 'express';
import { db } from '../db';
import { OllamaProvider } from '../ai/ollama';
import { OpenAIProvider } from '../ai/openai';
import { AIProvider, Message, AIModel } from '../ai/provider';
import { scheduler } from '../scheduler';
import { getGender, getFunnyName, generateAvatar } from '../lib/avatarGenerator';

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

// Regenerate all avatars with deterministic algorithm
router.post('/regenerate/portraits', async (req: Request, res: Response) => {
  try {
    const { renderPixelGridToBase64 } = await import('../lib/avatarGenerator');
    const roles = db.prepare('SELECT id, name FROM roles').all() as Array<{ id: number; name: string }>;
    let regenerated = 0;

    for (const role of roles) {
      try {
        // Add random seed to get different avatars each time
        const randomSeed = Math.floor(Math.random() * 1000000);
        const avatar = generateAvatar(role.name + randomSeed, { useFunnyNames: true });
        const gender = getGender(role.name + randomSeed);
        const funnyName = getFunnyName(role.name + randomSeed);
        
        // Convert grid to base64 PNG
        const pngDataUrl = renderPixelGridToBase64(avatar);
        
        db.prepare('UPDATE roles SET portrait = ?, gender = ?, funny_name = ? WHERE id = ?')
          .run(pngDataUrl, gender, funnyName, role.id);
        regenerated++;
      } catch (err) {
        console.error(`Failed to regenerate avatar for ${role.name}:`, err);
      }
    }

    res.json({ success: true, regenerated, total: roles.length });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: `Failed to regenerate portraits: ${error.message}` });
  }
});

// Regenerate all personalities
router.post('/regenerate/personalities', async (req: Request, res: Response) => {
  try {
    const roles = db.prepare('SELECT id, name FROM roles').all() as Array<{ id: number; name: string }>;
    let regenerated = 0;

    for (const role of roles) {
      try {
        // Add random seed to get different personalities each time
        const randomSeed = Math.floor(Math.random() * 1000000);
        const personality = generatePersonality(role.name + randomSeed);
        db.prepare('UPDATE roles SET personality = ? WHERE id = ?').run(personality, role.id);
        regenerated++;
      } catch (err) {
        console.error(`Failed to regenerate personality for ${role.name}:`, err);
      }
    }

    res.json({ success: true, regenerated, total: roles.length });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: `Failed to regenerate personalities: ${error.message}` });
  }
});

// Helper to generate deterministic personality
function generatePersonality(roleName: string): string {
  const seed = hashString(roleName);
  const traits = [
    'Detail-oriented', 'Methodical', 'Creative', 'Analytical', 'Collaborative',
    'Independent', 'Decisive', 'Empathetic', 'Assertive', 'Patient',
    'Enthusiastic', 'Cautious', 'Adaptable', 'Persistent', 'Strategic'
  ];
  
  const pickedTraits = [];
  for (let i = 0; i < 3; i++) {
    const index = (seed + i * 7) % traits.length;
    pickedTraits.push(traits[index]);
  }
  
  const strengths = [
    'Problem-solving', 'Communication', 'Leadership', 'Technical expertise', 'Teamwork',
    'Time management', 'Organization', 'Creativity', 'Attention to detail', 'Critical thinking'
  ];
  
  const strengthIndex = (seed + 3) % strengths.length;
  
  const weaknesses = [
    'Overthinking', 'Perfectionism', 'Delegation', 'Public speaking', 'Task prioritization',
    'Saying no', 'Impatience', 'Self-criticism', 'Avoiding feedback', 'Taking on too much'
  ];
  
  const weaknessIndex = (seed + 4) % weaknesses.length;
  
  return `Personality traits: ${pickedTraits.join(', ')}. 
Strengths: ${strengths[strengthIndex]}. 
Areas for growth: ${weaknesses[weaknessIndex]}.`;
}

// Simple hash function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export default router;
