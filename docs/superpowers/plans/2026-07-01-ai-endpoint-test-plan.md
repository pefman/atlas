# AI Endpoint Test Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Test Connection" button to the Settings page that verifies the AI provider endpoint is reachable and responding correctly.

**Architecture:** Backend exposes `POST /api/settings/test` endpoint that instantiates the appropriate provider (Ollama/OpenAI) and sends a test message. Frontend calls this endpoint and displays the result.

**Tech Stack:** TypeScript, Express 5, React 18, shadcn/ui, better-sqlite3, Ollama/OpenAI providers

## Global Constraints

- Follow existing patterns in `server/routes/settings.ts` for route structure
- Use `toast` from `sonner` for success/error messages (already imported in SettingsForm)
- TypeScript strict mode enabled — no implicit any
- shadcn/ui v4.12 uses Base UI — **no `asChild` prop**
- Test message: "Hello, please respond with 'pong'"
- Button variants: Test = `secondary`, Save = default (primary)

---

### Task 1: Add backend test endpoint

**Files:**
- Modify: `server/routes/settings.ts`

**Interfaces:**
- Consumes: `OllamaProvider` from `./ai/ollama`, `OpenAIProvider` from `./ai/openai`, `AIProvider` from `./ai/provider`
- Produces: `POST /api/settings/test` endpoint accepting `{ provider, endpoint?, api_key?, model }`

- [ ] **Step 1: Add imports for AI providers**

Add to imports at top of `server/routes/settings.ts`:
```typescript
import { OllamaProvider } from '../ai/ollama';
import { OpenAIProvider } from '../ai/openai';
import { AIProvider, Message } from '../ai/provider';
```

- [ ] **Step 2: Add test settings handler function**

Add after the existing `router.put('/', ...)` block (before `export default router`):
```typescript
async function testSettings(req: Request, res: Response) {
  try {
    const { provider, endpoint, api_key, model } = req.body;
    
    let aiProvider: AIProvider;
    
    if (provider === 'openai') {
      aiProvider = new OpenAIProvider(api_key || '', model);
    } else {
      aiProvider = new OllamaProvider(endpoint || 'http://localhost:11434', model);
    }
    
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant. Respond with exactly "pong".' },
      { role: 'user', content: 'Hello' }
    ];
    
    const response = await aiProvider.chat(messages);
    
    res.json({ success: true, response });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Test failed';
    res.status(500).json({ success: false, error: errorMessage });
  }
}
```

- [ ] **Step 3: Register the test route**

Add after the existing PUT route but before `export default router`:
```typescript
router.post('/test', testSettings);
```

- [ ] **Step 4: Run TypeScript compiler to verify**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Test the endpoint manually**

Run: `npx tsx server/index.ts &`
Wait 2 seconds, then:
```bash
curl -X POST http://localhost:3001/api/settings/test \
  -H "Content-Type: application/json" \
  -d '{"provider":"ollama","endpoint":"http://localhost:11434","model":"llama3"}'
```
Expected: `{"success":true,"response":"pong"}` or similar response (requires Ollama running)

- [ ] **Step 6: Commit backend changes**

```bash
git add server/routes/settings.ts
git commit -m "feat: add AI endpoint test API"
```

---

### Task 2: Add frontend test button and handler

**Files:**
- Modify: `src/components/settings/SettingsForm.tsx`

**Interfaces:**
- Consumes: `toast` from `sonner` (already imported), `Button` from `@/components/ui/button` (already imported)
- Produces: `handleTest` function, `testing` state, "Test Connection" button

- [ ] **Step 1: Add testing state**

After line 24 (`const [saving, setSaving] = useState(false);`), add:
```typescript
const [testing, setTesting] = useState(false);
```

- [ ] **Step 2: Add test handler function**

Add after the `handleSubmit` function (after line 52):
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
    const message = err instanceof Error ? err.message : 'Test failed';
    toast.error(`Connection failed: ${message}`);
  } finally {
    setTesting(false);
  }
};
```

- [ ] **Step 3: Add Test Connection button**

In the buttons section (after line 121), add before the Save button:
```typescript
<Button type="button" variant="secondary" onClick={handleTest} disabled={saving || testing}>
  {testing ? 'Testing...' : 'Test Connection'}
</Button>
```

The full button section should look like:
```typescript
<div className="flex gap-2">
  <Button type="button" variant="secondary" onClick={handleTest} disabled={saving || testing}>
    {testing ? 'Testing...' : 'Test Connection'}
  </Button>
  <Button type="submit" disabled={saving || testing}>
    {saving ? 'Saving...' : 'Save Settings'}
  </Button>
</div>
```

- [ ] **Step 4: Run TypeScript compiler to verify**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Test in browser**

Run: `npm run dev`
Navigate to http://localhost:5173/settings
Click "Test Connection" button
Expected: Toast notification with success or error message

- [ ] **Step 6: Commit frontend changes**

```bash
git add src/components/settings/SettingsForm.tsx
git commit -m "feat: add test connection button to settings"
```

---

## Testing Checklist

- [ ] Backend endpoint returns `{ success: true, response: "..." }` for valid provider
- [ ] Backend endpoint returns `{ success: false, error: "..." }` for invalid provider
- [ ] Frontend button shows "Testing..." while request is in progress
- [ ] Frontend shows success toast with response text
- [ ] Frontend shows error toast with error message
- [ ] Button is disabled during test (prevents multiple clicks)
- [ ] TypeScript compiles without errors

## Files Modified

1. `server/routes/settings.ts` - Add test endpoint
2. `src/components/settings/SettingsForm.tsx` - Add test button and handler

## Files Created

None
