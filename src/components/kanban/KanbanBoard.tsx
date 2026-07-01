import { useEffect, useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    </div>
  );
}
