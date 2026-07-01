import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ExecutionLog {
  id: number;
  step: number;
  role_name: string;
  input: string;
  output: string;
  created_at: string;
}

interface ExecutionLogsProps {
  subtaskId: number;
}

export function ExecutionLogs({ subtaskId }: ExecutionLogsProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [subtaskId]);

  const fetchLogs = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/execute/logs/${subtaskId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setError('Failed to load execution logs');
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">No execution logs yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <Card key={log.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Step {log.step} - {log.role_name}</CardTitle>
              <Badge>{new Date(log.created_at).toLocaleTimeString()}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Input:</h4>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(log.input), null, 2);
                    } catch {
                      return log.input;
                    }
                  })()}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Output:</h4>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-64">
                  {log.output}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
