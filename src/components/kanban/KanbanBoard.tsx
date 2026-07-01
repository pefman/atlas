import { useEffect, useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { Loader2 } from 'lucide-react';

interface Subtask {
  id: number;
  task_id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanBoardProps {
  taskId?: number;
}

export function KanbanBoard({ taskId }: KanbanBoardProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubtasks();
  }, [taskId]);

  const fetchSubtasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = taskId ? `/api/subtasks/task/${taskId}` : '/api/subtasks';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSubtasks(data);
    } catch (error) {
      console.error('Failed to fetch subtasks:', error);
      setError('Failed to load subtasks');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (subtaskId: number) => {
    try {
      const response = await fetch(`/api/execute/subtask/${subtaskId}`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchSubtasks();
    } catch (error) {
      console.error('Failed to execute subtask:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="text-center text-destructive">{error}</div>
      </div>
    );
  }

  const backlogSubtasks = subtasks.filter(s => s.status === 'backlog');
  const inProgressSubtasks = subtasks.filter(s => s.status === 'in_progress');
  const reviewSubtasks = subtasks.filter(s => s.status === 'review');
  const doneSubtasks = subtasks.filter(s => s.status === 'done');

  return (
    <div className="flex gap-4 p-6 overflow-x-auto">
      <KanbanColumn
        title="Backlog"
        status="backlog"
        subtasks={backlogSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="In Progress"
        status="in_progress"
        subtasks={inProgressSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="Review"
        status="review"
        subtasks={reviewSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="Done"
        status="done"
        subtasks={doneSubtasks}
      />
    </div>
  );
}
