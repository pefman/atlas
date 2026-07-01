import { KanbanBoard } from '@/components/kanban/KanbanBoard';

interface KanbanPageProps {
  taskId?: number;
}

export function KanbanPage({ taskId }: KanbanPageProps) {
  return (
    <div className="flex-1">
      <KanbanBoard taskId={taskId} />
    </div>
  );
}
