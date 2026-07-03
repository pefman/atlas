import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { AppPage } from '@/components/layout/AppPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, RefreshCw, Palette, UserCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const navigate = useNavigate();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [regeneratingAvatars, setRegeneratingAvatars] = useState(false);
  const [regeneratingPersonalities, setRegeneratingPersonalities] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/settings/reset', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset');
      }
      toast.success('Execution data cleared. Agent templates preserved.');
      setResetDialogOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setResetting(false);
    }
  };

  const handleRegenerateAvatars = async () => {
    setRegeneratingAvatars(true);
    try {
      const res = await fetch('/api/settings/regenerate/portraits', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to regenerate');
      }
      const data = await res.json();
      toast.success(`Regenerated ${data.regenerated} avatar(s) with new styles!`);
      setTimeout(() => navigate('/agents'), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate avatars');
    } finally {
      setRegeneratingAvatars(false);
    }
  };

  const handleRegeneratePersonalities = async () => {
    setRegeneratingPersonalities(true);
    try {
      const res = await fetch('/api/settings/regenerate/personalities', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to regenerate');
      }
      const data = await res.json();
      toast.success(`Regenerated ${data.regenerated} personality(s) with new traits!`);
      setTimeout(() => navigate('/agents'), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate personalities');
    } finally {
      setRegeneratingPersonalities(false);
    }
  };

  return (
    <AppPage
      title="Settings"
      subtitle="Configure AI providers and application settings."
    >
      <SettingsForm />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Regenerate Avatars
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Regenerate all agent avatars with new deterministic pixel art styles. Each role will get a unique combination of colors, gender, and funny name.
          </p>
          <Button
            onClick={handleRegenerateAvatars}
            disabled={regeneratingAvatars}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regeneratingAvatars ? 'animate-spin' : ''}`} />
            {regeneratingAvatars ? 'Regenerating...' : 'Regenerate All Avatars'}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Regenerate Personalities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Regenerate all agent personality traits, strengths, and areas for growth. Each role will get a unique combination of characteristics.
          </p>
          <Button
            onClick={handleRegeneratePersonalities}
            disabled={regeneratingPersonalities}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regeneratingPersonalities ? 'animate-spin' : ''}`} />
            {regeneratingPersonalities ? 'Regenerating...' : 'Regenerate All Personalities'}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6 border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Reset All Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete projects, repo assets, tasks, subtasks, messages, execution logs, and notifications. AI provider settings and agent templates are preserved.
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
                  This will permanently delete projects, repo assets, tasks, subtasks, messages, execution logs, and notifications. AI provider settings and agent templates are preserved. This action cannot be undone.
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
