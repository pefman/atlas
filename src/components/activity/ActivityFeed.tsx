import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Brain, ListTodo, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useKanbanStream } from '@/contexts/KanbanStreamContext';

interface ActivityItem {
  time: string;
  role: string;
  action: string;
  subtask_id: number;
  task_id: number;
  title: string;
  task_title: string;
  output?: string;
}

interface ActivityFeedProps {
  limit?: number;
}

function getActionIcon(action: string) {
  switch (action) {
    case 'decompose':
      return <Brain className="h-3 w-3" />;
    case 'assign':
      return <ListTodo className="h-3 w-3" />;
    case 'execute':
      return <ArrowRight className="h-3 w-3" />;
    case 'review':
      return <CheckCircle2 className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
}

export function ActivityFeed({ limit = 50 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { useKanbanEvent } = useKanbanStream();

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/activity?limit=${limit}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setActivities(data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useKanbanEvent('subtask_start', () => void fetchActivities());
  useKanbanEvent('subtask_complete', () => void fetchActivities());
  useKanbanEvent('subtask_failed', () => void fetchActivities());
  useKanbanEvent('task_decomposed', () => void fetchActivities());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full">
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div
                key={`${activity.time}-${index}`}
                className="flex items-start gap-3 rounded-md border bg-muted/30 p-3"
              >
                <div className="mt-0.5 text-muted-foreground">
                  {getActionIcon(activity.action)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {activity.role}
                    </Badge>
                    <span>{activity.action}</span>
                    <span>·</span>
                    <span>{new Date(activity.time).toLocaleString()}</span>
                  </div>
                  <div className="text-sm font-medium">{activity.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Task: {activity.task_title}
                  </div>
                  {activity.output && (
                    <div className="rounded bg-background p-2 text-xs">
                      {activity.output}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No activity yet
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
