import { Agent } from '@/types';

interface AgentDetailProps {
  agent: Agent | null;
  onClose: () => void;
}

export function AgentDetail({ agent, onClose }: AgentDetailProps) {
  if (!agent) return null;

  return (
    <div className="p-4 border-t">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{agent.name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <p className="text-sm capitalize">{agent.status}</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Description</label>
          <p className="text-sm">{agent.description}</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Current Task</label>
          <p className="text-sm">{agent.current_task || 'None'}</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">System Prompt</label>
          <div className="text-xs bg-muted p-2 rounded max-h-[200px] overflow-y-auto">
            {agent.system_prompt}
          </div>
        </div>
      </div>
    </div>
  );
}
