import { Agent } from '@/types';
import { formatTokens } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface AgentSidebarItemProps {
  agent: Agent;
  onClick?: (agent: Agent) => void;
}

function roleLabel(name: string): string {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'executing':
    case 'decomposing':
      return 'bg-[var(--status-success-foreground)]';
    case 'reading_email':
      return 'bg-[var(--status-info-foreground)]';
    case 'answering_email':
      return 'bg-[var(--status-warning-foreground)]';
    case 'reviewing':
      return 'bg-[var(--status-warning-foreground)]';
    case 'error':
      return 'bg-[var(--status-danger-foreground)]';
    default:
      return 'bg-[var(--status-info-foreground)]';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'reading_email':
      return 'Reading mail';
    case 'answering_email':
      return 'Answering mail';
    case 'decomposing':
      return 'Decomposing';
    case 'executing':
      return 'Executing';
    case 'reviewing':
      return 'Reviewing';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
};

const hasToolLeak = (text: string): boolean => {
  const lowered = (text || '').toLowerCase();
  if (!lowered) return false;

  return (
    lowered.includes('tool_call') ||
    lowered.includes('"tool"') ||
    lowered.includes('"arguments"') ||
    lowered.includes('list_directory') ||
    lowered.includes('"type"')
  );
};

const getActivityText = (agent: Agent): string => {
  if (!agent.latestActivity?.output) return 'No activity yet';

  if (agent.status === 'reading_email') {
    return 'Reading your message.';
  }

  if (agent.status === 'answering_email') {
    return 'Writing a reply.';
  }

  const output = agent.latestActivity.output.trim();
  if (hasToolLeak(output)) {
    return 'Working on the latest request.';
  }

  return output.length > 80 ? `${output.substring(0, 80)}...` : output;
};

export function AgentSidebarItem({ agent, onClick }: AgentSidebarItemProps) {
  const navigate = useNavigate();
  const isActive = agent.status !== 'idle';
  const hasActivity = Boolean(agent.latestActivity);
  const isEmailStatus = agent.status === 'reading_email' || agent.status === 'answering_email';
  const activityText = getActivityText(agent);

  const handleClick = () => {
    if (onClick) {
      onClick(agent);
    } else {
      navigate(`/agent/${agent.id}`);
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-all cursor-pointer ${
        isActive 
          ? 'border-primary/30 bg-primary/5' 
          : 'border-border hover:border-muted-foreground/30 hover:bg-sidebar-accent'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {agent.portrait ? (
            <img
              src={`data:image/png;base64,${agent.portrait}`}
              alt=""
              className="w-4 h-4 rounded"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold">
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)} ${isActive ? 'animate-pulse' : ''}`} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{agent.funny_name || agent.name}</span>
              {agent.funny_name && (
                <span className="text-[10px] text-muted-foreground">{roleLabel(agent.name)}</span>
              )}
            </div>
          </div>
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
              {getStatusLabel(agent.status)}
            </p>
            {!isEmailStatus && (
              <p className="text-xs line-clamp-2 text-foreground/80">
                {activityText}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {agent.latestActivity?.created_at
                ? formatDistanceToNow(new Date(agent.latestActivity.created_at), { addSuffix: true })
                : 'just now'}
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
