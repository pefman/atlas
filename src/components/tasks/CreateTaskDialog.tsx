import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface CreateTaskDialogProps {
  onTaskCreated: () => void;
}

export function CreateTaskDialog({ onTaskCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      toast.success('Task created successfully');
      setOpen(false);
      setTitle('');
      setDescription('');
      onTaskCreated();
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Create Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Define a task for the AI to execute. The CEO will automatically assign work to appropriate agents.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task in detail..."
              rows={4}
              required
            />
          </div>
          
          <Button type="submit" disabled={creating || !title || !description}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating...
              </>
            ) : (
              'Create Task'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
