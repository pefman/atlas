# AI Endpoint Test Feature Design

**Date:** 2026-07-01  
**Status:** Approved

## Overview

Add a "Test Connection" button to the Settings page that verifies the AI provider endpoint is reachable and responding correctly before saving settings.

## Architecture

### Backend: `POST /api/settings/test`

- Accepts settings body (provider, endpoint, api_key, model)
- Instantiates the appropriate provider (OllamaProvider or OpenAIProvider)
- Sends test message: "Hello, please respond with 'pong'"
- Returns `{ success: true, response: "pong" }` or `{ success: false, error: "..." }`

### Frontend: SettingsForm

- Add "Test Connection" button (secondary variant)
- Disabled while testing (shows "Testing..." text)
- Shows success toast with AI response
- Shows error toast with failure details
- Handles CORS errors gracefully

## Implementation Details

### Backend Changes

**File:** `server/routes/settings.ts`

```typescript
// New route
router.post('/test', testSettings);

// Helper function
async function testProviderConnection(settings: {
  provider: string;
  endpoint?: string;
  api_key?: string;
  model: string;
}): Promise<{ success: boolean; response?: string; error?: string }> {
  let provider: AIProvider;
  
  if (settings.provider === 'openai') {
    provider = new OpenAIProvider(settings.api_key || '', settings.model);
  } else {
    provider = new OllamaProvider(settings.endpoint || 'http://localhost:11434', settings.model);
  }
  
  const response = await provider.chat([
    { role: 'system', content: 'You are a helpful assistant. Respond with exactly "pong".' },
    { role: 'user', content: 'Hello' }
  ]);
  
  return { success: true, response };
}
```

### Frontend Changes

**File:** `src/components/settings/SettingsForm.tsx`

Add state:
```typescript
const [testing, setTesting] = useState(false);
```

Add button:
```tsx
<Button type="button" variant="secondary" onClick={handleTest} disabled={saving || testing}>
  {testing ? 'Testing...' : 'Test Connection'}
</Button>
```

Add handler:
```typescript
const handleTest = async () => {
  setTesting(true);
  try {
    const res = await fetch('/api/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Test failed');
    toast.success(`Connection successful! Response: ${data.response}`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Test failed');
  } finally {
    setTesting(false);
  }
};
```

## Error Handling

| Error Type | User Message |
|------------|--------------|
| Network timeout | "Could not connect to AI endpoint. Check if the service is running." |
| Invalid response | "Invalid response from AI provider" |
| Provider error | Show provider-specific error (e.g., "Invalid API key" for OpenAI) |
| CORS error | "Could not connect. Make sure the AI service allows connections from localhost" |

## UI Layout

```
┌─────────────────────────────────────────┐
│ AI Provider                             │
│ Configure the AI provider for task execution. │
├─────────────────────────────────────────┤
│ Provider:    [Ollama ▼]                 │
│ Endpoint:    [http://localhost:11434   ] │
│ API Key:     [sk-...                   ] │
│ Model:       [llama3                   ] │
│                                         │
│         [Test Connection]  [Save Settings] │
└─────────────────────────────────────────┘
```

## Testing

- Test with Ollama running locally
- Test with OpenAI (valid API key)
- Test with invalid endpoint
- Test with invalid API key
- Test with network unavailable

## Files Modified

1. `server/routes/settings.ts` - Add test endpoint
2. `src/components/settings/SettingsForm.tsx` - Add test button and handler

## Files Created

None
