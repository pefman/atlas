import { Brain, Kanban, Settings, ListTodo, Command } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeProvider';
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
    title: 'Settings',
    url: '/settings',
    icon: Settings,
  },
];

interface AppSidebarProps {
  openCommandPalette: () => void;
  selectedAgent: Agent | null;
  onAgentSelect: (agent: Agent | null) => void;
}

export function AppSidebar({ openCommandPalette }: AppSidebarProps) {
  const { isDark, toggleTheme } = useTheme();
  const [agents, setAgents] = useState<Agent[]>([]);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="space-y-3 px-2 py-1">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-lg font-semibold">AI Task Executor</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Workspace</p>
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
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-4 pb-1 pt-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Navigation</h3>
        </div>
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
                <span>{item.title}</span>
              </NavLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <div className="px-4 py-2">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Leadership</h3>
              <Badge variant="secondary" className="text-xs">
                {agents.filter(a => a.name === 'ceo').length}
              </Badge>
            </div>
            <div className="space-y-1">
              {agents.filter(a => a.name === 'ceo').map((agent) => (
                <AgentSidebarItem
                  key={agent.id}
                  agent={agent}
                />
              ))}
            </div>
          </div>
          
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Execution Agents</h3>
              <Badge variant="secondary" className="text-xs">
                {agents.filter(a => a.name !== 'ceo').length}
              </Badge>
            </div>
            <div className="space-y-1">
              {agents.filter(a => a.name !== 'ceo').map((agent) => (
                <AgentSidebarItem
                  key={agent.id}
                  agent={agent}
                />
              ))}
            </div>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
