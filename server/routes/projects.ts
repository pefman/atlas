import { Router, Request, Response } from 'express';
import fs from 'fs';
import { db } from '../db';

const router = Router();

function ensureDirectoryPath(dirPath: string): { ok: true; normalizedPath: string } | { ok: false; error: string } {
  const normalizedPath = dirPath.trim();
  if (!normalizedPath) {
    return { ok: false, error: 'folder_path is required' };
  }

  try {
    if (!fs.existsSync(normalizedPath)) {
      fs.mkdirSync(normalizedPath, { recursive: true });
    }
  } catch {
    return { ok: false, error: 'Could not create folder_path. Check permissions and parent directory.' };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(normalizedPath);
  } catch {
    return { ok: false, error: 'folder_path does not exist' };
  }

  if (!stat.isDirectory()) {
    return { ok: false, error: 'folder_path must be a directory' };
  }

  return { ok: true, normalizedPath };
}

// Get all projects
router.get('/', (_req: Request, res: Response) => {
  const projects = db.prepare(`
    SELECT
      p.*,
      (
        SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id
      ) as task_count,
      (
        SELECT COUNT(*) FROM project_repos pr WHERE pr.project_id = p.id
      ) as repo_count
    FROM projects p
    ORDER BY p.updated_at DESC, p.id DESC
  `).all();

  res.json(projects);
});

// Get current working directory
router.get('/cwd', (_req: Request, res: Response) => {
  res.json({ cwd: process.cwd() });
});

// List directory contents (used for folder picker)
router.get('/ls', (req: Request, res: Response) => {
  const { path: dirPath } = req.query;
  if (!dirPath || typeof dirPath !== 'string') {
    res.status(400).json({ error: 'path parameter required' });
    return;
  }

  let stat;
  try {
    stat = fs.statSync(dirPath);
  } catch {
    res.status(400).json({ error: 'path does not exist' });
    return;
  }

  if (!stat.isDirectory()) {
    res.status(400).json({ error: 'path is not a directory' });
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    res.status(400).json({ error: 'cannot read directory' });
    return;
  }

  // Sort: directories first, then alphabetical
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const result = sorted.map(entry => {
    const fullPath = dirPath.endsWith('/') ? `${dirPath}${entry.name}` : `${dirPath}/${entry.name}`;
    return {
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? 'directory' : 'file',
    };
  });

  res.json(result);
});

// Get project by id
router.get('/:id', (req: Request, res: Response) => {
  const projectId = parseInt(req.params.id);
  const project = db.prepare(`
    SELECT
      p.*,
      (
        SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id
      ) as task_count,
      (
        SELECT COUNT(*) FROM project_repos pr WHERE pr.project_id = p.id
      ) as repo_count
    FROM projects p
    WHERE p.id = ?
  `).get(projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  res.json(project);
});

// Create project
router.post('/', (req: Request, res: Response) => {
  const { name, description, folder_path, is_active } = req.body as {
    name?: string;
    description?: string;
    folder_path?: string;
    is_active?: number | boolean;
  };

  if (!name || !folder_path) {
    res.status(400).json({ error: 'name and folder_path are required' });
    return;
  }

  const ensuredPath = ensureDirectoryPath(folder_path);
  if (!ensuredPath.ok) {
    res.status(400).json({ error: ensuredPath.error });
    return;
  }

  try {
    const result = db.prepare(`
      INSERT INTO projects (name, description, folder_path, is_active)
      VALUES (?, ?, ?, ?)
    `).run(name.trim(), description?.trim() || null, ensuredPath.normalizedPath, is_active === false || is_active === 0 ? 0 : 1);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: 'Could not create project. Name may already exist.' });
  }
});

// Update project
router.patch('/:id', (req: Request, res: Response) => {
  const projectId = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;

  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const { name, description, folder_path, is_active } = req.body as {
    name?: string;
    description?: string;
    folder_path?: string;
    is_active?: number | boolean;
  };

  let normalizedFolderPath: string | undefined;

  if (folder_path) {
    const ensuredPath = ensureDirectoryPath(folder_path);
    if (!ensuredPath.ok) {
      res.status(400).json({ error: ensuredPath.error });
      return;
    }
    normalizedFolderPath = ensuredPath.normalizedPath;
  }

  try {
    db.prepare(`
      UPDATE projects
      SET
        name = ?,
        description = ?,
        folder_path = ?,
        is_active = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name?.trim() || existing.name,
      description !== undefined ? (description?.trim() || null) : existing.description,
      normalizedFolderPath || existing.folder_path,
      is_active === undefined ? existing.is_active : (is_active === false || is_active === 0 ? 0 : 1),
      projectId
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: 'Could not update project. Name may already exist.' });
  }
});

// Delete project
router.delete('/:id', (req: Request, res: Response) => {
  const projectId = parseInt(req.params.id);
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId) as { id: number } | undefined;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const linkedTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE project_id = ?').get(projectId) as { count: number };
  if (linkedTasks.count > 0) {
    res.status(409).json({ error: 'Project has tasks. Move or delete tasks before deleting project.' });
    return;
  }

  db.prepare('DELETE FROM project_repos WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  res.json({ success: true });
});

export default router;
