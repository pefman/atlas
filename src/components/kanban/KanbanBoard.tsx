import { useEffect, useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanDndProvider } from './KanbanDndProvider';
import { CreateTaskDialog } from './CreateTaskDialog';
import { Loader2 } from 'lucide-react';
import type { Task, Subtask } from '@/types';
import { toast } from 'sonner';

interface KanbanBoardProps {
  taskId?: number;
}

export function KanbanBoard({ taskId }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [taskId]);

  useEffect(() => {
    const eventSource = new EventSource('/api/kanban/stream');

    const handleSubtaskStart = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setSubtasks(prev => prev.map((s: Subtask) =>
        s.id === data.subtask_id ? { ...s, status: 'in_progress' as const, updated_at: new Date().toISOString() } : s
      ));
    };

    const handleSubtaskComplete = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setSubtasks(prev => prev.map((s: Subtask) =>
        s.id === data.subtask_id ? { ...s, status: 'done' as const, updated_at: new Date().toISOString() } : s
      ));
      if (data.task_id) {
        setTasks(prev => prev.map((t: Task) =>
          t.id === data.task_id ? { ...t, status: 'done' as const, updated_at: new Date().toISOString() } : t
        ));
      }
    };

    const handleSubtaskFailed = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setSubtasks(prev => prev.map((s: Subtask) =>
        s.id === data.subtask_id ? { ...s, status: 'done' as const, updated_at: new Date().toISOString() } : s
      ));
    };

    const handleTaskDecomposed = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.task_id) {
        setTasks(prev => prev.map((t: Task) =>
          t.id === data.task_id ? { ...t, ceo_status: 'decomposed' as const, decomposed_at: new Date().toISOString(), updated_at: new Date().toISOString() } : t
        ));
      }
    };

    const handleTaskCompleted = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setTasks(prev => prev.map((t: Task) =>
        t.id === data.task_id ? { ...t, status: 'done' as const, ceo_status: 'idle' as const, updated_at: new Date().toISOString() } : t
      ));
    };

    eventSource.addEventListener('subtask_start', handleSubtaskStart);
    eventSource.addEventListener('subtask_complete', handleSubtaskComplete);
    eventSource.addEventListener('subtask_failed', handleSubtaskFailed);
    eventSource.addEventListener('task_decomposed', handleTaskDecomposed);
    eventSource.addEventListener('task_completed', handleTaskCompleted);

    eventSource.onerror = () => {
      console.error('EventSource connection failed');
    };

    return () => {
      eventSource.removeEventListener('subtask_start', handleSubtaskStart);
      eventSource.removeEventListener('subtask_complete', handleSubtaskComplete);
      eventSource.removeEventListener('subtask_failed', handleSubtaskFailed);
      eventSource.removeEventListener('task_decomposed', handleTaskDecomposed);
      eventSource.removeEventListener('task_completed', handleTaskCompleted);
      eventSource.close();
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tasksResponse = await fetch('/api/tasks');
      if (!tasksResponse.ok) throw new Error(`HTTP ${tasksResponse.status}`);
      const tasksData = await tasksResponse.json();
      setTasks(tasksData);
      
      const endpoint = taskId ? `/api/subtasks/task/${taskId}` : '/api/subtasks';
      const subtasksResponse = await fetch(endpoint);
      if (!subtasksResponse.ok) throw new Error(`HTTP ${subtasksResponse.status}`);
      const subtasksData = await subtasksResponse.json();
      setSubtasks(subtasksData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubtaskExecute = async (subtaskId: number) => {
    try {
      const response = await fetch(`/api/execute/subtask/${subtaskId}`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchData();
    } catch (error) {
      console.error('Failed to execute subtask:', error);
    }
  };

  const handleDrop = async (itemId: string, newStatus: string) => {
    const [type, idStr] = itemId.split('-');
    const id = parseInt(idStr);

    const prevTasks = [...tasks];
    const prevSubtasks = [...subtasks];

    if (type === 'task') {
      setTasks(t => t.map((t: Task) => t.id === id ? { ...t, status: newStatus as Task['status'] } : t));
    } else {
      setSubtasks(s => s.map((s: Subtask) => s.id === id ? { ...s, status: newStatus as Subtask['status'] } : s));
    }

    try {
      const url = type === 'task' ? `/api/tasks/${id}/status` : `/api/subtasks/${id}/status`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || `HTTP ${response.status}`;
        throw new Error(message);
      }

      await fetchData();
    } catch (error) {
      console.error('Failed to update item status:', error);
      setTasks(prevTasks);
      setSubtasks(prevSubtasks);
      toast.error(error instanceof Error ? error.message : 'Failed to update item status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="status-banner status-banner-danger text-center">{error}</div>
    );
  }

  if (tasks.length === 0 && subtasks.length === 0) {
    return (
      <div className="status-banner status-banner-info text-sm">
        No work items yet. Create a task to start building your execution board.
      </div>
    );
  }

  const backlogTasks = tasks.filter(t => t.status === 'backlog');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const reviewTasks = tasks.filter(t => t.status === 'review');
  const doneTasks = tasks.filter(t => t.status === 'done');

  const backlogSubtasks = subtasks.filter(s => s.status === 'backlog');
  const inProgressSubtasks = subtasks.filter(s => s.status === 'in_progress');
  const reviewSubtasks = subtasks.filter(s => s.status === 'review');
  const doneSubtasks = subtasks.filter(s => s.status === 'done');

  const totalItems = tasks.length + subtasks.length;
  const activeItems = inProgressTasks.length + reviewTasks.length + inProgressSubtasks.length + reviewSubtasks.length;
  const completedItems = doneTasks.length + doneSubtasks.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs sm:max-w-md sm:gap-3 sm:text-sm">
        <div className="rounded-md border bg-card px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
          Total: <span className="font-medium text-foreground">{totalItems}</span>
        </div>
        <div className="rounded-md border bg-card px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
          Active: <span className="font-medium text-foreground">{activeItems}</span>
        </div>
        <div className="rounded-md border bg-card px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
          Done: <span className="font-medium text-foreground">{completedItems}</span>
        </div>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4">
        <KanbanDndProvider
          items={[
            ...backlogTasks.map(t => ({ id: `task-${t.id}`, status: t.status })),
            ...inProgressTasks.map(t => ({ id: `task-${t.id}`, status: t.status })),
            ...reviewTasks.map(t => ({ id: `task-${t.id}`, status: t.status })),
            ...doneTasks.map(t => ({ id: `task-${t.id}`, status: t.status })),
            ...backlogSubtasks.map(s => ({ id: `subtask-${s.id}`, status: s.status })),
            ...inProgressSubtasks.map(s => ({ id: `subtask-${s.id}`, status: s.status })),
            ...reviewSubtasks.map(s => ({ id: `subtask-${s.id}`, status: s.status })),
            ...doneSubtasks.map(s => ({ id: `subtask-${s.id}`, status: s.status }))
          ]}
          onDrop={handleDrop}
        >
          <KanbanColumn
            title="Backlog"
            status="backlog"
            tasks={backlogTasks}
            subtasks={backlogSubtasks}
            onCreateTask={() => setCreateDialogOpen(true)}
            onSubtaskExecute={handleSubtaskExecute}
            onTaskStatusChange={(taskId, status) => handleDrop(`task-${taskId}`, status)}
          />
          <KanbanColumn
            title="In Progress"
            status="in_progress"
            tasks={inProgressTasks}
            subtasks={inProgressSubtasks}
            onSubtaskExecute={handleSubtaskExecute}
            onTaskStatusChange={(taskId, status) => handleDrop(`task-${taskId}`, status)}
          />
          <KanbanColumn
            title="Review"
            status="review"
            tasks={reviewTasks}
            subtasks={reviewSubtasks}
            onSubtaskExecute={handleSubtaskExecute}
            onTaskStatusChange={(taskId, status) => handleDrop(`task-${taskId}`, status)}
          />
          <KanbanColumn
            title="Done"
            status="done"
            tasks={doneTasks}
            subtasks={doneSubtasks}
            onTaskStatusChange={(taskId, status) => handleDrop(`task-${taskId}`, status)}
          />
          <CreateTaskDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onCreated={fetchData}
          />
        </KanbanDndProvider>
      </div>
    </div>
  );
}
