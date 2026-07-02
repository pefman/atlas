import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { db } from '../db';

const router = Router();

function isPathWithin(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveProjectLocalPath(localPath: string | null | undefined, projectRootPath: string): {
  ok: boolean;
  resolvedPath: string | null;
  error?: string;
} {
  if (localPath === undefined || localPath === null) {
    return { ok: true, resolvedPath: null };
  }

  const input = localPath.trim();
  if (!input) {
    return { ok: true, resolvedPath: null };
  }

  const projectRoot = path.resolve(projectRootPath);
  let resolvedPath: string;

  if (path.isAbsolute(input)) {
    const absoluteCandidate = path.resolve(input);
    if (isPathWithin(projectRoot, absoluteCandidate)) {
      resolvedPath = absoluteCandidate;
    } else {
      // Treat leading slash as project-root-relative for deterministic safety.
      resolvedPath = input === '/'
        ? projectRoot
        : path.resolve(projectRoot, `.${input}`);
    }
  } else {
    resolvedPath = path.resolve(projectRoot, input);
  }

  if (!isPathWithin(projectRoot, resolvedPath)) {
    return {
      ok: false,
      resolvedPath: null,
      error: `local_path must resolve inside the selected project folder (project_root=${projectRoot}, resolved=${resolvedPath})`,
    };
  }

  return { ok: true, resolvedPath };
}

function runGitClone(remoteUrl: string, targetPath: string, branch?: string | null): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const args = ['clone'];
    if (branch && branch.trim()) {
      args.push('--branch', branch.trim(), '--single-branch');
    }
    args.push(remoteUrl, targetPath);

    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `git clone failed with exit code ${code}`));
    });
  });
}

// Get repos (optionally by project)
router.get('/', (req: Request, res: Response) => {
  const parsedProjectId = typeof req.query.project_id === 'string' ? parseInt(req.query.project_id, 10) : NaN;
  const projectId = Number.isFinite(parsedProjectId) ? parsedProjectId : null;

  const repos = db.prepare(`
    SELECT
      pr.*,
      p.name as project_name,
      p.folder_path as project_folder_path
    FROM project_repos pr
    JOIN projects p ON p.id = pr.project_id
    WHERE (? IS NULL OR pr.project_id = ?)
    ORDER BY pr.updated_at DESC, pr.id DESC
  `).all(projectId, projectId);

  res.json(repos);
});

// Create repo entry
router.post('/', (req: Request, res: Response) => {
  const {
    project_id,
    name,
    provider,
    remote_url,
    local_path,
    default_branch,
    is_active,
  } = req.body as {
    project_id?: number;
    name?: string;
    provider?: string;
    remote_url?: string;
    local_path?: string;
    default_branch?: string;
    is_active?: number | boolean;
  };

  if (!project_id || !name) {
    res.status(400).json({ error: 'project_id and name are required' });
    return;
  }

  const project = db.prepare('SELECT id, folder_path FROM projects WHERE id = ?').get(project_id) as { id: number; folder_path: string } | undefined;
  if (!project) {
    res.status(400).json({ error: 'Invalid project_id' });
    return;
  }

  const localPathResult = resolveProjectLocalPath(local_path, project.folder_path);
  if (!localPathResult.ok) {
    res.status(400).json({ error: localPathResult.error });
    return;
  }

  const result = db.prepare(`
    INSERT INTO project_repos (project_id, name, provider, remote_url, local_path, default_branch, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    project_id,
    name.trim(),
    provider?.trim() || null,
    remote_url?.trim() || null,
    localPathResult.resolvedPath,
    default_branch?.trim() || 'main',
    is_active === false || is_active === 0 ? 0 : 1
  );

  const repo = db.prepare(`
    SELECT pr.*, p.name as project_name, p.folder_path as project_folder_path
    FROM project_repos pr
    JOIN projects p ON p.id = pr.project_id
    WHERE pr.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(repo);
});

// Update repo entry
router.patch('/:id', (req: Request, res: Response) => {
  const repoId = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM project_repos WHERE id = ?').get(repoId) as any;

  if (!existing) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  const {
    project_id,
    name,
    provider,
    remote_url,
    local_path,
    default_branch,
    is_active,
  } = req.body as {
    project_id?: number;
    name?: string;
    provider?: string;
    remote_url?: string;
    local_path?: string;
    default_branch?: string;
    is_active?: number | boolean;
  };

  const nextProjectId = project_id ?? existing.project_id;
  const nextProject = db.prepare('SELECT id, folder_path FROM projects WHERE id = ?').get(nextProjectId) as { id: number; folder_path: string } | undefined;
  if (!nextProject) {
    res.status(400).json({ error: 'Invalid project_id' });
    return;
  }

  const nextLocalPathInput = local_path !== undefined ? local_path : existing.local_path;
  const localPathResult = resolveProjectLocalPath(nextLocalPathInput, nextProject.folder_path);
  if (!localPathResult.ok) {
    res.status(400).json({ error: localPathResult.error });
    return;
  }

  db.prepare(`
    UPDATE project_repos
    SET
      project_id = ?,
      name = ?,
      provider = ?,
      remote_url = ?,
      local_path = ?,
      default_branch = ?,
      is_active = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nextProjectId,
    name?.trim() || existing.name,
    provider !== undefined ? (provider?.trim() || null) : existing.provider,
    remote_url !== undefined ? (remote_url?.trim() || null) : existing.remote_url,
    localPathResult.resolvedPath,
    default_branch?.trim() || existing.default_branch,
    is_active === undefined ? existing.is_active : (is_active === false || is_active === 0 ? 0 : 1),
    repoId
  );

  const repo = db.prepare(`
    SELECT pr.*, p.name as project_name, p.folder_path as project_folder_path
    FROM project_repos pr
    JOIN projects p ON p.id = pr.project_id
    WHERE pr.id = ?
  `).get(repoId);

  res.json(repo);
});

// Delete repo entry
router.delete('/:id', (req: Request, res: Response) => {
  const repoId = parseInt(req.params.id);
  const repo = db.prepare('SELECT id FROM project_repos WHERE id = ?').get(repoId) as { id: number } | undefined;

  if (!repo) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  db.prepare('DELETE FROM project_repos WHERE id = ?').run(repoId);
  res.json({ success: true });
});

// Clone repo into local workspace path
router.post('/:id/clone', async (req: Request, res: Response) => {
  const repoId = parseInt(req.params.id, 10);
  console.log(`[Repos] Clone request for repo ${repoId}`);

  if (!Number.isFinite(repoId)) {
    console.log(`[Repos] Invalid repo id: ${req.params.id}`);
    res.status(400).json({ error: 'Invalid repo id' });
    return;
  }

  const repo = db.prepare(`
    SELECT
      pr.*,
      p.folder_path as project_folder_path
    FROM project_repos pr
    JOIN projects p ON p.id = pr.project_id
    WHERE pr.id = ?
  `).get(repoId) as {
    id: number;
    name: string;
    remote_url: string | null;
    local_path: string | null;
    default_branch: string | null;
    project_folder_path: string;
  } | undefined;

  if (!repo) {
    console.log(`[Repos] Repo not found: ${repoId}`);
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  console.log(`[Repos] Repo details: ${repo.name}, remote: ${repo.remote_url}, branch: ${repo.default_branch}`);

  if (!repo.remote_url || !repo.remote_url.trim()) {
    console.log(`[Repos] No remote URL configured for repo ${repoId}`);
    res.status(400).json({ error: 'Repo does not have a remote_url configured' });
    return;
  }

  const desiredLocalPath = repo.local_path && repo.local_path.trim()
    ? repo.local_path
    : `/${repo.name}`;
  console.log(`[Repos] Resolving local path: ${desiredLocalPath} (project: ${repo.project_folder_path})`);
  const resolvedLocalPath = resolveProjectLocalPath(desiredLocalPath, repo.project_folder_path);
  if (!resolvedLocalPath.ok || !resolvedLocalPath.resolvedPath) {
    console.log(`[Repos] Invalid local path: ${resolvedLocalPath.error}`);
    res.status(400).json({ error: resolvedLocalPath.error || 'Invalid local_path' });
    return;
  }

  const targetPath = resolvedLocalPath.resolvedPath;
  const gitPath = path.join(targetPath, '.git');

  console.log(`[Repos] Target path: ${targetPath}`);

  if (fs.existsSync(gitPath)) {
    console.log(`[Repos] Git repo already exists at ${targetPath}`);
    res.status(409).json({ error: 'Target path is already a git repository', local_path: targetPath });
    return;
  }

  if (fs.existsSync(targetPath)) {
    const entries = fs.readdirSync(targetPath);
    if (entries.length > 0) {
      console.log(`[Repos] Target path not empty: ${entries.join(', ')}`);
      res.status(409).json({ error: 'Target path already exists and is not empty', local_path: targetPath });
      return;
    }
    console.log(`[Repos] Target path exists but is empty`);
  } else {
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      console.log(`[Repos] Created directory: ${path.dirname(targetPath)}`);
    } catch {
      console.log(`[Repos] Failed to create directory: ${path.dirname(targetPath)}`);
      res.status(500).json({ error: 'Could not prepare target directory for clone' });
      return;
    }
  }

  console.log(`[Repos] Starting git clone: ${repo.remote_url.trim()} → ${targetPath}${repo.default_branch ? ` (branch: ${repo.default_branch})` : ''}`);
  try {
    await runGitClone(repo.remote_url.trim(), targetPath, repo.default_branch);
    console.log(`[Repos] Git clone completed successfully for ${repo.name}`);

    db.prepare(`
      UPDATE project_repos
      SET local_path = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(targetPath, repoId);

    console.log(`[Repos] Updated local_path for repo ${repoId}: ${targetPath}`);
    res.json({ success: true, local_path: targetPath });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Clone failed';
    console.log(`[Repos] Git clone failed: ${errorMsg}`);
    res.status(500).json({
      error: errorMsg,
      local_path: targetPath,
    });
  }
});

// Get public keys for a repo
router.get('/:id/keys', (req: Request, res: Response) => {
  const repoId = parseInt(req.params.id);
  const keys = db.prepare(`
    SELECT * FROM project_repo_public_keys
    WHERE repo_id = ?
    ORDER BY created_at DESC
  `).all(repoId);
  res.json(keys);
});

// Add public key to repo
router.post('/:id/keys', (req: Request, res: Response) => {
  const repoId = parseInt(req.params.id);
  const repo = db.prepare('SELECT id FROM project_repos WHERE id = ?').get(repoId) as { id: number } | undefined;

  if (!repo) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  const { name, public_key, key_type } = req.body as {
    name?: string;
    public_key?: string;
    key_type?: string;
  };

  if (!name || !public_key) {
    res.status(400).json({ error: 'name and public_key are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO project_repo_public_keys (repo_id, name, public_key, key_type)
    VALUES (?, ?, ?, ?)
  `).run(repoId, name.trim(), public_key.trim(), key_type || 'ssh');

  const key = db.prepare('SELECT * FROM project_repo_public_keys WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(key);
});

// Update public key
router.patch('/:repoId/keys/:keyId', (req: Request, res: Response) => {
  const keyId = parseInt(req.params.keyId);
  const existing = db.prepare('SELECT * FROM project_repo_public_keys WHERE id = ?').get(keyId) as any;

  if (!existing) {
    res.status(404).json({ error: 'Public key not found' });
    return;
  }

  const { name, public_key, key_type, is_active } = req.body as {
    name?: string;
    public_key?: string;
    key_type?: string;
    is_active?: number | boolean;
  };

  db.prepare(`
    UPDATE project_repo_public_keys
    SET
      name = ?,
      public_key = ?,
      key_type = ?,
      is_active = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name?.trim() || existing.name,
    public_key !== undefined ? (public_key?.trim() || null) : existing.public_key,
    key_type !== undefined ? (key_type || existing.key_type) : existing.key_type,
    is_active === undefined ? existing.is_active : (is_active === false || is_active === 0 ? 0 : 1),
    keyId
  );

  const key = db.prepare('SELECT * FROM project_repo_public_keys WHERE id = ?').get(keyId);
  res.json(key);
});

// Delete public key
router.delete('/:repoId/keys/:keyId', (req: Request, res: Response) => {
  const keyId = parseInt(req.params.keyId);
  const key = db.prepare('SELECT id FROM project_repo_public_keys WHERE id = ?').get(keyId) as { id: number } | undefined;

  if (!key) {
    res.status(404).json({ error: 'Public key not found' });
    return;
  }

  db.prepare('DELETE FROM project_repo_public_keys WHERE id = ?').run(keyId);
  res.json({ success: true });
});

export default router;
