import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskList } from '@/components/tasks/TaskList';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { AppPage } from '@/components/layout/AppPage';

export function DashboardPage() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

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
      actions={<CreateTaskDialog onTaskCreated={handleTaskCreated} />}
    >
      <TaskList key={refreshKey} onTaskSelect={handleTaskSelect} />
    </AppPage>
  );
}
