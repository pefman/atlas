import { useEffect } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Square,
  Settings,
  Calendar,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Dispatch = (value: boolean) => void;

interface CommandPaletteProps {
  open: boolean;
  setOpen: Dispatch;
}

export function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem
            onSelect={() => {
              navigate('/');
              setOpen(false);
            }}
          >
            <Square className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              navigate('/settings');
              setOpen(false);
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tasks">
          <CommandItem
            onSelect={() => {
              navigate('/');
              setOpen(false);
            }}
          >
            <Calendar className="mr-2 h-4 w-4" />
            <span>Create new task</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              navigate('/kanban');
              setOpen(false);
            }}
          >
            <Calendar className="mr-2 h-4 w-4" />
            <span>View Kanban board</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
