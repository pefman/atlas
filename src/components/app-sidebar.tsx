import { Brain, Kanban, Settings, ListTodo, Moon, Sun, Command, User, ChevronRight } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeProvider';
import { Agent } from '@/types';
import { AgentSidebarItem } from './agents/AgentSidebarItem';
import { AgentDetail } from './agents/AgentDetail';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

const items = [
  {
    title: 'Dashboard',
    url: '/',
    icon: ListTodo,
  },
  {
    title: 'Kanban Board',
    url: '/kanban',
    icon: Kanban,
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
  },
];

interface AppSidebarProps {
  openCommandPalette: () => void;
}

export function AppSidebar({ openCommandPalette }: AppSidebarProps) {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        const data = await res.json();
        setAgents(data);
      } catch {
        setAgents([]);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-lg font-semibold">AI Task Executor</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={openCommandPalette}
              className="h-8 w-8"
            >
              <Command className="h-4 w-4" />
            </Button>
            <Switch checked={isDark} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <NavLink
                to={item.url}
                className={({ isActive }) =>
                  `peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground ${
                    isActive
                      ? 'data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground'
                      : ''
                  } [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate`
                }
              >
                <item.icon />
                <span>{item.title}</span>
              </NavLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <div className="px-4 py-2">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Management</h3>
              <Badge variant="secondary" className="text-xs">
                {agents.filter(a => ['ceo', 'planner'].includes(a.name)).length}
              </Badge>
            </div>
            <div className="space-y-1">
              {agents.filter(a => ['ceo', 'planner'].includes(a.name)).map((agent) => (
                <AgentSidebarItem
                  key={agent.id}
                  agent={agent}
                  onClick={setSelectedAgent}
                />
              ))}
            </div>
          </div>
          
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Agents</h3>
              <Badge variant="secondary" className="text-xs">
                {agents.filter(a => !['ceo', 'planner'].includes(a.name)).length}
              </Badge>
            </div>
            <div className="space-y-1">
              {agents.filter(a => !['ceo', 'planner'].includes(a.name)).map((agent) => (
                <AgentSidebarItem
                  key={agent.id}
                  agent={agent}
                  onClick={setSelectedAgent}
                />
              ))}
            </div>
          </div>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-4 py-2 border-t">
          <div className="flex items-center gap-2 flex-1">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Admin User</span>
              <span className="text-xs text-muted-foreground">admin@example.com</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground px-4 py-2">
          MVP v0.1
        </p>
      </SidebarFooter>
      {selectedAgent && (
        <div className="border-t">
          <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        </div>
      )}
    </Sidebar>
  );
}
