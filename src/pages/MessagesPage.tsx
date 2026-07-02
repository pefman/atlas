import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppPage } from '@/components/layout/AppPage';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from '@/components/ui/message';
import { MessageScroller } from '@/components/ui/message-scroller';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { Agent, Message as ThreadMessage, MessageThread, MessageThreadStatus } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { CheckCheck, MessageSquarePlus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ThreadListResponse {
  threads: MessageThread[];
  unreadCount: number;
}

interface ThreadDetailsResponse {
  thread: MessageThread;
  messages: ThreadMessage[];
}

interface AssignedWorkResponse {
  agent: { id: number; name: string };
  tasks: Array<{ id: number; title: string; open_subtasks: number; total_subtasks: number }>;
  subtasks: Array<{ id: number; task_id: number; title: string; status: string; priority: string; task_title: string }>;
}

interface ClarificationPayload {
  type?: string;
  needs_clarification?: boolean;
  reason?: string;
  questions?: string[];
  missing_fields?: string[];
}

function parseClarificationMessage(content: string): ClarificationPayload | null {
  try {
    const parsed = JSON.parse(content) as ClarificationPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.type !== 'clarification_request' && parsed.needs_clarification !== true) return null;
    if (!Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function statusBadgeClass(status: MessageThreadStatus): string {
  if (status === 'resolved') return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100';
  if (status === 'awaiting_user') return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
  if (status === 'awaiting_agent') return 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100';
  return 'bg-secondary text-secondary-foreground';
}

function threadTitle(thread: MessageThread): string {
  return thread.subject || `Conversation with ${thread.role_name || `Agent #${thread.role_id}`}`;
}

export function MessagesPage() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [threadSearch, setThreadSearch] = useState('');
  const [reply, setReply] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [newAgentId, setNewAgentId] = useState<string>('');
  const [assignedWork, setAssignedWork] = useState<AssignedWorkResponse | null>(null);
  const [newTaskId, setNewTaskId] = useState<string>('none');
  const [newSubtaskId, setNewSubtaskId] = useState<string>('none');
  const [newSubject, setNewSubject] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedThread = useMemo(() => threads.find(t => t.id === selectedThreadId) || null, [threads, selectedThreadId]);

  const fetchThreads = useCallback(async () => {
    try {
      setLoadingThreads(true);
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') queryParams.set('status', statusFilter);
      if (categoryFilter !== 'all') queryParams.set('category', categoryFilter);
      const query = queryParams.toString();
      const response = await fetch(`/api/messages/threads${query ? `?${query}` : ''}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as ThreadListResponse;
      setThreads(data.threads);
      if (!selectedThreadId && data.threads.length > 0) {
        setSelectedThreadId(data.threads[0].id);
      }
      if (selectedThreadId && !data.threads.some(t => t.id === selectedThreadId)) {
        setSelectedThreadId(data.threads[0]?.id || null);
      }
    } catch (error) {
      console.error('Failed to load message threads:', error);
      toast.error('Failed to load message threads');
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedThreadId, statusFilter, categoryFilter]);

  const fetchThreadDetails = useCallback(async (threadId: number) => {
    try {
      setLoadingThread(true);
      const response = await fetch(`/api/messages/threads/${threadId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as ThreadDetailsResponse;
      setMessages(data.messages);
      setThreads(prev => prev.map(t => (t.id === data.thread.id ? { ...t, ...data.thread } : t)));

      await fetch(`/api/messages/threads/${threadId}/read`, { method: 'POST' });
      await fetchThreads();
    } catch (error) {
      console.error('Failed to load thread details:', error);
      toast.error('Failed to load thread details');
    } finally {
      setLoadingThread(false);
    }
  }, [fetchThreads]);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as Agent[];
      setAgents(data);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  }, []);

  const fetchAssignedWork = useCallback(async (agentId: number) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/assigned-work`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as AssignedWorkResponse;
      setAssignedWork(data);
      setNewTaskId('none');
      setNewSubtaskId('none');
    } catch (error) {
      console.error('Failed to load assigned work:', error);
      toast.error('Failed to load assigned work for selected agent');
      setAssignedWork(null);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    if (selectedThreadId) {
      void fetchThreadDetails(selectedThreadId);
    } else {
      setMessages([]);
    }
  }, [selectedThreadId, fetchThreadDetails]);

  const visibleThreads = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) => {
      const title = threadTitle(thread).toLowerCase();
      const role = (thread.role_name || '').toLowerCase();
      const message = (thread.last_message || '').toLowerCase();
      return title.includes(query) || role.includes(query) || message.includes(query);
    });
  }, [threads, threadSearch]);

  const visibleSubtasks = useMemo(() => {
    if (!assignedWork || newTaskId === 'none') return [];
    const taskId = parseInt(newTaskId);
    return assignedWork.subtasks.filter(s => s.task_id === taskId);
  }, [assignedWork, newTaskId]);

  const handleNewThread = async () => {
    if (!newAgentId || !newContent.trim()) {
      toast.error('Select an agent and write a message');
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: parseInt(newAgentId),
          subject: newSubject.trim() || null,
          content: newContent.trim(),
          task_id: newTaskId !== 'none' ? parseInt(newTaskId) : null,
          subtask_id: newSubtaskId !== 'none' ? parseInt(newSubtaskId) : null,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `HTTP ${response.status}`);
      }

      const data = await response.json() as { thread: MessageThread };
      setNewSubject('');
      setNewContent('');
      setNewTaskId('none');
      setNewSubtaskId('none');
      setComposeOpen(false);
      await fetchThreads();
      setSelectedThreadId(data.thread.id);
      toast.success('Conversation started');
    } catch (error) {
      console.error('Failed to create thread:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async () => {
    if (!selectedThreadId || !reply.trim()) {
      return;
    }

    try {
      const response = await fetch(`/api/messages/threads/${selectedThreadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_type: 'user', content: reply.trim() }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `HTTP ${response.status}`);
      }

      setReply('');
      await fetchThreadDetails(selectedThreadId);
      await fetchThreads();
      toast.success('Reply sent');
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reply');
    }
  };

  const handleRemoveThread = async () => {
    if (!selectedThreadId) return;
    const confirmed = window.confirm('Remove this conversation and all messages? This cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/messages/threads/${selectedThreadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `HTTP ${response.status}`);
      }

      setMessages([]);
      await fetchThreads();
      toast.success('Conversation removed');
    } catch (error) {
      console.error('Failed to remove thread:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove conversation');
    }
  };

  const updateThreadStatus = async (threadId: number, status: MessageThreadStatus) => {
    try {
      const response = await fetch(`/api/messages/threads/${threadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await fetchThreads();
      if (selectedThreadId === threadId) {
        await fetchThreadDetails(threadId);
      }
    } catch (error) {
      console.error('Failed to update thread status:', error);
      toast.error('Failed to update thread status');
    }
  };

  const unreadThreadCount = threads.reduce((sum, t) => sum + (t.unread_agent_messages || 0), 0);

  return (
    <AppPage
      title="Messages"
      subtitle="One place for agent conversations and clarifications."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { void fetchThreads(); }}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Inbox</CardTitle>
              <Badge variant="secondary">Threads {unreadThreadCount}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Search threads"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? 'all')}>
                <SelectTrigger className="w-[128px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="awaiting_user">Awaiting you</SelectItem>
                  <SelectItem value="awaiting_agent">Awaiting agent</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? 'all')}>
                <SelectTrigger className="w-[148px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="clarification">Clarifications</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CardDescription className="text-xs">
              Select a thread to view context and reply.
            </CardDescription>
            <div className="h-[560px] rounded-lg border">
              <MessageScroller className="h-[560px] border-0 p-2">
                {loadingThreads && <p className="text-xs text-muted-foreground">Loading threads...</p>}
                {!loadingThreads && visibleThreads.length === 0 && (
                  <p className="text-xs text-muted-foreground">No threads found.</p>
                )}
                {visibleThreads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full rounded-lg border p-2 text-left transition-colors ${selectedThreadId === thread.id ? 'border-primary bg-accent/50' : 'bg-background hover:bg-accent/20'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{threadTitle(thread)}</p>
                        <p className="text-xs text-muted-foreground">{thread.role_name || `Agent #${thread.role_id}`}</p>
                      </div>
                      <Badge className={statusBadgeClass(thread.status)}>
                        {thread.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {thread.last_message && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{thread.last_message}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {thread.last_message_at
                          ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })
                          : 'new'}
                      </span>
                      {(thread.unread_agent_messages || 0) > 0 && (
                        <Badge variant="secondary">{thread.unread_agent_messages}</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </MessageScroller>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {selectedThread ? threadTitle(selectedThread) : 'Conversation'}
                </CardTitle>
                <CardDescription>
                  {selectedThread
                    ? `${selectedThread.role_name || `Agent #${selectedThread.role_id}`} • ${selectedThread.task_id ? `Task #${selectedThread.task_id}` : 'No task linked'}`
                    : 'Select a thread to read and reply.'}
                </CardDescription>
              </div>
              {selectedThread && (
                <div className="flex items-center gap-2">
                  <Badge className={statusBadgeClass(selectedThread.status)}>
                    {selectedThread.status.replace('_', ' ')}
                  </Badge>
                  <Button variant="destructive" size="sm" onClick={() => void handleRemoveThread()}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                  {selectedThread.status !== 'resolved' ? (
                    <Button variant="outline" size="sm" onClick={() => void updateThreadStatus(selectedThread.id, 'resolved')}>
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Resolve
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => void updateThreadStatus(selectedThread.id, 'open')}>
                      Reopen
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {!selectedThread ? (
              <div className="flex h-[460px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                <p className="text-sm font-medium">Pick a thread from the inbox</p>
                <p className="mt-1 text-xs text-muted-foreground">Or start a new message to an agent.</p>
                <Button className="mt-4" onClick={() => setComposeOpen(true)}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  New Message
                </Button>
              </div>
            ) : (
              <>
                <MessageScroller className="h-[460px]">
                  {loadingThread && <p className="text-xs text-muted-foreground">Loading conversation...</p>}
                  {!loadingThread && messages.length === 0 && (
                    <p className="text-xs text-muted-foreground">No messages yet.</p>
                  )}

                  <MessageGroup>
                    {messages.map((message) => {
                      const isUser = message.sender_type === 'user';
                      return (
                        <Message key={message.id} align={isUser ? 'end' : 'start'}>
                          {!isUser && (
                            <MessageAvatar>
                              <Avatar size="sm">
                                <AvatarFallback>
                                  {(message.role_name || 'AI').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </MessageAvatar>
                          )}

                          <MessageContent className={isUser ? 'items-end' : ''}>
                            <MessageHeader className={isUser ? 'text-right' : ''}>
                              {isUser ? 'You' : (message.role_name || 'Agent')}
                            </MessageHeader>
                            <Bubble className={isUser ? 'justify-end' : 'justify-start'}>
                              <BubbleContent className={isUser ? 'bg-primary text-primary-foreground' : ''}>
                                {(() => {
                                  const clarification = parseClarificationMessage(message.content);
                                  if (!clarification) {
                                    return <p className="whitespace-pre-wrap text-sm">{message.content}</p>;
                                  }

                                  return (
                                    <div className="space-y-2 text-sm">
                                      <p className="font-medium">Clarification requested</p>
                                      {clarification.reason && (
                                        <p className="whitespace-pre-wrap text-sm">{clarification.reason}</p>
                                      )}
                                      {clarification.questions && clarification.questions.length > 0 && (
                                        <ul className="list-disc space-y-1 pl-5">
                                          {clarification.questions.map((question, index) => (
                                            <li key={`${message.id}-q-${index}`}>{question}</li>
                                          ))}
                                        </ul>
                                      )}
                                      {clarification.missing_fields && clarification.missing_fields.length > 0 && (
                                        <p className="text-xs opacity-80">
                                          Missing fields: {clarification.missing_fields.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </BubbleContent>
                            </Bubble>
                            <MessageFooter className={isUser ? 'text-right' : ''}>
                              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                            </MessageFooter>
                          </MessageContent>

                          {isUser && (
                            <MessageAvatar>
                              <Avatar size="sm">
                                <AvatarFallback>YO</AvatarFallback>
                              </Avatar>
                            </MessageAvatar>
                          )}
                        </Message>
                      );
                    })}
                  </MessageGroup>
                </MessageScroller>

                <div className="space-y-2 rounded-lg border p-3">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write your reply..."
                    className="min-h-24"
                  />
                  <div className="flex justify-end">
                    <Button onClick={() => void handleReply()} disabled={!reply.trim()}>
                      Send Reply
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={composeOpen} onOpenChange={setComposeOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New Message</SheetTitle>
            <SheetDescription>
              Start a conversation with an agent and optionally link task context.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 px-4">
            <Select
              value={newAgentId}
              onValueChange={(value) => {
                if (!value) return;
                setNewAgentId(value);
                void fetchAssignedWork(parseInt(value));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject (optional)"
            />

            <Select value={newTaskId} onValueChange={(value) => { setNewTaskId(value ?? 'none'); setNewSubtaskId('none'); }} disabled={!assignedWork}>
              <SelectTrigger>
                <SelectValue placeholder="Relevant task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task link</SelectItem>
                {(assignedWork?.tasks || []).map((task) => (
                  <SelectItem key={task.id} value={String(task.id)}>
                    #{task.id} {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newSubtaskId} onValueChange={(value) => setNewSubtaskId(value ?? 'none')} disabled={visibleSubtasks.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="Assigned subtask (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No subtask link</SelectItem>
                {visibleSubtasks.map((subtask) => (
                  <SelectItem key={subtask.id} value={String(subtask.id)}>
                    #{subtask.id} {subtask.title} ({subtask.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your message to the selected agent..."
              className="min-h-28"
            />
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleNewThread()} disabled={creating || !newAgentId || !newContent.trim()}>
              {creating ? 'Creating...' : 'Start Conversation'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppPage>
  );
}
