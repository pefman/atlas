import { useState, useEffect, useRef } from 'react';
import { useKanbanStream } from '@/contexts/KanbanStreamContext';

type AIStatus = 'idle' | 'decomposing' | 'executing';

export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus>('idle');
  const { registerEvent } = useKanbanStream();
  const activeSubtasksRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const cleanup = [
      registerEvent('task_decomposing', () => setStatus('decomposing')),
      registerEvent('task_decomposed', () => setStatus('idle')),
      registerEvent('subtask_start', (data: any) => {
        activeSubtasksRef.current.add(data.subtask_id);
        setStatus('executing');
      }),
      registerEvent('subtask_complete', (data: any) => {
        activeSubtasksRef.current.delete(data.subtask_id);
        if (activeSubtasksRef.current.size === 0) {
          setStatus('idle');
        }
      }),
      registerEvent('subtask_failed', (data: any) => {
        activeSubtasksRef.current.delete(data.subtask_id);
        if (activeSubtasksRef.current.size === 0) {
          setStatus('idle');
        }
      }),
      registerEvent('task_completed', () => setStatus('idle')),
    ];
    return () => cleanup.forEach(fn => fn());
  }, [registerEvent]);

  return status;
}
