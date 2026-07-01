import { KanbanCard } from './KanbanCard';

interface Subtask {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanColumnProps {
  title: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  subtasks: Subtask[];
  onExecute?: (subtaskId: number) => void;
}

const columnColors: Record<string, string> = {
  backlog: 'bg-slate-100 dark:bg-slate-800',
  'in_progress': 'bg-blue-100 dark:bg-blue-900',
  review: 'bg-yellow-100 dark:bg-yellow-900',
  done: 'bg-green-100 dark:bg-green-900',
};

export function KanbanColumn({ title, status, subtasks, onExecute }: KanbanColumnProps) {
  return (
    <div className={`flex-1 min-w-[280px] ${columnColors[status]} rounded-lg p-4`}>
      <h3 className="font-semibold mb-4 flex items-center justify-between">
        {title}
        <span className="text-xs bg-background/50 px-2 py-1 rounded-full">{subtasks.length}</span>
      </h3>
      <div className="space-y-3">
        {subtasks.map((subtask) => (
          <KanbanCard key={subtask.id} subtask={subtask} onExecute={onExecute} />
        ))}
        {subtasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No subtasks</p>
        )}
      </div>
    </div>
  );
}
