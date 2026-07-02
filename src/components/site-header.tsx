import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useLocation } from 'react-router-dom';

interface SiteHeaderProps {
  titleOverride?: string;
}

function getTitle(pathname: string) {
  if (pathname.startsWith('/task/')) return 'Task Details';
  if (pathname === '/settings') return 'Settings';
  if (pathname === '/tasks') return 'Tasks';
  if (pathname === '/messages') return 'Messages';
  if (pathname === '/agents') return 'Agents';
  return 'Kanban';
}

export function SiteHeader({ titleOverride }: SiteHeaderProps) {
  const location = useLocation();
  const title = titleOverride ?? getTitle(location.pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:h-16 sm:gap-3 sm:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />
      <h1 className="truncate text-sm font-semibold sm:text-lg">{title}</h1>
      <div className="ml-auto" />
    </header>
  );
}
