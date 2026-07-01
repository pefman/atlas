import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskList } from '@/components/tasks/TaskList';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';

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
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <CreateTaskDialog onTaskCreated={handleTaskCreated} />
      </div>
      <TaskList key={refreshKey} onTaskSelect={handleTaskSelect} />
    </div>
  );
}
