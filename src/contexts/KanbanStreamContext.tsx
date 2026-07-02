import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

type EventHandler = (data: any) => void;

interface KanbanStreamContextValue {
  connected: boolean;
  reconnectCount: number;
  useKanbanEvent: (event: string, handler: EventHandler) => void;
  refetch: () => void;
}

const KanbanStreamContext = createContext<KanbanStreamContextValue | null>(null);

export function KanbanStreamProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  const useKanbanEvent = useCallback((event: string, handler: EventHandler) => {
    useEffect(() => {
      if (!handlersRef.current.has(event)) {
        handlersRef.current.set(event, new Set());
      }
      handlersRef.current.get(event)!.add(handler);

      return () => {
        handlersRef.current.get(event)?.delete(handler);
      };
    }, [event, handler]);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/kanban/stream');
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      setConnected(true);
      setReconnectCount(0);
    });

    eventSource.addEventListener('heartbeat', () => {
      // Heartbeat received, connection is alive
    });

    for (const [event, handlers] of handlersRef.current) {
      eventSource.addEventListener(event, (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (err) {
            console.error(`[KanbanStream] Error in handler for '${event}':`, err);
          }
        }
      });
    }

    eventSource.onerror = () => {
      setConnected(false);
      setReconnectCount(prev => prev + 1);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  const refetch = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      const newSource = new EventSource('/api/kanban/stream');
      eventSourceRef.current = newSource;
    }
  }, []);

  return (
    <KanbanStreamContext.Provider value={{ connected, reconnectCount, useKanbanEvent, refetch }}>
      {children}
    </KanbanStreamContext.Provider>
  );
}

export function useKanbanStream(): KanbanStreamContextValue {
  const context = useContext(KanbanStreamContext);
  if (!context) {
    throw new Error('useKanbanStream must be used within KanbanStreamProvider');
  }
  return context;
}
