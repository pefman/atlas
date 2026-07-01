import { useEffect, useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanDndProvider } from './KanbanDndProvider';
import { CreateTaskDialog } from './CreateTaskDialog';
import { Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { Task, Subtask } from '@/types';

interface KanbanBoardProps {
  taskId?: number;
}

export function KanbanBoard({ taskId }: KanbanBoardProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [taskId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch main tasks
      const tasksResponse = await fetch('/api/tasks');
      if (!tasksResponse.ok) throw new Error(`HTTP ${tasksResponse.status}`);
      const tasksData = await tasksResponse.json();
      setTasks(tasksData);
      
      // Fetch subtasks
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

  const handleTaskClick = (taskId: number) => {
    navigate(`/task/${taskId}`);
  };

  const handleTaskPickup = async (taskId: number) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/pickup`, { method: 'PATCH' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchData();
    } catch (error) {
      console.error('Failed to pickup task:', error);
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

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await fetchData();
    } catch (error) {
      console.error('Failed to update item status:', error);
      setTasks(prevTasks);
      setSubtasks(prevSubtasks);
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

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const backlogTasks = tasks.filter(t => t.status === 'backlog');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const reviewTasks = tasks.filter(t => t.status === 'review');
  const doneTasks = tasks.filter(t => t.status === 'done');

  const backlogSubtasks = subtasks.filter(s => s.status === 'backlog');
  const inProgressSubtasks = subtasks.filter(s => s.status === 'in_progress');
  const reviewSubtasks = subtasks.filter(s => s.status === 'review');
  const doneSubtasks = subtasks.filter(s => s.status === 'done');

  return (
    <div className="flex gap-4 p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Kanban Board</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>
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
          onTaskClick={handleTaskClick}
          onTaskPickup={handleTaskPickup}
          onSubtaskExecute={handleSubtaskExecute}
        />
        <KanbanColumn
          title="In Progress"
          status="in_progress"
          tasks={inProgressTasks}
          subtasks={inProgressSubtasks}
          onTaskClick={handleTaskClick}
          onSubtaskExecute={handleSubtaskExecute}
        />
        <KanbanColumn
          title="Review"
          status="review"
          tasks={reviewTasks}
          subtasks={reviewSubtasks}
          onTaskClick={handleTaskClick}
          onSubtaskExecute={handleSubtaskExecute}
        />
        <KanbanColumn
          title="Done"
          status="done"
          tasks={doneTasks}
          subtasks={doneSubtasks}
          onTaskClick={handleTaskClick}
        />
        <CreateTaskDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreated={fetchData}
        />
      </KanbanDndProvider>
    </div>
  );
}
