import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Loader2, Play, Trash2 } from 'lucide-react';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ExecutionLogs } from '@/components/execution/ExecutionLogs';
import { TaskStatus } from '@/types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Subtask {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: TaskStatus;
}

interface Task {
  id: number;
  title: string;
  description: string;
  role_name: string;
  role_description: string;
  status: TaskStatus;
  ceo_status?: string;
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
      return 'text-blue-500';
    case 'decomposed':
      return 'text-green-500';
    case 'error':
      return 'text-red-500';
    default:
      return '';
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

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-destructive">Task not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-2xl font-bold">{task.title}</h2>
        <Badge>{task.status}</Badge>
        <Button size="sm" onClick={handleExecute} disabled={executing}>
          <Play className="h-4 w-4 mr-1" />
          {executing ? 'Starting...' : 'Execute'}
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{task.description}</p>
          <div className="space-y-2 text-sm">
            <div>
              Assigned Role:{' '}
              <span className="font-medium">{task.role_name}</span>
            </div>
            {task.role_description && (
              <div className="text-muted-foreground">
                {task.role_description}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {task.ceo_status === 'decomposing' && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className={`text-sm ${getCeoStatusColor(task.ceo_status)}`}>
            {getCeoStatusText(task.ceo_status)}
          </span>
        </div>
      )}

      {task.ceo_status === 'decomposed' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-md">
          <span className="text-green-500">✓</span>
          <span className="text-sm text-green-700 dark:text-green-300">
            Task decomposed into {task.subtasks.length} subtasks
          </span>
        </div>
      )}

      {task.subtasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Subtasks</h3>
          <KanbanBoard taskId={taskId} />
        </div>
      )}

      {task.subtasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Execution Logs</h3>
          {task.subtasks.map((subtask) => (
            <div key={subtask.id} className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {subtask.title}
              </h4>
              <ExecutionLogs subtaskId={subtask.id} />
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
