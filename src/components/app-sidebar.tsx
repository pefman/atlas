import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Kanban, Settings, ListTodo, MessageSquare, Users, FolderKanban, GitBranch, ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Agent } from '@/types';
import { AgentSidebarItem } from './agents/AgentSidebarItem';
import { Badge } from '@/components/ui/badge';

const items = [
  {
    title: 'Kanban',
    url: '/kanban',
    icon: Kanban,
  },
  {
    title: 'Tasks',
    url: '/tasks',
    icon: ListTodo,
  },
  {
    title: 'Projects',
    url: '/projects',
    icon: FolderKanban,
  },
  {
    title: 'Repos',
    url: '/repos',
    icon: GitBranch,
  },
  {
    title: 'Messages',
    url: '/messages',
    icon: MessageSquare,
  },
  {
    title: 'Agents',
    url: '/agents',
    icon: Users,
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
  },
];

interface AppSidebarProps {
  selectedAgent: Agent | null;
  onAgentSelect: (agent: Agent | null) => void;
}

export function AppSidebar({}: AppSidebarProps) {
  const { state, toggleSidebar } = useSidebar();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const pollingRef = useRef<number | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Agent[];
      setAgents(data);
    } catch (error) {
      console.error('Failed to load agents for sidebar:', error);
    }
  }, []);

  const fetchMessageUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/threads');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { unreadCount?: number };
      setMessageUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load unread message count for sidebar:', error);
    }
  }, []);

  const refreshSidebarData = useCallback(async () => {
    await Promise.all([fetchAgents(), fetchMessageUnreadCount()]);
  }, [fetchAgents, fetchMessageUnreadCount]);

  const startPolling = useCallback(() => {
    if (pollingRef.current !== null) return;
    pollingRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshSidebarData();
      }
    }, 2000);
  }, [refreshSidebarData]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshSidebarData();
        startPolling();
      } else {
        stopPolling();
      }
    };

    const onFocus = () => {
      void refreshSidebarData();
    };

    void refreshSidebarData();
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      stopPolling();
    };
  }, [refreshSidebarData, startPolling, stopPolling]);

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const aActive = a.status === 'idle' ? 1 : 0;
      const bActive = b.status === 'idle' ? 1 : 0;
      if (aActive !== bActive) return aActive - bActive;

      const aTime = a.latestActivity?.created_at ? new Date(a.latestActivity.created_at).getTime() : 0;
      const bTime = b.latestActivity?.created_at ? new Date(b.latestActivity.created_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;

      return a.name.localeCompare(b.name);
    });
  }, [agents]);

  const activeAgents = useMemo(
    () => sortedAgents.filter((a) => a.status !== 'idle' || Boolean(a.current_task?.trim())),
    [sortedAgents]
  );

  const leadershipAgents = useMemo(
    () => activeAgents.filter((a) => a.name === 'ceo'),
    [activeAgents]
  );

  const executionAgents = useMemo(
    () => activeAgents.filter((a) => a.name !== 'ceo'),
    [activeAgents]
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="space-y-3 px-2 py-1">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            {state === 'expanded' && (
              <span className="text-lg font-semibold">aTLAS</span>
            )}
          </div>
          <div className="flex items-center justify-between"></div>
        </div>
      </SidebarHeader>
      <SidebarContent>

        <SidebarMenu className="px-2">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <NavLink
                to={item.url}
                end={item.url === '/kanban'}
                className={({ isActive }) =>
                  `peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground ${
                    isActive
                      ? 'data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground'
                      : ''
                  } [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate`
                }
              >
                <item.icon />
                {state === 'expanded' && (
                  <>
                    <span>{item.title}</span>
                    {item.title === 'Messages' && messageUnreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1">
                        {messageUnreadCount}
                      </Badge>
                    )}
                  </>
                )}
              </NavLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {state === 'expanded' && (
          <div className="px-4 py-2">
            {activeAgents.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                No agents are currently working.
              </p>
            ) : (
              <>
                <div className="mb-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground">Leadership</h3>
                    <Badge variant="secondary" className="text-xs">
                      {leadershipAgents.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {leadershipAgents.map((agent) => (
                      <AgentSidebarItem
                        key={agent.id}
                        agent={agent}
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground">Execution Agents</h3>
                    <Badge variant="secondary" className="text-xs">
                      {executionAgents.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {executionAgents.map((agent) => (
                      <AgentSidebarItem
                        key={agent.id}
                        agent={agent}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SidebarContent>
      <div className="p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="w-full justify-center"
        >
          {state === 'expanded' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </Sidebar>
  );
}
