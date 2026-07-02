import { useEffect, useState } from 'react';

type AIStatus = 'idle' | 'decomposing' | 'executing' | 'reviewing';

export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus>('idle');

  useEffect(() => {
    const eventSource = new EventSource('/api/kanban/stream');

    const handleSubtaskStart = () => setStatus('executing');
    const handleTaskDecomposed = () => setStatus('decomposing');
    const handleSubtaskComplete = () => {
      // Check if there are more active subtasks
      fetch('/api/subtasks')
        .then(res => res.json())
        .then(subtasks => {
          const hasActive = subtasks.some((s: any) => s.status === 'in_progress');
          if (!hasActive) setStatus('idle');
        })
        .catch(() => {});
    };

    eventSource.addEventListener('subtask_start', handleSubtaskStart);
    eventSource.addEventListener('task_decomposed', handleTaskDecomposed);
    eventSource.addEventListener('subtask_complete', handleSubtaskComplete);

    eventSource.onerror = () => {
      console.error('AI status: EventSource connection failed');
    };

    return () => {
      eventSource.removeEventListener('subtask_start', handleSubtaskStart);
      eventSource.removeEventListener('task_decomposed', handleTaskDecomposed);
      eventSource.removeEventListener('subtask_complete', handleSubtaskComplete);
      eventSource.close();
    };
  }, []);

  return status;
}
