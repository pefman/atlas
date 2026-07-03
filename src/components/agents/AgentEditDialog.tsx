import { useState } from 'react';
import { Agent } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface AgentEditDialogProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Agent) => void;
}

export function AgentEditDialog({ agent, isOpen, onClose, onSave }: AgentEditDialogProps) {
  if (!agent) return null;

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [system_prompt, setSystem_prompt] = useState(agent.system_prompt);
  const [personality, setPersonality] = useState(agent.personality || '');

  const handleSave = async () => {
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, system_prompt, personality }),
    });

    if (res.ok) {
      onSave({ ...agent, name, description, system_prompt, personality });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agent description"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Mail Personality</label>
            <p className="text-xs text-muted-foreground mt-1">
              Tone and style tags for email replies only. Does not affect task execution.
            </p>
            <Input
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="e.g., formal, concise, dry humor"
            />
          </div>

          {agent.portrait && (
            <div>
              <label className="text-sm font-medium">Portrait</label>
              <div className="mt-1 flex items-center gap-3">
                <img
                  src={`data:image/png;base64,${agent.portrait}`}
                  alt=""
                  className="w-12 h-12 rounded border"
                  style={{ imageRendering: 'pixelated' }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const res = await fetch(`/api/agents/${agent.id}/regenerate-portrait`, { method: 'POST' });
                    if (res.ok) {
                      const data = await res.json();
                      onSave({ ...agent, portrait: data.portrait });
                    }
                  }}
                >
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">System Prompt</label>
            <Textarea
              value={system_prompt}
              onChange={(e) => setSystem_prompt(e.target.value)}
              placeholder="Agent system prompt"
              rows={10}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
