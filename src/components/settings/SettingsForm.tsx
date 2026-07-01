import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, TestTube, Save, Trash2, Wifi, WifiOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Settings = {
  provider: 'ollama' | 'openai';
  endpoint: string;
  api_key?: string;
  model: string;
};

const defaultSettings: Settings = {
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama3',
};

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch((err) => console.error('Failed to fetch settings:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (settings.provider && (settings.provider === 'ollama' || settings.provider === 'openai')) {
      setFetchingModels(true);
      fetch('/api/settings/models')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch models');
          return res.json();
        })
        .then((data) => {
          setModels(data);
          if (data.length > 0 && !settings.model) {
            setSettings((s) => ({ ...s, model: data[0].id }));
          }
        })
        .catch((err) => console.error('Failed to fetch models:', err))
        .finally(() => setFetchingModels(false));
    }
  }, [settings.provider, settings.endpoint, settings.api_key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.status === 408 || res.status === 0) {
        throw new Error('Connection timed out');
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Test failed');
      setTestResult({ success: true, message: `Connection successful! Response: ${data.response}` });
      toast.success(`Connection successful! Response: ${data.response}`);
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error && err.name !== 'AbortError'
        ? err.message
        : err instanceof Error && err.name === 'AbortError'
          ? 'Connection timed out'
          : 'Test failed';
      setTestResult({ success: false, message: `Connection failed: ${message}` });
      toast.error(`Connection failed: ${message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to clear settings');
      setSettings(defaultSettings);
      setModels([]);
      setTestResult(null);
      setClearDialogOpen(false);
      toast.success('Settings cleared');
    } catch (err) {
      toast.error('Failed to clear settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="provider" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="provider">AI Provider</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* AI Provider Tab */}
        <TabsContent value="provider">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  AI Provider Configuration
                </CardTitle>
                <CardDescription>
                  Configure the AI provider for task execution and decomposition
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={settings.provider}
                      onValueChange={(value: 'ollama' | 'openai' | null) => setSettings((s) => ({ ...s, provider: value ?? 'ollama' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ollama">
                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4" />
                            <span>Ollama</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="openai">
                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4" />
                            <span>OpenAI</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {settings.provider === 'ollama' 
                        ? 'Local AI model running on your machine' 
                        : 'Cloud-based AI model via OpenAI-compatible endpoint'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endpoint">Endpoint URL</Label>
                    <Input
                      id="endpoint"
                      value={settings.endpoint}
                      onChange={(e) => setSettings((s) => ({ ...s, endpoint: e.target.value }))}
                      placeholder="http://localhost:11434"
                    />
                    <p className="text-xs text-muted-foreground">
                      {settings.provider === 'ollama'
                        ? 'Default Ollama endpoint'
                        : 'OpenAI-compatible API endpoint (e.g., https://ai.example.com/v1)'}
                    </p>
                  </div>
                </div>

                {settings.provider === 'openai' && (
                  <div className="space-y-2">
                    <Label htmlFor="api_key">API Key</Label>
                    <Input
                      id="api_key"
                      type="password"
                      value={settings.api_key || ''}
                      onChange={(e) => setSettings((s) => ({ ...s, api_key: e.target.value }))}
                      placeholder="sk-..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Your API key for authentication. Leave empty to use environment variable.
                    </p>
                  </div>
                )}

                {models.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Select
                      value={settings.model}
                      onValueChange={(value: string | null) => setSettings((s) => ({ ...s, model: value || '' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fetchingModels && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Fetching models...
                      </div>
                    )}
                  </div>
                )}

                {testResult && (
                  <div className={`status-banner ${testResult.success ? 'status-banner-success' : 'status-banner-danger'}`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <Wifi className="h-4 w-4" />
                      ) : (
                        <WifiOff className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        {testResult.message}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleTest}
                    disabled={saving || testing || fetchingModels}
                    className="flex items-center gap-2"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || testing || fetchingModels}
                    className="flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Application-wide settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/50">
                <h3 className="font-medium mb-2">Task Execution</h3>
                <p className="text-sm text-muted-foreground">
                  Tasks are decomposed by the CEO and assigned across a software-company team
                  (product manager, tech lead, frontend, backend, QA, and SEO). The CEO processes
                  one backlog task at a time.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/50">
                <h3 className="font-medium mb-2">Real-time Updates</h3>
                <p className="text-sm text-muted-foreground">
                  The interface polls for updates every 3 seconds to keep task and agent 
                  statuses current.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Advanced Settings
              </CardTitle>
              <CardDescription>
                Warning: These actions cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                <h3 className="font-medium text-destructive mb-2">Reset All Settings</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This will delete all AI provider settings and reset to default configuration. 
                  Task and agent data will be preserved.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setClearDialogOpen(true)}
                  disabled={saving || testing}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Clear All Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Settings</DialogTitle>
            <DialogDescription>
              This will delete all AI provider settings and reset to default configuration. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear} disabled={saving || testing}>
              {saving ? 'Clearing...' : 'Clear All Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
