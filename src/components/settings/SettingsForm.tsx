import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

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
      toast.success(`Connection successful! Response: ${data.response}`);
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error && err.name !== 'AbortError'
        ? err.message
        : err instanceof Error && err.name === 'AbortError'
          ? 'Connection timed out'
          : 'Test failed';
      toast.error(`Connection failed: ${message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>Configure the AI provider for task execution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <SelectItem value="ollama">Ollama</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Input
              id="endpoint"
              value={settings.endpoint}
              onChange={(e) => setSettings((s) => ({ ...s, endpoint: e.target.value }))}
              placeholder="http://localhost:11434"
            />
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
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            {models.length > 0 ? (
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
            ) : (
              <Input
                id="model"
                value={settings.model}
                onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                placeholder="llama3"
                disabled={fetchingModels}
              />
            )}
            {fetchingModels && <p className="text-xs text-muted-foreground">Fetching models...</p>}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleTest} disabled={saving || testing}>
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button type="submit" disabled={saving || testing}>
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
