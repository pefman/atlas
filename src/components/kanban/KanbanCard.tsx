import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

interface Subtask {
  id: number;
  title: string;
  description: string;
  role_name: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
}

interface KanbanCardProps {
  subtask: Subtask;
  onExecute?: (subtaskId: number) => void;
}

export function KanbanCard({ subtask, onExecute }: KanbanCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm">{subtask.title}</h4>
        <Badge className="text-xs border-border">{subtask.role_name}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{subtask.description}</p>
      {onExecute && (
        <Button size="sm" variant="ghost" className="w-full" onClick={() => onExecute(subtask.id)}>
          <Play className="h-3 w-3 mr-1" /> Execute
        </Button>
      )}
    </div>
  );
}
