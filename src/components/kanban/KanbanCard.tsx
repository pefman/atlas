import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, RotateCcw, AlertTriangle } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Subtask, Task, SubtaskStatus } from '@/types';
import { priorityColors } from '@/lib/priority';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface KanbanCardProps {
  task?: Task;
  subtask?: Subtask;
  onExecute?: (subtaskId: number) => void;
  onTaskStatusChange?: (taskId: number, status: Task['status']) => void;
}

export async function retrySubtask(subtaskId: number): Promise<void> {
  try {
    const response = await fetch(`/api/subtasks/${subtaskId}/retry`, { method: 'POST' });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error || `HTTP ${response.status}`);
    }
    toast.success('Subtask reset for retry');
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to retry subtask');
  }
}

export function KanbanCard({ task, subtask, onExecute, onTaskStatusChange }: KanbanCardProps) {
  const navigate = useNavigate();
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

  const handleClick = () => {
    if (isTask) {
      navigate(`/task/${task.id}`);
    } else if (subtask) {
      navigate(`/subtask/${subtask.id}`);
    }
  };

  const isFailed = !isTask && subtask?.status === 'failed';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        isTask ? 'border-l-4 border-l-primary' : 'border-dashed border-l-4 border-l-muted-foreground/40 bg-muted/30'
      } ${isFailed ? 'border-red-500' : ''}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Badge variant={isTask ? 'default' : 'secondary'} className="text-[10px] uppercase tracking-wide">
          {isTask ? 'Task' : 'Subtask'}
        </Badge>
        {isFailed && (
          <Badge variant="destructive" className="text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1" /> Failed
          </Badge>
        )}
        {!isTask && subtask?.task_title && (
          <button
            className="line-clamp-1 text-[11px] text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/task/${subtask.task_id}`);
            }}
          >
            Parent: {subtask.task_title}
          </button>
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
            {task.ceo_status === 'error' && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-6 text-xs px-2" 
                onClick={(e) => {
                  e.stopPropagation();
                  fetch(`/api/tasks/${task.id}/redecompose`, { method: 'POST' })
                    .then(res => {
                      if (!res.ok) throw new Error('Failed to redecompose');
                      toast.success('Task reset for redecomposition');
                    })
                    .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to redecompose'));
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Retry
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {isFailed ? (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-6 text-xs px-2" 
                onClick={(e) => {
                  e.stopPropagation();
                  void retrySubtask(subtask!.id);
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Retry
              </Button>
            ) : (
              onExecute && subtask && (
                <Button size="sm" variant="secondary" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); onExecute(subtask.id); }}>
                  <Play className="h-3 w-3 mr-1" /> Execute
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
