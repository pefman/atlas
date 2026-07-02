import { useEffect, useState, useCallback, useMemo } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanDndProvider } from './KanbanDndProvider';
import { CreateTaskDialog } from './CreateTaskDialog';
import { MetricsStrip } from '@/components/metrics/MetricsStrip';
import { Button } from '@/components/ui/button';
import { Loader2, Search, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Task, Subtask, SubtaskStatus } from '@/types';
import { toast } from 'sonner';
import { useKanbanStream } from '@/contexts/KanbanStreamContext';

interface KanbanBoardProps {
  taskId?: number;
  projectId?: number | null;
}

interface Filters {
  search: string;
  status: string | null;
  role: string | null;
  priority: string | null;
}

export function KanbanBoard({ taskId, projectId = null }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ search: '', status: '', role: '', priority: '' });
  const { connected, reconnectCount, registerEvent } = useKanbanStream();

  useEffect(() => {
    fetchData();
  }, [taskId, reconnectCount, projectId]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tasksQuery = projectId ? `?project_id=${projectId}` : '';
      const tasksResponse = await fetch(`/api/tasks${tasksQuery}`);
      if (!tasksResponse.ok) throw new Error(`HTTP ${tasksResponse.status}`);
      const tasksData = await tasksResponse.json();
      setTasks(tasksData);
      
      const endpoint = taskId
        ? `/api/subtasks/task/${taskId}`
        : `/api/subtasks${projectId ? `?project_id=${projectId}` : ''}`;
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
  }, [taskId, projectId]);

  const filteredSubtasks = useMemo(() => {
    return subtasks.filter(s => {
      if (filters.search && !s.title.toLowerCase().includes(filters.search.toLowerCase()) && 
          !s.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.status && s.status !== filters.status) return false;
      if (filters.role && s.role_name !== filters.role) return false;
      if (filters.priority && s.priority !== filters.priority) return false;
      return true;
    });
  }, [subtasks, filters]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase()) && 
          !t.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.status && t.status !== filters.status) return false;
      return true;
    });
  }, [tasks, filters]);

  const roles = useMemo(() => {
    const roleSet = new Set(subtasks.map(s => s.role_name));
    return Array.from(roleSet).sort();
  }, [subtasks]);

  useEffect(() => {
    const cleanup = [
      registerEvent('subtask_start', (data: any) => {
        setSubtasks(prev => prev.map((s: Subtask) =>
          s.id === data.subtask_id ? { ...s, status: 'in_progress' as SubtaskStatus, updated_at: new Date().toISOString() } : s
        ));
      }),
      registerEvent('subtask_complete', (data: any) => {
        setSubtasks(prev => prev.map((s: Subtask) =>
          s.id === data.subtask_id ? { ...s, status: 'done' as SubtaskStatus, updated_at: new Date().toISOString() } : s
        ));
      }),
      registerEvent('subtask_failed', (data: any) => {
        setSubtasks(prev => prev.map((s: Subtask) =>
          s.id === data.subtask_id ? { ...s, status: 'failed' as SubtaskStatus, updated_at: new Date().toISOString() } : s
        ));
      }),
      registerEvent('task_decomposed', (data: any) => {
        if (data.task_id) {
          setTasks(prev => prev.map((t: Task) =>
            t.id === data.task_id ? { ...t, ceo_status: 'decomposed' as const, decomposed_at: new Date().toISOString(), updated_at: new Date().toISOString() } : t
          ));
        }
      }),
      registerEvent('task_completed', (data: any) => {
        setTasks(prev => prev.map((t: Task) =>
          t.id === data.task_id ? { ...t, status: 'done' as const, ceo_status: 'idle' as const, updated_at: new Date().toISOString() } : t
        ));
      }),
      registerEvent('task_status_changed', (data: any) => {
        if (data.task_id) {
          setTasks(prev => prev.map((t: Task) =>
            t.id === data.task_id ? { ...t, status: data.new_status as Task['status'], updated_at: new Date().toISOString() } : t
          ));
        }
      }),
      registerEvent('subtask_status_changed', () => {
        void fetchData();
      }),
    ];
    return () => cleanup.forEach(fn => fn());
  }, [registerEvent, fetchData]);

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
      setSubtasks(s => s.map((s: Subtask) => s.id === id ? { ...s, status: newStatus as SubtaskStatus } : s));
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

  if (!connected) {
    return (
      <div className="status-banner status-banner-warning text-center">
        Live updates disconnected — reconnecting...
      </div>
    );
  }

  if (tasks.length === 0 && subtasks.length === 0) {
    return (
      <div className="status-banner status-banner-info text-sm">
        No work items yet. Create a task to start building your execution board.
      </div>
    );
  }

  const failedSubtasks = filteredSubtasks.filter(s => s.status === 'failed');
  const backlogSubtasksWithFailed = filteredSubtasks.filter(s => s.status === 'backlog');
  const inProgressSubtasksWithFailed = filteredSubtasks.filter(s => s.status === 'in_progress');
  const reviewSubtasksWithFailed = filteredSubtasks.filter(s => s.status === 'review').concat(failedSubtasks);
  const doneSubtasksWithFailed = filteredSubtasks.filter(s => s.status === 'done');

  const backlogTasks = filteredTasks.filter(t => t.status === 'backlog');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress');
  const reviewTasks = filteredTasks.filter(t => t.status === 'review');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  const backlogSubtasks = filteredSubtasks.filter(s => s.status === 'backlog');
  const inProgressSubtasks = filteredSubtasks.filter(s => s.status === 'in_progress');
  const reviewSubtasks = filteredSubtasks.filter(s => s.status === 'review');
  const doneSubtasks = filteredSubtasks.filter(s => s.status === 'done');

  const totalItems = tasks.length + subtasks.length;
  const activeItems = inProgressTasks.length + reviewTasks.length + inProgressSubtasks.length + reviewSubtasks.length + failedSubtasks.length;
  const completedItems = doneTasks.length + doneSubtasks.length;

  return (
    <div className="space-y-3">
      <MetricsStrip />
      
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-8"
          />
          {filters.search && (
            <button
              onClick={() => setFilters(f => ({ ...f, search: '' }))}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.role} onValueChange={(v) => setFilters(f => ({ ...f, role: v }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Roles</SelectItem>
            {roles.map(role => (
              <SelectItem key={role} value={role}>{role}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={(v) => setFilters(f => ({ ...f, priority: v }))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
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
            ...failedSubtasks.map(s => ({ id: `subtask-${s.id}`, status: s.status })),
            ...doneSubtasks.map(s => ({ id: `subtask-${s.id}`, status: s.status }))
          ]}
          onDrop={handleDrop}
          tasks={tasks}
          subtasks={subtasks}
        >
          <KanbanColumn
            title="Backlog"
            status="backlog"
            tasks={backlogTasks}
            subtasks={backlogSubtasksWithFailed}
            onSubtaskExecute={handleSubtaskExecute}
            onTaskStatusChange={(taskId, status) => handleDrop(`task-${taskId}`, status)}
          />
          <KanbanColumn
            title="In Progress"
            status="in_progress"
            tasks={inProgressTasks}
            subtasks={inProgressSubtasksWithFailed}
            onSubtaskExecute={handleSubtaskExecute}
            onTaskStatusChange={(taskId, status) => handleDrop(`task-${taskId}`, status)}
          />
          <KanbanColumn
            title="Review"
            status="review"
            tasks={reviewTasks}
            subtasks={reviewSubtasksWithFailed}
            onSubtaskExecute={handleSubtaskExecute}
            onTaskStatusChange={(taskId, status) => handleDrop(`task-${taskId}`, status)}
          />
          <KanbanColumn
            title="Done"
            status="done"
            tasks={doneTasks}
            subtasks={doneSubtasksWithFailed}
            onTaskStatusChange={(taskId, status) => handleDrop(`task-${taskId}`, status)}
          />
          <CreateTaskDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onCreated={fetchData}
            projectId={projectId}
          />
        </KanbanDndProvider>
      </div>

      <div className="fixed bottom-6 right-6">
        <Button
          size="lg"
          className="shadow-lg"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Task
        </Button>
      </div>
    </div>
  );
}
