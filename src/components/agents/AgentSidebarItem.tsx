import { Agent } from '@/types';
import { formatTokens } from '@/lib/utils';

interface AgentSidebarItemProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'executing':
    case 'decomposing':
      return 'bg-[var(--status-success-foreground)]';
    case 'reviewing':
      return 'bg-[var(--status-warning-foreground)]';
    case 'error':
      return 'bg-[var(--status-danger-foreground)]';
    default:
      return 'bg-[var(--status-info-foreground)]';
  }
};

const getStepTypeLabel = (stepType: string) => {
  switch (stepType) {
    case 'decompose':
      return 'Decomposing';
    case 'assign':
      return 'Assigning';
    case 'execute':
      return 'Executing';
    case 'review':
      return 'Reviewing';
    default:
      return stepType;
  }
};

export function AgentSidebarItem({ agent, onClick }: AgentSidebarItemProps) {
  const isActive = agent.status !== 'idle';
  const hasActivity = agent.latestActivity && agent.latestActivity.output;
  const activityText = hasActivity 
    ? agent.latestActivity!.output.length > 80 
      ? agent.latestActivity!.output.substring(0, 80) + '...' 
      : agent.latestActivity!.output
    : 'No activity yet';

  return (
    <div
      className={`p-3 rounded-lg border transition-all cursor-pointer ${
        isActive 
          ? 'border-primary/30 bg-primary/5' 
          : 'border-border hover:border-muted-foreground/30 hover:bg-sidebar-accent'
      }`}
      onClick={() => onClick(agent)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)} ${isActive ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-semibold">{agent.name}</span>
        </div>
        {agent.stats && agent.stats.totalCalls > 0 && (
          <span className="text-xs text-muted-foreground">{agent.stats.totalCalls} calls</span>
        )}
      </div>

      {agent.current_task && (
        <p className="text-xs text-muted-foreground mb-2 truncate">
          {agent.current_task}
        </p>
      )}

      {hasActivity && (
        <>
          <div className="border-t border-border my-2" />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {getStepTypeLabel(agent.latestActivity!.step_type)} by {agent.latestActivity!.role_name}
            </p>
            <p className="text-xs line-clamp-2 text-foreground/80">
              {activityText}
            </p>
          </div>
        </>
      )}

      {agent.stats && (agent.stats.inputTokens > 0 || agent.stats.outputTokens > 0) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTokens(agent.stats.inputTokens)} in</span>
          <span>·</span>
          <span>{formatTokens(agent.stats.outputTokens)} out</span>
        </div>
      )}
    </div>
  );
}
