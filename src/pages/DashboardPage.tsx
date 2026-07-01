import { useEffect, useState } from 'react';
import { TaskList } from '@/components/tasks/TaskList';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';

interface Role {
  id: number;
  name: string;
  description: string;
}

export function DashboardPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const handleTaskCreated = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <CreateTaskDialog roles={roles} onTaskCreated={handleTaskCreated} />
      </div>
      <TaskList key={refreshKey} onTaskSelect={() => {}} />
    </div>
  );
}
