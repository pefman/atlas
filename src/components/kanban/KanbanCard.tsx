import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { ProgressRing } from '@/components/ui/progress-ring';
import type { Subtask, Task as TaskType } from '@/types';

interface Task {
  id: number;
  title: string;
  description: string;
  role_id: number;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanCardProps {
  task?: Task;
  subtask?: Subtask;
  onExecute?: (subtaskId: number) => void;
  onTaskClick?: (taskId: number) => void;
  onTaskPickup?: (taskId: number) => void;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
};

const statusColors: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground',
  'in_progress': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  review: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

export function KanbanCard({ task, subtask, onExecute, onTaskClick, onTaskPickup }: KanbanCardProps) {
  const item = task || subtask;
  if (!item) return null;

  const isTask = !!task;

  return (
    <div
      className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => isTask && onTaskClick?.(task!.id)}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="font-medium text-sm flex-1 leading-tight">{item.title}</h4>
        {isTask && <Badge variant="secondary" className="text-xs shrink-0">Role #{(item as Task).role_id}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ProgressRing progress={100} size={16} strokeWidth={1.5} />
          <Badge variant="secondary" className={`text-xs ${priorityColors.high}`}>High</Badge>
        </div>
        
        {isTask ? (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.status === 'backlog' && (
              <Button size="sm" variant="secondary" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); onTaskPickup?.(task.id); }}>
                <Play className="h-3 w-3 mr-1" /> Pick Up
              </Button>
            )}
          </div>
        ) : (
          onExecute && subtask && (
            <Button size="sm" variant="secondary" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); onExecute(subtask.id); }}>
              <Play className="h-3 w-3 mr-1" /> Execute
            </Button>
          )
        )}
      </div>
    </div>
  );
}
