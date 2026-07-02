import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskList } from '@/components/tasks/TaskList';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { AppPage } from '@/components/layout/AppPage';
import type { Project } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function DashboardPage() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
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
        console.error('Failed to load projects for dashboard filter:', error);
      }
    };

    void fetchProjects();
  }, []);

  const handleTaskCreated = () => {
    setRefreshKey(k => k + 1);
  };

  const handleTaskSelect = (taskId: number) => {
    navigate(`/task/${taskId}`);
  };

  return (
    <AppPage
      title="Tasks"
      subtitle="Track and manage all execution work in one place."
      actions={
        <div className="flex items-center gap-2">
          <Select value={projectFilter} onValueChange={(value) => setProjectFilter(value ?? 'all')}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by project" />
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
          <CreateTaskDialog onTaskCreated={handleTaskCreated} />
        </div>
      }
    >
      <TaskList
        key={refreshKey}
        onTaskSelect={handleTaskSelect}
        projectId={projectFilter === 'all' ? null : parseInt(projectFilter)}
      />
    </AppPage>
  );
}
