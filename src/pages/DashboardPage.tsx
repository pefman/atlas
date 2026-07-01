import { useState } from 'react';
import { TaskList } from '@/components/tasks/TaskList';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';

export function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTaskCreated = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <CreateTaskDialog onTaskCreated={handleTaskCreated} />
      </div>
      <TaskList key={refreshKey} onTaskSelect={() => {}} />
    </div>
  );
}
