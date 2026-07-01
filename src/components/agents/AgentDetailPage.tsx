import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Agent, Subtask } from '@/types';

type ExecEvent =
  | { type: 'subtask_start'; subtaskId: number; role: string; title: string }
  | { type: 'subtask_progress'; subtaskId: number; output: string }
  | { type: 'subtask_complete'; subtaskId: number; role: string; output: string }
  | { type: 'error'; subtaskId: number; error: string };
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Brain, Loader2, Pencil, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { AgentEditDialog } from './AgentEditDialog';
import { useEventSource } from '@/hooks/useEventSource';

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);

  const streamUrl = id ? `/api/execute/stream?taskId=0` : null;
  const { events, connected } = useEventSource(streamUrl);

  useEffect(() => {
    if (!id) return;

    const fetchAgent = async () => {
      try {
        const res = await fetch(`/api/agents/${id}`);
        const data = await res.json();
        setAgent(data);
      } catch (error) {
        console.error('Failed to fetch agent:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const fetchSubtasks = async () => {
      try {
        const res = await fetch(`/api/subtasks?roleId=${id}`);
        const data = await res.json();
        setSubtasks(data);
      } catch (error) {
        console.error('Failed to fetch subtasks:', error);
      }
    };

    fetchSubtasks();
    const interval = setInterval(fetchSubtasks, 3000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleDelete = async () => {
    if (!id || !confirm('Delete this agent?')) return;
    
    try {
      setDeleting(true);
      await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      navigate('/');
    } catch (error) {
      console.error('Failed to delete agent:', error);
    } finally {
      setDeleting(false);
    }
  };

  const getExecEventSummary = (event: ExecEvent) => {
    switch (event.type) {
      case 'subtask_start':
        return {
          type: 'start',
          role: event.role,
          title: event.title,
          time: new Date().toLocaleTimeString(),
        };
      case 'subtask_progress':
        return {
          type: 'progress',
          subtaskId: event.subtaskId,
          output: event.output,
          time: new Date().toLocaleTimeString(),
        };
      case 'subtask_complete':
        return {
          type: 'complete',
          role: event.role,
          output: event.output,
          time: new Date().toLocaleTimeString(),
        };
      case 'error':
        return {
          type: 'error',
          subtaskId: event.subtaskId,
          error: event.error,
          time: new Date().toLocaleTimeString(),
        };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-destructive">Agent not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeSubtasks = subtasks.filter(s => s.status === 'in_progress' || s.status === 'backlog');
  const completedSubtasks = subtasks.filter(s => s.status === 'done' || s.status === 'review');

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              {agent.name}
              <Badge variant={agent.status === 'idle' ? 'secondary' : 'default'}>
                {agent.status}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIsEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit Prompt
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      {connected && (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full" />
          <div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Live stream active
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              Watching for execution events...
            </p>
          </div>
        </div>
      )}

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            System Prompt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full rounded-md border p-4 text-sm">
            {agent.system_prompt}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Subtasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Subtasks
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {completedSubtasks.length} / {subtasks.length} complete
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subtasks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No subtasks yet
            </div>
          ) : (
            <div className="space-y-3">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-start gap-3 p-3 rounded-md border"
                >
                  <div className="mt-1">
                    {subtask.status === 'done' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : subtask.status === 'in_progress' ? (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{subtask.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{subtask.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {subtask.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Events */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Live Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border p-4 space-y-3">
              {events.map((event, idx) => {
                const summary = getExecEventSummary(event);
                
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-md border ${
                      summary.type === 'error'
                        ? 'border-red-200 bg-red-50 dark:bg-red-950'
                        : summary.type === 'complete'
                        ? 'border-green-200 bg-green-50 dark:bg-green-950'
                        : 'border-blue-200 bg-blue-50 dark:bg-blue-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {summary.type === 'start' && <Brain className="h-4 w-4 text-blue-500" />}
                        {summary.type === 'progress' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                        {summary.type === 'complete' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {summary.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                        <span className="text-sm font-medium capitalize">
                          {summary.type === 'start' ? `${summary.role} started` : 
                           summary.type === 'progress' ? 'Progress' :
                           summary.type === 'complete' ? `${summary.role} completed` :
                           'Error'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{summary.time}</span>
                    </div>
                    
                    {summary.type === 'start' && (
                      <p className="text-sm">{summary.title}</p>
                    )}
                    
                    {(summary.type === 'progress' || summary.type === 'complete') && (
                      <div className="mt-2 p-2 bg-background/50 rounded text-xs font-mono max-h-[150px] overflow-y-auto">
                        {summary.type === 'complete' && (summary as any).output?.length > 200
                          ? (summary as any).output?.substring(0, 200) + '...'
                          : (summary as any).output
                        }
                      </div>
                    )}
                    
                    {summary.type === 'error' && (
                      <p className="text-sm text-red-600 dark:text-red-400">{(summary as any).error}</p>
                    )}
                  </div>
                );
              })}
              <div ref={outputEndRef} />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <AgentEditDialog
        agent={agent}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={(updated) => {
          setAgent(updated);
        }}
      />
    </div>
  );
}
