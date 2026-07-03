import { useState } from 'react';
import { Agent } from '@/types';
import { Button } from '@/components/ui/button';
import { AgentEditDialog } from './AgentEditDialog';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface AgentDetailProps {
  agent: Agent | null;
  onClose: () => void;
}

function roleLabel(name: string): string {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPrompt(prompt: string): string {
  return prompt.replace(/\\n/g, '\n').trim();
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

export function AgentDetail({ agent, onClose }: AgentDetailProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!agent) return null;

  const promptText = formatPrompt(agent.system_prompt);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      onClose();
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div className="space-y-4 border-t p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{roleLabel(agent.name)}</h3>
            <p className="font-mono text-xs text-muted-foreground">{agent.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close agent details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {agent.portrait && (
          <div className="flex justify-center py-2">
            <img
              src={`data:image/png;base64,${agent.portrait}`}
              alt=""
              className="w-16 h-16 rounded-lg"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}

        {agent.personality && (
          <div className="rounded-md border bg-card p-3">
            <label className="text-xs text-muted-foreground">Mail Personality</label>
            <p className="mt-1 text-sm">{agent.personality}</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-card p-3">
            <label className="text-xs text-muted-foreground">Status</label>
            <div className="mt-1">
              <Badge variant="secondary">{agentStatusLabel(agent.status)}</Badge>
            </div>
          </div>

          <div className="rounded-md border bg-card p-3 md:col-span-2">
            <label className="text-xs text-muted-foreground">Description</label>
            <p className="mt-1 text-sm leading-relaxed">{agent.description || 'No description'}</p>
          </div>

          <div className="rounded-md border bg-card p-3 md:col-span-3">
            <label className="text-xs text-muted-foreground">Current Task</label>
            <p className="mt-1 text-sm">{agent.current_task || 'None'}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">System Prompt</label>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {promptText.length} chars
            </Badge>
          </div>
          <pre className="max-h-[420px] overflow-y-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words">
            {promptText || 'No system prompt'}
          </pre>
        </div>

        {agent.portrait && (
          <div className="flex justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const res = await fetch(`/api/agents/${agent.id}/regenerate-portrait`, { method: 'POST' });
                if (res.ok) {
                  onClose();
                }
              }}
            >
              Regenerate Portrait
            </Button>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => setIsEditOpen(true)}>Edit</Button>
          {agent.name !== 'ceo' && (
            <Button size="sm" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              This will remove the agent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgentEditDialog
        agent={agent}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={() => {
          onClose();
        }}
      />
    </>
  );
}
