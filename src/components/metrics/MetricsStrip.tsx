import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, CheckCircle2, AlertTriangle, Activity, Zap, RotateCcw } from 'lucide-react';

interface Metrics {
  subtasks: {
    total: number;
    done: number;
    in_progress: number;
    review: number;
    failed: number;
    backlog: number;
  };
  successRate: number;
  tokens: {
    input: number;
    output: number;
  };
  calls: number;
  tasksDoneToday: number;
}

export function MetricsStrip() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics')
      .then(res => res.json())
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !metrics) {
    return null;
  }

  const { subtasks, successRate, tokens, calls } = metrics;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-6 sm:gap-3 sm:text-sm">
      <MetricTile
        icon={<BarChart3 className="h-4 w-4" />}
        label="Total"
        value={subtasks.total}
      />
      <MetricTile
        icon={<Activity className="h-4 w-4" />}
        label="Active"
        value={subtasks.in_progress + subtasks.review}
      />
      <MetricTile
        icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        label="Done"
        value={subtasks.done}
      />
      <MetricTile
        icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        label="Failed"
        value={subtasks.failed}
        className={subtasks.failed > 0 ? 'border-red-200 bg-red-50' : ''}
      />
      <MetricTile
        icon={<RotateCcw className="h-4 w-4" />}
        label="Success Rate"
        value={`${successRate}%`}
      />
      <MetricTile
        icon={<Zap className="h-4 w-4" />}
        label="Tokens"
        value={formatTokens(tokens.input + tokens.output)}
      />
    </div>
  );
}

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  className?: string;
}

function MetricTile({ icon, label, value, className }: MetricTileProps) {
  return (
    <div className={`rounded-md border bg-card px-2 py-1.5 sm:px-3 sm:py-2 ${className || ''}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}
