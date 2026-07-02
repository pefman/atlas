import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Brain, Clock, CheckCircle2, ListTodo } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskStatus } from '@/types';
import { priorityColors } from '@/lib/priority';
import { AppPage } from '@/components/layout/AppPage';

interface Subtask {
  id: number;
  task_id: number;
  task_title: string;
  title: string;
  description: string;
  role_name: string;
  status: TaskStatus;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
}

interface Output {
  id: number;
  subtask_id: number;
  content: string;
  created_at: string;
}

interface ExecutionLog {
  id: number;
  subtask_id: number;
  step: number;
  step_type: string;
  role_name: string;
  input: string;
  output: string;
  created_at: string;
}

interface SubtaskDetailData {
  subtask: Subtask;
  outputs: Output[];
  logs: ExecutionLog[];
}

interface SubtaskDetailProps {
  subtaskId: number;
  onBack: () => void;
}

function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case 'backlog':
      return <Clock className="h-4 w-4" />;
    case 'in_progress':
      return <Brain className="h-4 w-4" />;
    case 'review':
      return <ListTodo className="h-4 w-4" />;
    case 'done':
      return <CheckCircle2 className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

export function SubtaskDetail({ subtaskId, onBack }: SubtaskDetailProps) {
  const [data, setData] = useState<SubtaskDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubtask();
  }, [subtaskId]);

  const fetchSubtask = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/subtasks/${subtaskId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch subtask:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppPage>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppPage>
    );
  }

  if (!data) {
    return (
      <AppPage>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Subtask not found</p>
        </div>
      </AppPage>
    );
  }

  const { subtask, outputs, logs } = data;

  return (
    <AppPage
      title={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span>Subtask: {subtask.title}</span>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header with status and priority */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`text-xs ${priorityColors[subtask.priority]}`}>
            {subtask.priority}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            {getStatusIcon(subtask.status)}
            {subtask.status}
          </Badge>
          <Badge variant="secondary">{subtask.role_name}</Badge>
        </div>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Parent Task:</span>
              <span className="ml-2 text-sm">{subtask.task_title}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Created:</span>
              <span className="ml-2 text-sm">{new Date(subtask.created_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Updated:</span>
              <span className="ml-2 text-sm">{new Date(subtask.updated_at).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{subtask.description}</p>
          </CardContent>
        </Card>

        {/* Outputs */}
        {outputs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Outputs ({outputs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                <div className="space-y-4">
                  {outputs.map((output, index) => (
                    <div key={output.id} className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Output {index + 1}</span>
                        <span>·</span>
                        <span>{new Date(output.created_at).toLocaleString()}</span>
                      </div>
                      <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                        {output.content}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Execution Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Execution Logs ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                <div className="space-y-4">
                  {logs.map((log, index) => (
                    <div key={log.id} className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Step {log.step} - {log.step_type}</span>
                        <span>·</span>
                        <span>{log.role_name}</span>
                        <span>·</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      {log.input && (
                        <div className="rounded-md bg-muted/30 p-2 text-xs">
                          <span className="font-medium">Input:</span>
                          <p className="mt-1 whitespace-pre-wrap">{log.input}</p>
                        </div>
                      )}
                      {log.output && (
                        <div className="rounded-md bg-primary/5 p-2 text-xs">
                          <span className="font-medium">Output:</span>
                          <p className="mt-1 whitespace-pre-wrap">{log.output}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </AppPage>
  );
}
