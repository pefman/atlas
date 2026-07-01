import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock } from 'lucide-react';

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: string;
  stepType?: 'assign' | 'execute';
}

interface SubtaskMessage {
  subtaskId: number;
  subtaskTitle: string;
  subtaskStatus: string;
  roleInitials: string;
  messages: ConversationMessage[];
}

interface ConversationViewProps {
  subtasks: Array<{
    id: number;
    title: string;
    status: string;
    role_name: string;
  }>;
}

export function ConversationView({ subtasks }: ConversationViewProps) {
  const [logs, setLogs] = useState<Map<number, any[]>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const fetchLogs = async () => {
      setError(null);
      const newLogs = new Map<number, any[]>();

      const fetchPromises = subtasks.map(async (subtask) => {
        try {
          const response = await fetch(`/api/execute/logs/${subtask.id}`, { signal });
          if (response.ok) {
            const data = await response.json();
            newLogs.set(subtask.id, data);
          }
        } catch (err) {
          if (!signal.aborted) {
            console.error(`Failed to fetch logs for subtask ${subtask.id}:`, err);
          }
        }
      });

      await Promise.all(fetchPromises);

      if (!signal.aborted) {
        if (newLogs.size === 0 && subtasks.length > 0) {
          setError('Failed to load execution logs');
        }
        setLogs(newLogs);
      }
    };

    fetchLogs();

    return () => {
      abortController.abort();
    };
  }, [subtasks]);

  const conversationData: SubtaskMessage[] = subtasks.map(subtask => ({
    subtaskId: subtask.id,
    subtaskTitle: subtask.title,
    subtaskStatus: subtask.status,
    roleInitials: getRoleInitials(subtask.role_name),
    messages: transformLogsToConversation(logs.get(subtask.id) || []),
  }));

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-destructive">
        {error}
      </div>
    );
  }

  if (subtasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <div className="text-center">
          <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-muted-foreground">No execution logs yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Logs will appear after subtasks are executed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {conversationData.map((subtask) => (
        <div key={subtask.subtaskId}>
          <SubtaskHeader subtask={subtask} />
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            <div className="space-y-3">
              {subtask.messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

function getRoleInitials(roleName: string): string {
  const initials = roleName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || roleName[0].toUpperCase();
}

function SubtaskHeader({ subtask }: { subtask: SubtaskMessage }) {
  return (
    <div className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback className="bg-accent text-accent-foreground text-xs">
            {subtask.roleInitials}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm">{subtask.subtaskTitle}</span>
      </div>
      <Badge variant="secondary">{subtask.subtaskStatus}</Badge>
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';
  const isAssign = message.stepType === 'assign';

  const baseClasses = 'rounded-lg p-3 border';

  let styleClasses = '';
  if (isSystem) {
    styleClasses = `${baseClasses} bg-muted text-muted-foreground text-xs max-w-[80%]`;
  } else if (isAssistant) {
    styleClasses = `${baseClasses} bg-primary text-primary-foreground text-sm max-w-[80%] ml-auto`;
  } else {
    styleClasses = `${baseClasses} bg-card text-foreground text-sm max-w-[80%]`;
  }

  if (isAssign) {
    return (
      <div className="flex justify-center">
        <div className={`${baseClasses} bg-secondary text-secondary-foreground text-xs py-2 px-4`}>
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback className="bg-accent text-accent-foreground text-[10px]">
                CEO
              </AvatarFallback>
            </Avatar>
            <span>Assigned to {message.content}</span>
            {message.timestamp && (
              <Clock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isAssistant ? 'justify-end' : 'justify-start'}`}>
      {!isAssistant && (
        <Avatar size="sm">
          <AvatarFallback className="bg-accent text-accent-foreground text-xs">
            {message.role === 'system' ? 'SYS' : 'USR'}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={styleClasses}>
        {message.content}
        {message.timestamp && (
          <div className="text-muted-foreground text-xs mt-1">
            {message.timestamp}
          </div>
        )}
      </div>
    </div>
  );
}

export function transformLogsToConversation(logs: any[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  logs.forEach((log: any) => {
    if (log.step_type === 'assign') {
      messages.push({
        role: 'user',
        content: log.output || 'Assigned',
        timestamp: new Date(log.created_at).toLocaleTimeString(),
        stepType: 'assign',
      });
      return;
    }

    try {
      const inputMessages = JSON.parse(log.input);
      if (Array.isArray(inputMessages)) {
        inputMessages.forEach((msg: any, idx: number) => {
          if (msg.role && msg.content) {
            messages.push({
              role: msg.role as 'system' | 'user' | 'assistant',
              content: msg.content,
              timestamp: idx === 0 ? new Date(log.created_at).toLocaleTimeString() : undefined,
            });
          }
        });
      }
    } catch (e) {
      messages.push({
        role: 'user',
        content: log.input,
        timestamp: new Date(log.created_at).toLocaleTimeString(),
      });
    }

    if (log.output) {
      messages.push({
        role: 'assistant',
        content: log.output,
        timestamp: new Date(log.created_at).toLocaleTimeString(),
      });
    }
  });

  return messages;
}
