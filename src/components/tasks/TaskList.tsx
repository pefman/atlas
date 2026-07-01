import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '@/types';
import { DataTable } from './data-table';
import { taskTableColumns } from './task-table-columns';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface TaskListProps {
  onTaskSelect: (taskId: number) => void;
}

export function TaskList({ onTaskSelect }: TaskListProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<number | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (taskId: number) => {
    try {
      setExecuting(taskId);
      const response = await fetch(`/api/execute/task/${taskId}`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast.success('Task execution started');
      await fetchTasks();
    } catch (error) {
      console.error('Failed to execute task:', error);
      toast.error('Failed to execute task');
    } finally {
      setExecuting(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTaskId) return;
    try {
      setDeleting(true);
      const response = await fetch(`/api/tasks/${deleteTaskId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast.success('Task deleted');
      setDeleteTaskId(null);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    } finally {
      setDeleting(false);
    }
  };

  const handleView = (taskId: number) => {
    onTaskSelect(taskId);
    navigate(`/task/${taskId}`);
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={taskTableColumns({ onExecute: handleExecute, onDelete: setDeleteTaskId, onView: handleView })}
        data={tasks}
      />

      {deleteTaskId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Delete Task</h2>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTaskId(null)}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
