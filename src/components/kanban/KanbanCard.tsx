import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, ExternalLink } from 'lucide-react';

interface Task {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface Subtask {
  id: number;
  task_id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanCardProps {
  task?: Task;
  subtask?: Subtask;
  onExecute?: (subtaskId: number) => void;
  onTaskClick?: (taskId: number) => void;
  onTaskPickup?: (taskId: number) => void;
}

export function KanbanCard({ task, subtask, onExecute, onTaskClick, onTaskPickup }: KanbanCardProps) {
  const item = task || subtask;
  if (!item) return null;

  const isTask = !!task;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm">{item.title}</h4>
        <Badge className="text-xs border-border">{item.role_name}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
      {isTask && task && (
        <div className="flex gap-2">
          {task.status === 'backlog' && (
            <Button size="sm" variant="ghost" className="flex-1" onClick={() => onTaskPickup?.(task.id)}>
              <Play className="h-3 w-3 mr-1" /> Pick Up
            </Button>
          )}
          <Button size="sm" variant="ghost" className="flex-1" onClick={() => onTaskClick?.(task.id)}>
            <ExternalLink className="h-3 w-3 mr-1" /> View
          </Button>
        </div>
      )}
      {!isTask && subtask && onExecute && (
        <Button size="sm" variant="ghost" className="w-full" onClick={() => onExecute(subtask.id)}>
          <Play className="h-3 w-3 mr-1" /> Execute
        </Button>
      )}
    </div>
  );
}
