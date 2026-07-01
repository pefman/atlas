import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Trash2 } from 'lucide-react';

interface Task {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  created_at: string;
}

interface TaskListProps {
  onTaskSelect: (taskId: number) => void;
}

export function TaskList({ onTaskSelect }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executing, setExecuting] = useState<number | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const handleExecute = async (taskId: number) => {
    try {
      setExecuting(taskId);
      await fetch(`/api/execute/task/${taskId}`, { method: 'POST' });
      await fetchTasks();
    } catch (error) {
      console.error('Failed to execute task:', error);
    } finally {
      setExecuting(null);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm('Delete this task?')) return;
    
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'backlog': return 'bg-slate-500';
      case 'in_progress': return 'bg-blue-500';
      case 'review': return 'bg-yellow-500';
      case 'done': return 'bg-green-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">No tasks yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">{task.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
              </div>
              <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Role: {task.role_name} | Created: {new Date(task.created_at).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleExecute(task.id)} disabled={executing === task.id}>
                    <Play className="h-4 w-4 mr-1" /> {executing === task.id ? 'Running...' : 'Execute'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(task.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
