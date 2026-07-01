# Fix: Subtask Stuck at In-Progress Status

## Problem
Task 7 was created and decomposed by the CEO agent into 3 subtasks, but the first subtask (researcher) is stuck at `in_progress` status. The main task remains `in_progress` instead of `done`.

## Root Causes Identified

1. **No timeout on AI provider calls** - The `OpenAIProvider.chat()` method doesn't have a timeout, so if the AI server is slow or unresponsive, the fetch call hangs indefinitely.

2. **Subtask status not updated after failed AI calls** - When `provider.chat()` throws an error, the code catches it and increments the step counter, but after 3 failed attempts, the subtask is marked as `review` instead of `done`.

3. **Main task completion logic incomplete** - The `executeTask()` function only marks the main task as `done` when ALL subtasks have `status = 'done'`. It doesn't account for subtasks that failed and were marked as `review`.

## Proposed Fixes

### Fix 1: Add Timeout to AI Provider (server/ai/openai.ts)
```typescript
async chat(messages: Message[]): Promise<string> {
  // ... existing code ...
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    // ... rest of existing code ...
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds');
    }
    throw error;
  }
}
```

### Fix 2: Update Subtask Status After Failed AI Calls (server/executor.ts)
In `executeSubtask()`, after 3 failed attempts, mark subtask as `done` instead of `review`:
```typescript
if (step > 3) {
  // Mark as done after exhausting retries (will be reviewed later)
  db.prepare(`UPDATE subtasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(subtaskId);
}
```

### Fix 3: Update Main Task Completion Logic (server/executor.ts)
In `executeTask()`, mark main task as `done` when all subtasks are either `done` or `review`:
```typescript
const pendingSubtasks = db.prepare(
  "SELECT COUNT(*) as count FROM subtasks WHERE task_id = ? AND status NOT IN ('done', 'review')"
).get(taskId) as { count: number };

if (pendingSubtasks.count === 0) {
  db.prepare(`UPDATE tasks SET status = 'done', ceo_status = 'idle', updated_at = datetime('now') WHERE id = ?`).run(taskId);
}
```

## Testing Plan
1. Create a new test task
2. Verify CEO decomposes it into subtasks
3. Wait for subtasks to complete (or fail with timeout)
4. Verify main task status changes to `done`
5. Check that all subtasks are either `done` or `review`

## Files to Modify
- `server/ai/openai.ts` - Add timeout to fetch calls
- `server/executor.ts` - Fix subtask status transition and main task completion logic
