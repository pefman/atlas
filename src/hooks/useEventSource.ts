import { useEffect, useState, useRef, useCallback } from 'react';

type ExecEvent =
  | { type: 'subtask_start'; subtaskId: number; role: string; title: string }
  | { type: 'subtask_progress'; subtaskId: number; output: string }
  | { type: 'subtask_complete'; subtaskId: number; role: string; output: string }
  | { type: 'error'; subtaskId: number; error: string };

interface UseEventSourceResult {
  events: ExecEvent[];
  connected: boolean;
  error: string | null;
}

export function useEventSource(url: string | null): UseEventSourceResult {
  const [events, setEvents] = useState<ExecEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!url) {
      disconnect();
      return;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      setConnected(true);
      setError(null);
    });

    eventSource.addEventListener('subtask_start', (e: MessageEvent) => {
      const event = JSON.parse(e.data);
      setEvents(prev => [...prev, event]);
    });

    eventSource.addEventListener('subtask_progress', (e: MessageEvent) => {
      const event = JSON.parse(e.data);
      setEvents(prev => [...prev, event]);
    });

    eventSource.addEventListener('subtask_complete', (e: MessageEvent) => {
      const event = JSON.parse(e.data);
      setEvents(prev => [...prev, event]);
    });

    eventSource.addEventListener('error', (e: MessageEvent) => {
      const event = JSON.parse(e.data);
      setEvents(prev => [...prev, event]);
    });

    eventSource.onerror = () => {
      setConnected(false);
      setError('Connection lost');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [url, disconnect]);

  return { events, connected, error };
}
