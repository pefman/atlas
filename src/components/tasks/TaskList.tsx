import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '@/types';
import { DataTable } from './data-table';
import { taskTableColumns } from './task-table-columns';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TaskListProps {
  onTaskSelect: (taskId: number) => void;
  projectId?: number | null;
}

export function TaskList({ onTaskSelect, projectId = null }: TaskListProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<number | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const query = projectId ? `?project_id=${projectId}` : '';
      const response = await fetch(`/api/tasks${query}`);
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={taskTableColumns({})}
        data={tasks}
        onRowClick={(task) => handleView(task.id)}
      />

      <Dialog open={deleteTaskId !== null} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTaskId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
