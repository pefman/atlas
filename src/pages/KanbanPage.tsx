import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { AppPage } from '@/components/layout/AppPage';

interface KanbanPageProps {
  taskId?: number;
}

export function KanbanPage({ taskId }: KanbanPageProps) {
  return (
    <AppPage
      title="Kanban"
      subtitle="Organize tasks and subtasks by execution status."
    >
      <KanbanBoard taskId={taskId} />
    </AppPage>
  );
}
