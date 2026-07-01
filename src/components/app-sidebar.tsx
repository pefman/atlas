import { Brain, Kanban, Settings, ListTodo, Moon, Sun } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useTheme } from '@/context/ThemeProvider';

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

export function AppSidebar() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-lg font-semibold">AI Task Executor</span>
          </div>
          <Switch checked={isDark} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
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
      </SidebarContent>
      <SidebarFooter>
        <p className="text-xs text-muted-foreground px-4">
          MVP v0.1
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
