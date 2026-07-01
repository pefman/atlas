import { useState } from 'react';
import { Agent } from '@/types';
import { Button } from '@/components/ui/button';
import { AgentEditDialog } from './AgentEditDialog';
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

export function AgentDetail({ agent, onClose }: AgentDetailProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!agent) return null;

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
      <div className="p-4 border-t">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{agent.name}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close agent details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <p className="text-sm capitalize">{agent.status}</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <p className="text-sm">{agent.description}</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Current Task</label>
            <p className="text-sm">{agent.current_task || 'None'}</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">System Prompt</label>
            <div className="text-xs bg-muted p-2 rounded max-h-[200px] overflow-y-auto">
              {agent.system_prompt}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
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
