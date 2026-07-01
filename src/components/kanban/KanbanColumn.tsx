import { KanbanCard } from './KanbanCard';
import { Circle } from 'lucide-react';

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

interface KanbanColumnProps {
  title: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  tasks?: Task[];
  subtasks: Subtask[];
  onExecute?: (subtaskId: number) => void;
  onSubtaskExecute?: (subtaskId: number) => void;
  onTaskClick?: (taskId: number) => void;
  onTaskPickup?: (taskId: number) => void;
}

const columnColors: Record<string, string> = {
  backlog: 'bg-muted/50',
  'in_progress': 'bg-blue-50/50 dark:bg-blue-950/20',
  review: 'bg-amber-50/50 dark:bg-amber-950/20',
  done: 'bg-green-50/50 dark:bg-green-950/20',
};

const columnBorders: Record<string, string> = {
  backlog: 'border-border',
  'in_progress': 'border-blue-200 dark:border-blue-800',
  review: 'border-amber-200 dark:border-amber-800',
  done: 'border-green-200 dark:border-green-800',
};

const statusColors: Record<string, string> = {
  backlog: 'text-muted-foreground',
  'in_progress': 'text-blue-500',
  review: 'text-amber-500',
  done: 'text-green-500',
};

export function KanbanColumn({ title, status, tasks = [], subtasks, onExecute, onSubtaskExecute, onTaskClick, onTaskPickup }: KanbanColumnProps) {
  const totalCount = tasks.length + subtasks.length;

  return (
    <div className={`flex-1 min-w-[280px] ${columnColors[status]} border ${columnBorders[status]} rounded-lg p-4 shadow-sm`}>
      <h3 className="font-semibold mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Circle className={`h-3 w-3 ${statusColors[status]}`} />
          <span className="text-sm">{title}</span>
        </div>
        <span className="text-xs bg-background/50 px-2 py-1 rounded-full">{totalCount}</span>
      </h3>
      <div className="space-y-3">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onTaskClick={onTaskClick}
            onTaskPickup={onTaskPickup}
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
