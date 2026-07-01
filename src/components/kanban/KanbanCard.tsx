import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Subtask, Task } from '@/types';
import { priorityColors } from '@/lib/priority';

interface KanbanCardProps {
  task?: Task;
  subtask?: Subtask;
  onExecute?: (subtaskId: number) => void;
  onTaskClick?: (taskId: number) => void;
  onTaskStatusChange?: (taskId: number, status: Task['status']) => void;
}

export function KanbanCard({ task, subtask, onExecute, onTaskClick, onTaskStatusChange }: KanbanCardProps) {
  const item = task || subtask;
  if (!item) return null;

  const isTask = !!task;
  const itemId = isTask ? `task-${task.id}` : `subtask-${subtask!.id}`;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: itemId 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        isTask ? 'border-l-4 border-l-primary' : 'border-dashed border-l-4 border-l-muted-foreground/40 bg-muted/30'
      }`}
      onClick={() => isTask && onTaskClick?.(task!.id)}
    >
      <div className="mb-2 flex items-center gap-2">
        <Badge variant={isTask ? 'default' : 'secondary'} className="text-[10px] uppercase tracking-wide">
          {isTask ? 'Task' : 'Subtask'}
        </Badge>
        {!isTask && subtask?.task_title && (
          <span className="line-clamp-1 text-[11px] text-muted-foreground">Parent: {subtask.task_title}</span>
        )}
      </div>
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="flex-1 text-sm font-semibold leading-tight tracking-tight">{item.title}</h4>
        {isTask && <Badge variant="secondary" className="text-xs shrink-0">Main</Badge>}
      </div>
      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isTask && (
            <Badge variant="secondary" className={`text-xs shrink-0 ${priorityColors[(item as Subtask).priority]}`}>
              {(item as Subtask).priority}
            </Badge>
          )}
          {isTask && (
            <Select
              value={task.status}
              onValueChange={(newStatus) => onTaskStatusChange?.(task.id, newStatus as Task['status'])}
            >
              <SelectTrigger className="h-6 w-[96px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">Backlog</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        
        {isTask ? (
          <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
