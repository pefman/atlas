# Plan: Fix OpenAI Provider Authorization Header

## Issue
When using OpenAI provider with a custom endpoint that doesn't require authentication, the provider always sends `Authorization: Bearer` header. This causes 401 errors on endpoints that don't expect authentication.

## Solution
Modify `OpenAIProvider` to conditionally add the Authorization header only when an API key is provided.

## Files to Modify
- `server/ai/openai.ts`

## Changes

### 1. Update `chat()` method
```typescript
async chat(messages: Message[]): Promise<string> {
  const path = this.endpoint.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (this.apiKey) {
    headers['Authorization'] = `Bearer ${this.apiKey}`;
  }
  const response = await fetch(`${this.endpoint}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: this.model,
      messages,
    }),
  });
  // ... rest unchanged
}
```

### 2. Update `getModels()` method
```typescript
async getModels(): Promise<AIModel[]> {
  const path = this.endpoint.endsWith('/v1') ? '/models' : '/v1/models';
  const headers: Record<string, string> = {};
  if (this.apiKey) {
    headers['Authorization'] = `Bearer ${this.apiKey}`;
  }
  const response = await fetch(`${this.endpoint}${path}`, {
    headers,
  });
  // ... rest unchanged
}
```

## Testing
- Test with custom endpoint that doesn't require auth (no API key)
- Test with OpenAI API using a valid key
- Verify both endpoints work correctly
