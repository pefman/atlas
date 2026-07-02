import { useEffect, useMemo, useState } from 'react';
import { AppPage } from '@/components/layout/AppPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import type { Project, RepoAsset } from '@/types';
import { toast } from 'sonner';
import { Key, Plus, X, Edit2, Save, Copy, Check, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type PublicKey = {
  id: number;
  repo_id: number;
  name: string;
  public_key: string;
  key_type: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function parsePublicKeyMetadata(rawValue: string): { keyType: string | null; keyName: string | null } {
  const trimmed = rawValue.trim();
  if (!trimmed) return { keyType: null, keyName: null };

  const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || '';
  if (!firstLine) return { keyType: null, keyName: null };

  if (firstLine.includes('BEGIN PGP PUBLIC KEY BLOCK')) {
    return { keyType: 'gpg', keyName: null };
  }

  const parts = firstLine.split(/\s+/);
  if (parts.length < 2) {
    return { keyType: null, keyName: null };
  }

  const algorithm = parts[0].toLowerCase();
  let keyType: string | null = null;

  if (algorithm === 'ssh-rsa') {
    keyType = 'ssh-rsa';
  } else if (algorithm === 'ssh-ed25519' || algorithm.startsWith('sk-ssh-ed25519')) {
    keyType = 'ssh-ed25519';
  } else if (algorithm.startsWith('ecdsa-') || algorithm.startsWith('ssh-') || algorithm.startsWith('sk-ecdsa-')) {
    keyType = 'ssh';
  }

  const keyName = parts.length > 2 ? parts.slice(2).join(' ').trim() : null;
  return {
    keyType,
    keyName: keyName || null,
  };
}

function normalizeAbsolutePath(rawPath: string): string {
  const isAbsolute = rawPath.startsWith('/');
  const segments = rawPath.split('/');
  const stack: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(segment);
  }

  return `${isAbsolute ? '/' : ''}${stack.join('/')}` || '/';
}

function resolveLocalPathPreview(projectRoot: string | undefined, localPathInput: string): string | null {
  if (!projectRoot) return null;

  const trimmedRoot = projectRoot.trim();
  const trimmedInput = localPathInput.trim();
  if (!trimmedRoot || !trimmedInput) return null;

  const normalizedRoot = normalizeAbsolutePath(trimmedRoot);

  if (trimmedInput.startsWith('/')) {
    const normalizedInput = normalizeAbsolutePath(trimmedInput);
    if (normalizedInput === normalizedRoot || normalizedInput.startsWith(`${normalizedRoot}/`)) {
      return normalizedInput;
    }
    const relativeFromRoot = trimmedInput.replace(/^\/+/, '');
    return normalizeAbsolutePath(`${normalizedRoot}/${relativeFromRoot}`);
  }

  return normalizeAbsolutePath(`${normalizedRoot}/${trimmedInput}`);
}

export function ReposPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<RepoAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingRepoId, setEditingRepoId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [isEditing, setIsEditing] = useState(false);
  const [repoKeys, setRepoKeys] = useState<Record<number, PublicKey[]>>({});
  const [keyFormOpen, setKeyFormOpen] = useState<number | null>(null);
  const [keyName, setKeyName] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [keyType, setKeyType] = useState('ssh');
  const [autoDetectedKeyName, setAutoDetectedKeyName] = useState('');
  const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);
  const [cloningRepoId, setCloningRepoId] = useState<number | null>(null);
  const [cloneStatus, setCloneStatus] = useState<Map<number, { type: 'loading' | 'success' | 'error'; message: string }>>(new Map());

  const selectedProject = useMemo(() => projects.find(p => String(p.id) === projectId), [projects, projectId]);

  const computedLocalPath = useMemo(() => {
    if (isEditing) return localPath;
    const projectRoot = selectedProject?.folder_path?.trim() || '';
    if (!projectRoot) return '';

    const normalizedRoot = projectRoot.replace(/\/+$/, '') || '/';
    const normalizedName = name.trim().replace(/^\/+/, '');
    if (!normalizedName) return normalizedRoot;

    return normalizedRoot === '/'
      ? `/${normalizedName}`
      : `${normalizedRoot}/${normalizedName}`;
  }, [isEditing, localPath, name, selectedProject]);

  const currentLocalPathInput = isEditing ? localPath : computedLocalPath;
  const resolvedLocalPathPreview = useMemo(
    () => resolveLocalPathPreview(selectedProject?.folder_path, currentLocalPathInput),
    [selectedProject?.folder_path, currentLocalPathInput]
  );

  const fetchProjects = async () => {
    const response = await fetch('/api/projects');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as Project[];
    setProjects(data);
  };

  const fetchRepos = async () => {
    const response = await fetch('/api/repos');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as RepoAsset[];
    setRepos(data);
  };

  const fetchRepoKeys = async (repoId: number) => {
    try {
      const response = await fetch(`/api/repos/${repoId}/keys`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as PublicKey[];
      setRepoKeys(prev => ({ ...prev, [repoId]: data }));
    } catch (error) {
      console.error('Failed to load public keys:', error);
    }
  };

  const handleAddKey = async (repoId: number) => {
    if (!keyName.trim() || !keyValue.trim()) {
      toast.error('Key name and public key are required');
      return;
    }

    try {
      const response = await fetch(`/api/repos/${repoId}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyName.trim(),
          public_key: keyValue.trim(),
          key_type: keyType,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      setKeyName('');
      setKeyValue('');
      setKeyType('ssh');
      setKeyFormOpen(null);
      await fetchRepoKeys(repoId);
      toast.success('Public key added');
    } catch (error) {
      console.error('Failed to add public key:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add public key');
    }
  };

  const handleUpdateKey = async (repoId: number, keyId: number) => {
    if (!keyName.trim() || !keyValue.trim()) {
      toast.error('Key name and public key are required');
      return;
    }

    try {
      const response = await fetch(`/api/repos/${repoId}/keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyName.trim(),
          public_key: keyValue.trim(),
          key_type: keyType,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      setEditingKeyId(null);
      setKeyName('');
      setKeyValue('');
      setKeyType('ssh');
      await fetchRepoKeys(repoId);
      toast.success('Public key updated');
    } catch (error) {
      console.error('Failed to update public key:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update public key');
    }
  };

  const handleDeleteKey = async (repoId: number, keyId: number) => {
    const confirmed = window.confirm('Delete this public key?');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/repos/${repoId}/keys/${keyId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      await fetchRepoKeys(repoId);
      toast.success('Public key deleted');
    } catch (error) {
      console.error('Failed to delete public key:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete public key');
    }
  };

  const startEditKey = (key: PublicKey) => {
    setEditingKeyId(key.id);
    setKeyName(key.name);
    setKeyValue(key.public_key);
    setKeyType(key.key_type);
    setAutoDetectedKeyName('');
  };

  const resetKeyForm = () => {
    setEditingKeyId(null);
    setKeyName('');
    setKeyValue('');
    setKeyType('ssh');
    setAutoDetectedKeyName('');
  };

  const handleKeyValueChange = (value: string) => {
    setKeyValue(value);

    const metadata = parsePublicKeyMetadata(value);
    if (metadata.keyType) {
      setKeyType(metadata.keyType);
    }

    if (metadata.keyName && (!keyName.trim() || keyName === autoDetectedKeyName)) {
      setKeyName(metadata.keyName);
      setAutoDetectedKeyName(metadata.keyName);
    }
  };

  const copyToClipboard = async (keyId: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchProjects(), fetchRepos()]);
      } catch (error) {
        console.error('Failed to load repos page data:', error);
        toast.error('Failed to load repos data');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    repos.forEach(repo => {
      void fetchRepoKeys(repo.id);
    });
  }, [repos]);

  useEffect(() => {
    if (keyFormOpen === null) {
      resetKeyForm();
    }
  }, [keyFormOpen]);

  const grouped = useMemo(() => {
    const map = new Map<number, RepoAsset[]>();
    for (const repo of repos) {
      const list = map.get(repo.project_id) || [];
      list.push(repo);
      map.set(repo.project_id, list);
    }
    return map;
  }, [repos]);

  const handleCreate = async () => {
    if (!projectId || !name.trim()) {
      toast.error('Project and name are required');
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: parseInt(projectId),
          name: name.trim(),
          remote_url: remoteUrl.trim() || null,
          local_path: computedLocalPath.trim() || '/',
          default_branch: defaultBranch.trim() || 'main',
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      setName('');
      setRemoteUrl('');
      setLocalPath('');
      setDefaultBranch('main');
      await fetchRepos();
      toast.success('Repo linked');
    } catch (error) {
      console.error('Failed to create repo link:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create repo link');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (repo: RepoAsset) => {
    setIsEditing(true);
    setEditingRepoId(repo.id);
    setProjectId(String(repo.project_id));
    setName(repo.name);
    setRemoteUrl(repo.remote_url || '');
    setLocalPath(repo.local_path || '');
    setDefaultBranch(repo.default_branch || 'main');
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingRepoId(null);
    setProjectId('');
    setName('');
    setRemoteUrl('');
    setLocalPath('');
    setDefaultBranch('main');
  };

  const handleSaveEdit = async () => {
    if (!editingRepoId || !projectId || !name.trim()) {
      toast.error('Project and name are required');
      return;
    }

    try {
      setSavingEdit(true);
      const response = await fetch(`/api/repos/${editingRepoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: parseInt(projectId, 10),
          name: name.trim(),
          remote_url: remoteUrl.trim() || null,
          local_path: localPath.trim() || null,
          default_branch: defaultBranch.trim() || 'main',
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      await fetchRepos();
      resetForm();
      toast.success('Repo updated');
    } catch (error) {
      console.error('Failed to update repo:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update repo');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (repoId: number) => {
    const confirmed = window.confirm('Remove this repo link from project?');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/repos/${repoId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }
      await fetchRepos();
      toast.success('Repo removed');
    } catch (error) {
      console.error('Failed to delete repo:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove repo');
    }
  };

  const handleCloneRepo = async (repo: RepoAsset) => {
    if (!repo.remote_url?.trim()) {
      toast.error('Remote URL is required to clone this repo');
      return;
    }

    try {
      setCloningRepoId(repo.id);
      setCloneStatus(prev => new Map(prev).set(repo.id, { type: 'loading', message: 'Cloning...' }));
      const response = await fetch(`/api/repos/${repo.id}/clone`, { method: 'POST' });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      await fetchRepos();
      setCloneStatus(prev => new Map(prev).set(repo.id, { type: 'success', message: `Cloned to ${body?.local_path || repo.local_path || 'workspace path'}` }));
      setTimeout(() => {
        setCloneStatus(prev => {
          const next = new Map(prev);
          next.delete(repo.id);
          return next;
        });
      }, 5000);
    } catch (error) {
      console.error('Failed to clone repo:', error);
      setCloneStatus(prev => new Map(prev).set(repo.id, { type: 'error', message: error instanceof Error ? error.message : 'Failed to clone repo' }));
    } finally {
      setCloningRepoId(null);
    }
  };

  return (
    <AppPage
      title="Repos"
      subtitle="Attach repository assets to projects. Projects can exist without repos."
    >
      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Projects Yet</CardTitle>
            <CardDescription>
              You need to create a project before linking repositories.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/projects'}>
              Go to Projects
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Link Repo</CardTitle>
              <CardDescription>
                Add an optional repository reference to a project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={(value) => setProjectId(value ?? '')}>
                <SelectTrigger>
                  {projectId ? (
                    <span>{projects.find(p => String(p.id) === projectId)?.name || projectId}</span>
                  ) : (
                    <SelectValue placeholder="Choose Project" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="atlas-main" />
            </div>

            <div className="space-y-2">
              <Label>Remote URL (optional)</Label>
              <Input value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} placeholder="https://github.com/org/repo" />
            </div>

            <div className="space-y-2">
              <Label>Local Path (optional)</Label>
              <Input
                value={computedLocalPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="/home/pefman/git/atlas"
                disabled={!isEditing}
                className={!isEditing ? 'text-muted-foreground' : ''}
              />
              {!isEditing && computedLocalPath && (
                <p className="text-xs text-muted-foreground">Auto-updates from repo name under the selected project root.</p>
              )}
              {selectedProject?.folder_path && (
                <p className="text-xs text-muted-foreground">
                  Project root: {selectedProject.folder_path}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Rule: path must stay inside the selected project root. Leading / is treated as project-root-relative unless already inside that root.
              </p>
              {resolvedLocalPathPreview && (
                <p className="text-xs text-muted-foreground">
                  Resolved path: {resolvedLocalPathPreview}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Default Branch</Label>
              <Input value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} placeholder="main" />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => editingRepoId ? void handleSaveEdit() : void handleCreate()}
                disabled={savingEdit || !projectId || !name.trim()}
              >
                {editingRepoId ? (savingEdit ? 'Saving...' : 'Save Changes') : (creating ? 'Linking...' : 'Link Repo')}
              </Button>
              {editingRepoId && (
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Repo Assets</CardTitle>
            <CardDescription>
              Repositories grouped by project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading repos...</p>}
            {!loading && repos.length === 0 && (
              <p className="text-sm text-muted-foreground">No repo assets linked yet.</p>
            )}

            {projects.map((project) => {
              const projectRepos = grouped.get(project.id) || [];
              if (projectRepos.length === 0) return null;

              return (
                <div key={project.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{project.name}</p>
                    <Badge variant="secondary">{projectRepos.length} repo(s)</Badge>
                  </div>
                  {projectRepos.map((repo) => (
                    <div key={repo.id} className="rounded-md border p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{repo.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {repo.default_branch}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cloningRepoId === repo.id || !repo.remote_url}
                            onClick={() => void handleCloneRepo(repo)}
                          >
                            {cloningRepoId === repo.id ? 'Cloning...' : 'Clone Repo'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (keyFormOpen === repo.id) {
                                setKeyFormOpen(null);
                              } else {
                                setKeyFormOpen(repo.id);
                                void fetchRepoKeys(repo.id);
                              }
                            }}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            Keys
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => void handleDelete(repo.id)}>
                            Remove
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => startEdit(repo)}>
                            Edit
                          </Button>
                        </div>
                      </div>
                      {repo.remote_url && (
                        <p className="truncate text-xs text-muted-foreground">{repo.remote_url}</p>
                      )}
                      {repo.local_path && (
                        <p className="truncate text-xs text-muted-foreground">{repo.local_path}</p>
                      )}

                      {cloneStatus.get(repo.id) && (() => {
                        const status = cloneStatus.get(repo.id)!;
                        if (status.type === 'loading') {
                          return (
                            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>{status.message}</span>
                            </div>
                          );
                        }
                        if (status.type === 'success') {
                          return (
                            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{status.message}</span>
                            </div>
                          );
                        }
                        if (status.type === 'error') {
                          return (
                            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                              <AlertCircle className="h-3 w-3" />
                              <span className="truncate">{status.message}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {keyFormOpen === repo.id && (
                        <div className="mt-2 space-y-2 border-t pt-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">Public Keys</p>
                          </div>

                          {editingKeyId !== null ? (
                            <div className="space-y-2 p-2 border rounded">
                              <div className="space-y-1">
                                <Label className="text-xs">Key Name</Label>
                                <Input
                                  value={keyName}
                                  onChange={(e) => setKeyName(e.target.value)}
                                  placeholder="e.g., deploy-server"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Public Key</Label>
                                <Textarea
                                  value={keyValue}
                                  onChange={(e) => handleKeyValueChange(e.target.value)}
                                  placeholder="ssh-rsa AAAA..."
                                  rows={3}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Key Type</Label>
                                <Select value={keyType} onValueChange={(v) => setKeyType(v ?? 'ssh')}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ssh">SSH</SelectItem>
                                    <SelectItem value="gpg">GPG</SelectItem>
                                    <SelectItem value="ssh-ed25519">SSH Ed25519</SelectItem>
                                    <SelectItem value="ssh-rsa">SSH RSA</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (editingKeyId === -1) {
                                      void handleAddKey(repo.id);
                                      return;
                                    }
                                    void handleUpdateKey(repo.id, editingKeyId);
                                  }}
                                >
                                  <Save className="h-3 w-3 mr-1" /> {editingKeyId === -1 ? 'Add Key' : 'Save'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={resetKeyForm}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {repoKeys[repo.id]?.map((key) => (
                                <div key={key.id} className="flex items-center justify-between p-2 border rounded text-xs">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium">{key.name}</p>
                                    <p className="text-muted-foreground truncate font-mono">{key.public_key}</p>
                                    <Badge variant="secondary" className="ml-1">{key.key_type}</Badge>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(key.id, key.public_key)}
                                    >
                                      {copiedKeyId === key.id ? (
                                        <Check className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => startEditKey(key)}>
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteKey(repo.id, key.id)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {(!repoKeys[repo.id] || repoKeys[repo.id].length === 0) && (
                                <p className="text-xs text-muted-foreground py-2">No public keys added yet.</p>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setEditingKeyId(-1);
                                  setKeyName('');
                                  setKeyValue('');
                                  setKeyType('ssh');
                                  setAutoDetectedKeyName('');
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add New Key
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
      )}
    </AppPage>
  );
}
