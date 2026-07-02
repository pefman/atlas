import { useState, useEffect } from 'react';
import { useKanbanStream } from '@/contexts/KanbanStreamContext';

type AIStatus = 'idle' | 'decomposing' | 'executing';

export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus>('idle');
  const { useKanbanEvent } = useKanbanStream();
  const activeSubtasksRef = new Set<number>();

  useKanbanEvent('task_decomposing', () => {
    setStatus('decomposing');
  });

  useKanbanEvent('task_decomposed', () => {
    setStatus('idle');
  });

  useKanbanEvent('subtask_start', (data: any) => {
    activeSubtasksRef.add(data.subtask_id);
    setStatus('executing');
  });

  useKanbanEvent('subtask_complete', (data: any) => {
    activeSubtasksRef.delete(data.subtask_id);
    if (activeSubtasksRef.size === 0) {
      setStatus('idle');
    }
  });

  useKanbanEvent('subtask_failed', (data: any) => {
    activeSubtasksRef.delete(data.subtask_id);
    if (activeSubtasksRef.size === 0) {
      setStatus('idle');
    }
  });

  useKanbanEvent('task_completed', () => {
    setStatus('idle');
  });

  return status;
}
