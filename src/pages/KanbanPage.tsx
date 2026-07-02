import { useState } from 'react';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { AppPage } from '@/components/layout/AppPage';
import { useKanbanStream } from '@/contexts/KanbanStreamContext';
import { Button } from '@/components/ui/button';
import { ListTodo } from 'lucide-react';

interface KanbanPageProps {
  taskId?: number;
}

export function KanbanPage({ taskId }: KanbanPageProps) {
  const { connected } = useKanbanStream();
  const [showActivity, setShowActivity] = useState(false);

  return (
    <AppPage
      title="Kanban"
      subtitle="Organize tasks and subtasks by execution status."
      actions={
        <Button
          variant={showActivity ? "default" : "outline"}
          size="sm"
          onClick={() => setShowActivity(!showActivity)}
        >
          <ListTodo className="h-4 w-4 mr-2" />
          Activity
        </Button>
      }
    >
      {!connected && (
        <div className="status-banner status-banner-warning text-center mb-4">
          Live updates disconnected — reconnecting...
        </div>
      )}
      <div className="flex gap-4">
        <div className="flex-1">
          <KanbanBoard taskId={taskId} />
        </div>
        {showActivity && (
          <div className="w-96 shrink-0">
            <ActivityFeed limit={50} />
          </div>
        )}
      </div>
    </AppPage>
  );
}
