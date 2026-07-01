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
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="font-medium text-sm flex-1 leading-tight">{item.title}</h4>
        <Badge variant="secondary" className="text-xs shrink-0">{item.role_name}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
      {isTask && task && (
        <div className="flex gap-1.5">
          {task.status === 'backlog' && (
            <Button size="sm" variant="secondary" className="flex-1 h-7 text-xs" onClick={(e) => { e.stopPropagation(); onTaskPickup?.(task.id); }}>
              <Play className="h-3 w-3 mr-1" /> Pick Up
            </Button>
          )}
          <Button size="sm" variant="secondary" className="flex-1 h-7 text-xs" onClick={(e) => { e.stopPropagation(); onTaskClick?.(task.id); }}>
            <ExternalLink className="h-3 w-3 mr-1" /> View
          </Button>
        </div>
      )}
      {!isTask && subtask && onExecute && (
        <Button size="sm" variant="secondary" className="w-full h-7 text-xs" onClick={(e) => { e.stopPropagation(); onExecute(subtask.id); }}>
          <Play className="h-3 w-3 mr-1" /> Execute
        </Button>
      )}
    </div>
  );
}
