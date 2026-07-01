import { useState } from 'react';
import { Agent } from '@/types';

interface AgentSidebarItemProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
}

export function AgentSidebarItem({ agent, onClick }: AgentSidebarItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusColor = () => {
    switch (agent.status) {
      case 'executing':
        return 'bg-green-500';
      case 'reviewing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
        isHovered ? 'bg-sidebar-accent' : ''
      } ${agent.status !== 'idle' ? 'border-l-2 border-l-green-500' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(agent)}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${agent.status === 'executing' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">{agent.name}</span>
      </div>
      {agent.current_task && (
        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
          {agent.current_task}
        </span>
      )}
    </div>
  );
}
