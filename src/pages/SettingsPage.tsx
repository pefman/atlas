import { useState } from 'react';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { AppPage } from '@/components/layout/AppPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/settings/reset', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset');
      }
      toast.success('All data cleared');
      setResetDialogOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setResetting(false);
    }
  };

  return (
    <AppPage
      title="Settings"
      subtitle="Configure AI providers and application settings."
    >
      <SettingsForm />

      <Card className="mt-6 border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Reset All Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete all tasks, subtasks, messages, agents, execution logs, and notifications. AI provider settings will be preserved. Agents will be re-created on next server restart.
          </p>
          <Button
            variant="destructive"
            onClick={() => setResetDialogOpen(true)}
          >
            Reset All Data
          </Button>

          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Confirm Reset
                </DialogTitle>
                <DialogDescription>
                  This will permanently delete all tasks, subtasks, messages, agents, execution logs, and notifications. AI provider settings will be preserved. Agents will be re-created on next server restart. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReset} disabled={resetting}>
                  {resetting ? 'Resetting...' : 'Reset All Data'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </AppPage>
  );
}
