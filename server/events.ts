export type ServerEvent =
  | { type: 'subtask_start'; data: any }
  | { type: 'subtask_progress'; data: any }
  | { type: 'subtask_complete'; data: any }
  | { type: 'error'; data: any }
  | { type: 'notification'; data: any };

type Listener = (data: any) => void;

class ServerEventBus {
  private listeners: Map<string, Set<Listener>> = new Map();

  on(event: string, listener: Listener): { unsubscribe: () => void } {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return {
      unsubscribe: () => {
        this.listeners.get(event)?.delete(listener);
      },
    };
  }

  emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (err) {
          console.error(`[ServerEventBus] Error in listener for '${event}':`, err);
        }
      }
    }
  }
}

export const execEventBus = new ServerEventBus();
