import { useEffect, useState } from 'react';
import { KanbanColumn } from './KanbanColumn';

interface Subtask {
  id: number;
  task_id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanBoardProps {
  taskId?: number;
}

export function KanbanBoard({ taskId }: KanbanBoardProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  useEffect(() => {
    if (taskId) {
      fetchSubtasks();
    }
  }, [taskId]);

  const fetchSubtasks = async () => {
    try {
      const response = await fetch(`/api/subtasks/task/${taskId}`);
      const data = await response.json();
      setSubtasks(data);
    } catch (error) {
      console.error('Failed to fetch subtasks:', error);
    }
  };

  const handleExecute = async (subtaskId: number) => {
    try {
      await fetch(`/api/execute/subtask/${subtaskId}`, { method: 'POST' });
      fetchSubtasks();
    } catch (error) {
      console.error('Failed to execute subtask:', error);
    }
  };

  const backlogSubtasks = subtasks.filter(s => s.status === 'backlog');
  const inProgressSubtasks = subtasks.filter(s => s.status === 'in_progress');
  const reviewSubtasks = subtasks.filter(s => s.status === 'review');
  const doneSubtasks = subtasks.filter(s => s.status === 'done');

  return (
    <div className="flex gap-4 p-6 overflow-x-auto">
      <KanbanColumn
        title="Backlog"
        status="backlog"
        subtasks={backlogSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="In Progress"
        status="in_progress"
        subtasks={inProgressSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="Review"
        status="review"
        subtasks={reviewSubtasks}
        onExecute={handleExecute}
      />
      <KanbanColumn
        title="Done"
        status="done"
        subtasks={doneSubtasks}
      />
    </div>
  );
}
