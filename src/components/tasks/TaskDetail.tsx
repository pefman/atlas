import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ExecutionLogs } from '@/components/execution/ExecutionLogs';
import { TaskStatus } from '@/types';

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
  subtasks: Subtask[];
}

interface TaskDetailProps {
  taskId: number;
  onBack: () => void;
}

export function TaskDetail({ taskId, onBack }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

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
      await fetchTask();
    } catch (error) {
      console.error('Failed to execute task:', error);
    } finally {
      setExecuting(false);
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

      <div>
        <h3 className="text-lg font-semibold mb-4">Subtasks</h3>
        <KanbanBoard taskId={taskId} />
      </div>

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
    </div>
  );
}
