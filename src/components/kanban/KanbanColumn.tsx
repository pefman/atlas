import { KanbanCard } from './KanbanCard';
import { Circle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Task, Subtask } from '@/types';

interface KanbanColumnProps {
  title: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  tasks?: Task[];
  subtasks: Subtask[];
  onCreateTask?: () => void;
  onExecute?: (subtaskId: number) => void;
  onSubtaskExecute?: (subtaskId: number) => void;
  onTaskStatusChange?: (taskId: number, status: Task['status']) => void;
}

const columnColors: Record<string, string> = {
  backlog: 'bg-card/60',
  'in_progress': 'status-surface-info',
  review: 'status-surface-warning',
  done: 'status-surface-success',
};

const columnBorders: Record<string, string> = {
  backlog: 'border-border',
  'in_progress': 'border',
  review: 'border',
  done: 'border',
};

const statusColors: Record<string, string> = {
  backlog: 'text-muted-foreground',
  'in_progress': 'text-[var(--status-info-foreground)]',
  review: 'text-[var(--status-warning-foreground)]',
  done: 'text-[var(--status-success-foreground)]',
};

export function KanbanColumn({ title, status, tasks = [], subtasks, onCreateTask, onExecute, onSubtaskExecute, onTaskStatusChange }: KanbanColumnProps) {
  const totalCount = tasks.length + subtasks.length;

  return (
    <div className={`w-[85vw] snap-start sm:w-[360px] lg:w-[300px] xl:flex-1 ${columnColors[status]} ${columnBorders[status]} rounded-lg p-3 shadow-sm sm:p-4`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Circle className={`h-3 w-3 ${statusColors[status]}`} />
          <span className="text-sm font-semibold tracking-tight">{title}</span>
        </div>
        <span className="rounded-full bg-background/70 px-2 py-1 text-xs font-medium">{totalCount}</span>
      </div>
      {onCreateTask && (
        <Button
          variant="outline"
          className="mb-3 h-9 w-full text-xs sm:h-10 sm:text-sm"
          onClick={onCreateTask}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      )}
      <div className="space-y-3 max-h-[calc(100dvh-20rem)] overflow-y-auto pr-1">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onTaskStatusChange={onTaskStatusChange}
          />
        ))}
        {subtasks.map((subtask) => (
          <KanbanCard key={subtask.id} subtask={subtask} onExecute={onSubtaskExecute} />
        ))}
        {totalCount === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No items</p>
        )}
      </div>
    </div>
  );
}
