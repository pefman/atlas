import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPage } from '@/components/layout/AppPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Agent } from '@/types';
import { Search } from 'lucide-react';
import { formatTokens } from '@/lib/utils';

function roleLabel(name: string): string {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function agentStatusLabel(status: Agent['status']): string {
  switch (status) {
    case 'reading_email':
      return 'Reading mail';
    case 'answering_email':
      return 'Answering mail';
    case 'decomposing':
      return 'Decomposing';
    case 'executing':
      return 'Executing';
    case 'reviewing':
      return 'Reviewing';
    case 'completed':
      return 'Completed';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

export function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async (showLoading: boolean = false) => {
      try {
        if (showLoading) {
          setLoading(true);
        }
        const response = await fetch('/api/agents?canonical=true');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as Agent[];
        if (mounted) {
          setAgents(data);
        }
      } catch (error) {
        console.error('Failed to load agents library:', error);
      } finally {
        if (mounted && showLoading) {
          setLoading(false);
        }
      }
    };

    void load(true);
    const interval = setInterval(() => {
      void load(false);
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const visibleAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) => {
      const haystack = [agent.name, agent.description || '', agent.current_task || '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [agents, search]);

  const selectableCount = agents.filter((agent) => agent.selectable_by_ceo).length;

  return (
    <AppPage
      title="Agents"
      subtitle="Library of canonical agents and skills. CEO can assign work only to CEO-selectable agents from this list."
      actions={<Badge variant="secondary">CEO-selectable {selectableCount}</Badge>}
    >
      <Card>
        <CardHeader className="space-y-2 pb-3">
          <CardTitle className="text-base">Agent Library</CardTitle>
          <CardDescription>
            Browse available specialist agents, their prompts, and activity footprint.
          </CardDescription>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents"
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading agents...</p>}
          {!loading && visibleAgents.length === 0 && (
            <p className="text-sm text-muted-foreground">No agents found.</p>
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleAgents.map((agent) => (
              <Card key={agent.id} className="border-border/80">
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-start gap-2">
                      {agent.portrait ? (
                        <img
                          src={`data:image/png;base64,${agent.portrait}`}
                          alt=""
                          className="h-7 w-7 rounded"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="truncate text-sm">{agent.funny_name || roleLabel(agent.name)}</CardTitle>
                        {agent.funny_name && (
                          <CardDescription className="truncate font-mono text-[10px] text-muted-foreground">
                            {roleLabel(agent.name)}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={agent.selectable_by_ceo ? 'default' : 'secondary'} className="h-5 text-[10px]">
                        {agent.selectable_by_ceo ? 'CEO-selectable' : 'Orchestrator'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {agent.description || 'No description'}
                  </p>

                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="h-5 text-[10px]">{agentStatusLabel(agent.status)}</Badge>
                    {agent.stats && (
                      <Badge variant="secondary" className="h-5 text-[10px]">
                        Calls {agent.stats.totalCalls}
                      </Badge>
                    )}
                    {agent.stats && (
                      <Badge variant="secondary" className="h-5 text-[10px]">
                        Tokens {formatTokens((agent.stats.inputTokens || 0) + (agent.stats.outputTokens || 0))}
                      </Badge>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/agent/${agent.id}`)}>
                      Open Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppPage>
  );
}
