import { KanbanCard } from './KanbanCard';

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
  backlog: 'bg-slate-100 dark:bg-slate-800',
  'in_progress': 'bg-blue-100 dark:bg-blue-900',
  review: 'bg-yellow-100 dark:bg-yellow-900',
  done: 'bg-green-100 dark:bg-green-900',
};

export function KanbanColumn({ title, status, tasks = [], subtasks, onExecute, onSubtaskExecute, onTaskClick, onTaskPickup }: KanbanColumnProps) {
  const totalCount = tasks.length + subtasks.length;

  return (
    <div className={`flex-1 min-w-[280px] ${columnColors[status]} rounded-lg p-4`}>
      <h3 className="font-semibold mb-4 flex items-center justify-between">
        {title}
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
