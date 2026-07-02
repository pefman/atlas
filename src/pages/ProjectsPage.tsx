import { useEffect, useState } from 'react';
import { AppPage } from '@/components/layout/AppPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { Project } from '@/types';
import { toast } from 'sonner';
import { Folder, File, ChevronRight, ChevronDown, FolderOpen, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type TreeNode = {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: TreeNode[];
};

function listTree(cwd: string): Promise<TreeNode[]> {
  return fetch(`/api/projects/ls?path=${encodeURIComponent(cwd)}`)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((data: any[]) => {
      const root: TreeNode[] = [];
      for (const item of data) {
        if (item.type === 'directory') {
          root.push({ name: item.name, path: item.path, type: 'dir', children: [] });
        }
      }
      return root;
    });
}

function listDir(path: string): Promise<TreeNode[]> {
  return fetch(`/api/projects/ls?path=${encodeURIComponent(path)}`)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((data: any[]) =>
      data
        .filter((item: any) => item.type === 'directory')
        .map((item: any) => ({
          name: item.name,
          path: item.path,
          type: 'dir' as const,
          children: [],
        }))
    );
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [selectedRootPath, setSelectedRootPath] = useState('');

  // Folder picker state
  const [cwd, setCwd] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [appCwd, setAppCwd] = useState<string>('');

  useEffect(() => {
    fetch('/api/projects/cwd')
      .then(r => r.json())
      .then(data => {
        setAppCwd(data.cwd);
        setSelectedRootPath(data.cwd);
        setFolderPath(data.cwd);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editingProjectId !== null) return;

    const base = (selectedRootPath || appCwd || '').trim();
    if (!base) {
      setFolderPath('');
      return;
    }

    const normalizedBase = base.replace(/\/+$/, '') || '/';
    const normalizedName = name.trim().replace(/^\/+|\/+$/g, '');

    if (!normalizedName) {
      setFolderPath(normalizedBase);
      return;
    }

    setFolderPath(normalizedBase === '/' ? `/${normalizedName}` : `${normalizedBase}/${normalizedName}`);
  }, [name, selectedRootPath, appCwd, editingProjectId]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as Project[];
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProjects();
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const basePath = (selectedRootPath && selectedRootPath.trim()) || appCwd || '/';
    setPickerLoading(true);
    setCwd(basePath);
    void listTree(basePath)
      .then(setTree)
      .catch(() => toast.error('Failed to load folder tree'))
      .finally(() => setPickerLoading(false));
  }, [pickerOpen, selectedRootPath, appCwd]);

  const toggleDir = async (path: string, children: TreeNode[]) => {
    if (expandedDirs.has(path)) {
      setExpandedDirs(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } else {
      const newChildren = children.length > 0 ? children : await listDir(path);
      setTree(prev => {
        const next = [...prev];
        const idx = next.findIndex(n => n.path === path);
        if (idx >= 0) {
          next[idx] = { ...next[idx], children: newChildren };
        }
        return next;
      });
      setExpandedDirs(prev => new Set(prev).add(path));
    }
  };

  const goUp = async () => {
    if (!cwd || cwd === '/') return;
    setPickerLoading(true);
    try {
      const parent = cwd.slice(0, cwd.lastIndexOf('/')) || '/';
      const data = await listTree(parent);
      setTree(data);
      setCwd(parent);
      setExpandedDirs(new Set());
    } catch {
      toast.error('Cannot navigate up');
    } finally {
      setPickerLoading(false);
    }
  };

  const renderTree = (nodes: TreeNode[], depth = 0) => {
    return nodes.map(node => {
      if (node.type === 'file') return null;
      const isExpanded = expandedDirs.has(node.path);
      const childCount = (node.children || []).length;
      return (
        <div key={node.path}>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-muted text-sm select-none"
            style={{ paddingLeft: depth * 16 + 8 }}
            onClick={() => {
              setSelectedRootPath(node.path);
              setPickerOpen(false);
              void toggleDir(node.path, node.children || []);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-400" />
            ) : (
              <Folder className="h-4 w-4 text-yellow-500" />
            )}
            <span className="truncate">{node.name}</span>
            {childCount > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{childCount}</span>
            )}
          </div>
          {isExpanded && node.children && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || !folderPath.trim()) {
      toast.error('Name and folder path are required');
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          folder_path: folderPath.trim(),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      setName('');
      setDescription('');
      setFolderPath('');
      await fetchProjects();
      toast.success('Project created');
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (project: Project) => {
    setEditingProjectId(project.id);
    setName(project.name);
    setDescription(project.description || '');
    setSelectedRootPath(project.folder_path);
    setFolderPath(project.folder_path);
  };

  const resetForm = () => {
    setEditingProjectId(null);
    setName('');
    setDescription('');
    setSelectedRootPath(appCwd || '');
    setFolderPath(appCwd || '');
  };

  const handleSaveEdit = async () => {
    if (!editingProjectId || !name.trim() || !folderPath.trim()) {
      toast.error('Name and folder path are required');
      return;
    }

    try {
      setSavingEdit(true);
      const response = await fetch(`/api/projects/${editingProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          folder_path: folderPath.trim(),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      await fetchProjects();
      resetForm();
      toast.success('Project updated');
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update project');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (projectId: number) => {
    const confirmed = window.confirm('Delete this project? Tasks must be moved or deleted first.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }
      await fetchProjects();
      toast.success('Project deleted');
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  return (
    <AppPage
      title="Projects"
      subtitle="Projects are folder-scoped containers for tasks and repo assets."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
            <CardDescription>
              Set the folder path used as project work context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="atlas-web" />
            </div>
            <div className="space-y-2">
              <Label>Folder Path</Label>
              <div className="flex gap-2">
                <Input
                  value={folderPath}
                  readOnly
                  placeholder={appCwd || 'Loading directory...'}
                  className="flex-1 bg-muted/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPickerOpen(!pickerOpen)}
                  disabled={pickerLoading}
                >
                  {pickerLoading ? '...' : <Folder className="h-4 w-4" />}
                </Button>
              </div>
              {pickerOpen && (
                <div className="mt-2 border rounded-md p-2 max-h-60 overflow-y-auto">
                  {pickerLoading ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : (
                    <>
                      <div
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-sm mb-1 cursor-pointer hover:bg-muted/50"
                        style={{ backgroundColor: appCwd && folderPath === appCwd ? 'hsl(var(--primary))' : undefined, color: appCwd && folderPath === appCwd ? 'hsl(var(--primary-foreground))' : undefined }}
                        onClick={() => {
                          setSelectedRootPath(appCwd || '/');
                          setPickerOpen(false);
                        }}
                      >
                        <Folder className="h-4 w-4" />
                        <span className="font-medium">{appCwd || 'App Directory'}</span>
                      </div>
                      {tree.length === 0 && !pickerLoading ? (
                        <p className="text-xs text-muted-foreground">Empty directory</p>
                      ) : (
                        renderTree(tree)
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Short project context" />
            </div>
            <Button onClick={() => void handleCreate()} disabled={creating || !name.trim() || !folderPath.trim()}>
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
            {editingProjectId && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void handleSaveEdit()}
                  disabled={savingEdit || !name.trim() || !folderPath.trim()}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel Edit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Library</CardTitle>
            <CardDescription>
              Active projects used for task and repo organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading projects...</p>}
            {!loading && projects.length === 0 && (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            )}
            {projects.map((project) => (
              <div key={project.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.folder_path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Tasks {project.task_count || 0}</Badge>
                    <Badge variant="secondary">Repos {project.repo_count || 0}</Badge>
                    <Button variant="outline" size="sm" onClick={() => startEdit(project)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => void handleDelete(project.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                {project.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppPage>
  );
}
