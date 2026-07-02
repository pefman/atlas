import { useEffect, useState } from 'react';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { AppPage } from '@/components/layout/AppPage';
import { useKanbanStream } from '@/contexts/KanbanStreamContext';
import { Button } from '@/components/ui/button';
import { ListTodo } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Project } from '@/types';

interface KanbanPageProps {
  taskId?: number;
}

export function KanbanPage({ taskId }: KanbanPageProps) {
  const { connected } = useKanbanStream();
  const [showActivity, setShowActivity] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as Project[];
        setProjects(data);
      } catch (error) {
        console.error('Failed to load projects for kanban filter:', error);
      }
    };
    void fetchProjects();
  }, []);

  return (
    <AppPage
      title="Kanban"
      subtitle="Organize tasks and subtasks by execution status."
      actions={
        <div className="flex items-center gap-2">
          <Select value={projectFilter} onValueChange={(value) => setProjectFilter(value ?? 'all')}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Project scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showActivity ? "default" : "outline"}
            size="sm"
            onClick={() => setShowActivity(!showActivity)}
          >
            <ListTodo className="h-4 w-4 mr-2" />
            Activity
          </Button>
        </div>
      }
    >
      {!connected && (
        <div className="status-banner status-banner-warning text-center mb-4">
          Live updates disconnected — reconnecting...
        </div>
      )}
      <div className="flex gap-4">
        <div className="flex-1">
          <KanbanBoard
            taskId={taskId}
            projectId={projectFilter === 'all' ? null : parseInt(projectFilter, 10)}
          />
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
