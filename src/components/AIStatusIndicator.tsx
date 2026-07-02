import { cn } from '@/lib/utils';
import { useAIStatus } from '@/hooks/useAIStatus';

type AIStatus = 'idle' | 'decomposing' | 'executing';

const statusConfig = {
  idle: { color: 'bg-muted-foreground', label: 'AI Idle' },
  decomposing: { color: 'bg-blue-500', label: 'AI Decomposing' },
  executing: { color: 'bg-green-500', label: 'AI Executing' },
};

export function AIStatusIndicator() {
  const status = useAIStatus();
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-card border px-3 py-1.5 shadow-sm',
        'transition-opacity duration-300',
        status === 'idle' ? 'opacity-40 hover:opacity-100' : 'opacity-100'
      )}
      title={config.label}
    >
      <div className={cn('h-2 w-2 rounded-full', config.color)} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}
