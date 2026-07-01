import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2, Play, Trash2, Brain, ListTodo, CheckCircle2, Clock } from 'lucide-react';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ConversationView } from '@/components/execution/ConversationView';
import { TaskStatus } from '@/types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { priorityColors } from '@/lib/priority';
import { AppPage } from '@/components/layout/AppPage';

interface Subtask {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: TaskStatus;
  priority: 'high' | 'medium' | 'low';
}

interface Task {
  id: number;
  title: string;
  description: string;
  role_name: string;
  role_description: string;
  status: TaskStatus;
  ceo_status?: string;
  decomposed_at?: string;
  created_at?: string;
  subtasks: Subtask[];
}

function getCeoStatusText(ceoStatus: string): string {
  switch (ceoStatus) {
    case 'decomposing':
      return 'CEO is analyzing task...';
    case 'decomposed':
      return 'Task decomposed';
    case 'error':
      return 'Decomposition failed';
    default:
      return '';
  }
}

function getCeoStatusColor(ceoStatus: string): string {
  switch (ceoStatus) {
    case 'decomposing':
      return 'text-[var(--status-info-foreground)]';
    case 'decomposed':
      return 'text-[var(--status-success-foreground)]';
    case 'error':
      return 'text-[var(--status-danger-foreground)]';
    default:
      return '';
  }
}

function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case 'backlog':
      return <Clock className="h-4 w-4" />;
    case 'in_progress':
      return <Brain className="h-4 w-4" />;
    case 'review':
      return <ListTodo className="h-4 w-4" />;
    case 'done':
      return <CheckCircle2 className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

interface TaskDetailProps {
  taskId: number;
  onBack: () => void;
}

export function TaskDetail({ taskId, onBack }: TaskDetailProps) {
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setTask(data);
    } catch (error) {
      console.error('Failed to fetch task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      setExecuting(true);
      const response = await fetch(`/api/execute/task/${taskId}`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      toast.success('Task execution started');
      await fetchTask();
    } catch (error) {
      console.error('Failed to execute task:', error);
      toast.error('Failed to execute task');
    } finally {
      setExecuting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      toast.success('Task deleted');
      navigate('/');
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus) return;
    try {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || `HTTP ${response.status}`;
        throw new Error(message);
      }
      setTask(t => t ? { ...t, status: newStatus as TaskStatus } : t);
      toast.success('Status updated');
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  const getProgress = () => {
    if (!task || task.subtasks.length === 0) return 0;
    const done = task.subtasks.filter(s => s.status === 'done').length;
    return (done / task.subtasks.length) * 100;
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="page-container">
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-destructive">Task not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppPage
      top={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="cursor-pointer hover:text-primary">
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{task.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      title={
        <span className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} className="size-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="truncate">{task.title}</span>
          {getStatusIcon(task.status)}
        </span>
      }
      subtitle={
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Select value={task.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-6 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          {task.ceo_status === 'decomposed' && <Badge>Decomposed</Badge>}
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleExecute} disabled={executing}>
            <Play className="mr-1 h-4 w-4" />
            {executing ? 'Starting...' : 'Execute'}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      }
    >

      {/* CEO Status */}
      {task.ceo_status === 'decomposing' && (
        <div className="status-banner status-banner-info flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
          <div>
            <span className={`text-sm font-medium ${getCeoStatusColor(task.ceo_status)}`}>
              {getCeoStatusText(task.ceo_status)}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              The CEO is analyzing and decomposing your task into subtasks.
            </p>
          </div>
        </div>
      )}

      {task.ceo_status === 'decomposed' && (
        <div className="status-banner status-banner-success flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <span className="text-sm font-medium">
              Task decomposed successfully
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              {task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''} created
              {task.decomposed_at && ` at ${new Date(task.decomposed_at).toLocaleString()}`}
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      {task.subtasks.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="tracking-tight">Progress</span>
              <span className="text-sm font-normal text-muted-foreground">
                {task.subtasks.filter(s => s.status === 'done').length} / {task.subtasks.length} subtasks
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={getProgress()} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          <TabsTrigger value="logs">Execution Logs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-base tracking-tight">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-muted-foreground">{task.description}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Assigned Role:</span>
                  <p className="font-medium">{task.role_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="secondary">{task.status}</Badge>
                </div>
                {task.decomposed_at && (
                  <div>
                    <span className="text-muted-foreground">Decomposed at:</span>
                    <p className="font-medium">{new Date(task.decomposed_at).toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">{task.created_at ? new Date(task.created_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              {task.role_description && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {task.role_description}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subtasks Tab */}
        <TabsContent value="subtasks">
          {task.subtasks.length === 0 ? (
            <Card size="sm">
              <CardContent className="flex items-center justify-center h-40">
                <div className="text-center">
                  <Brain className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">No subtasks yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The CEO will create subtasks when you execute this task
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <KanbanBoard taskId={taskId} />
          )}
        </TabsContent>

        {/* Execution Logs Tab */}
        <TabsContent value="logs">
          {task.subtasks.length === 0 ? (
            <Card size="sm">
              <CardContent className="flex items-center justify-center h-40">
                <div className="text-center">
                  <ListTodo className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">No execution logs yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Logs will appear after subtasks are executed
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ConversationView subtasks={task.subtasks} priorityColors={priorityColors} />
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone and will delete all associated subtasks and execution logs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}
