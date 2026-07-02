# Fix: Subtask Clarification Loop

> **For Hermes:** Implement this plan task-by-task.

**Goal:** When a subtask is re-enqueued after a user reply in a clarification thread, the scheduler must include the prior conversation history so the AI can see what the user already answered and stop asking the same question.

**Architecture:** At the top of `executeItem()`, query the message thread for the subtask. If a thread exists with messages, append those messages (as user/assistant roles) to the conversation before sending to the AI. This is a single targeted change in one function.

**Tech Stack:** TypeScript, better-sqlite3, Express, Scheduler class

---

## Bug Summary

In `server/scheduler.ts`, `executeItem()` (line ~326) always constructs the conversation from scratch:

```typescript
const messages = [
  { role: 'system', content: role?.system_prompt || '' },
  { role: 'user', content: `${subtask.description}${projectContext}` },
];
```

This discards any prior conversation. When the user replies to a clarification request:
1. `messages.ts:251-259` correctly re-enqueues the subtask with `failureCount=0`
2. The subtask status flips `review` → `backlog`
3. But `executeItem()` rebuilds the conversation with zero context of what the user said
4. The AI sees the same subtask description, doesn't see the user's answer, asks the same question
5. Loop repeats until MAX_ATTEMPTS (3) is reached

---

## Fix

### Files to Modify

- `server/scheduler.ts` — lines 353-356 (inside `executeItem()`)

### The Change

After building the initial `messages` array (line 353-356), query for a related message thread and append its messages:

```typescript
// AFTER line 356 (the initial messages array construction):

// Append prior conversation from message thread, if any
const existingThread = db.prepare(`
  SELECT id FROM message_threads
  WHERE subtask_id = ? AND status IN ('awaiting_agent', 'open')
  ORDER BY id DESC
  LIMIT 1
`).get(item.id) as { id: number } | undefined;

if (existingThread) {
  const threadMessages = db.prepare(`
    SELECT sender_type, content
    FROM messages
    WHERE thread_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(existingThread.id) as Array<{ sender_type: string; content: string }>;

  for (const msg of threadMessages) {
    conversation.push({
      role: msg.sender_type === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }
}
```

Wait — `messages` is const. Need to change it to `let conversation` at line 353, then `conversation` instead of `messages` for the rest of the function (lines 363, 389, 390-392).

### Full scope of changes in `executeItem()`:

| Line | Change |
|------|--------|
| 353 | `const messages = [` → `let conversation = [` |
| 353-356 | No content change, just rename `messages` → `conversation` |
| 363 | `const conversation = [...messages];` → remove (no longer needed, already `let conversation`) |
| 363-364 | Delete the spread line, keep `let output = '';` |
| 389 | `conversation.push(...)` → already uses `conversation`, no change needed |
| 390-392 | Already uses `conversation`, no change needed |
| After 356 | **INSERT** the thread-fetching code block above |

### Revised `executeItem()` snippet (lines 326-365):

```typescript
private async executeItem(item: QueuedSubtask): Promise<void> {
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(item.id) as any;
  
  if (!subtask) {
    logSystem(`Subtask ${item.id} no longer exists (deleted), skipping`);
    return;
  }

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(subtask.role_id) as any;
  const taskContext = db.prepare(`
    SELECT t.id, t.title, p.name as project_name, p.folder_path as project_folder_path
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.id = ?
  `).get(subtask.task_id) as any;
  const taskId = subtask.task_id;
  const { provider, name: providerName } = await this.getProvider();

  try {
    db.prepare(`UPDATE subtasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(item.id);
    logSubtask('Started', { id: item.id, title: item.title }, providerName);
    execEventBus.emit('subtask_start', { subtask_id: item.id, task_id: taskId, title: item.title });

    const projectContext = taskContext?.project_name
      ? `\n\nProject: ${taskContext.project_name}\nProject folder: ${taskContext.project_folder_path || 'n/a'}`
      : '';

    let conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system' as const, content: role?.system_prompt || '' },
      { role: 'user' as const, content: `${subtask.description}${projectContext}` },
    ];

    // Append prior conversation from message thread, if any
    const existingThread = db.prepare(`
      SELECT id FROM message_threads
      WHERE subtask_id = ? AND status IN ('awaiting_agent', 'open')
      ORDER BY id DESC
      LIMIT 1
    `).get(item.id) as { id: number } | undefined;

    if (existingThread) {
      const threadMessages = db.prepare(`
        SELECT sender_type, content
        FROM messages
        WHERE thread_id = ?
        ORDER BY created_at ASC, id ASC
      `).all(existingThread.id) as Array<{ sender_type: string; content: string }>;

      for (const msg of threadMessages) {
        conversation.push({
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    const logEntry = db.prepare(`
      INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
      VALUES (?, ?, ?, ?, ?)
    `).run(item.id, item.failureCount, role?.id || 0, JSON.stringify(conversation), '');

    let output = '';

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const chatResponse = await provider.chat(conversation);
      await this.updateAgentStats(role?.id || 0, chatResponse.usage);

      const candidate = chatResponse.content;
      const toolCall = this.parseToolCall(candidate);
      if (!toolCall || round >= MAX_TOOL_ROUNDS) {
        output = candidate;
        break;
      }

      const toolResult = await this.executeToolCall(toolCall);
      db.prepare(`
        INSERT INTO execution_logs (subtask_id, step, role_id, input, output)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.failureCount,
        role?.id || 0,
        JSON.stringify({ tool: toolCall.tool, query: toolCall.query, max_results: toolCall.maxResults }),
        toolResult
      );

      conversation.push({ role: 'assistant', content: candidate });
      conversation.push({
        role: 'user',
        content: `Tool result (search_web):\n${toolResult}\n\nUse this information to complete the subtask.`,
      });
    }
    // ... rest unchanged
```

---

## What the SEO subtask conversation will look like after fix

```
system:     "You are an SEO Specialist..."
user:       "Validate Demand via SEO Data - Assess the search volume..."
user:       "i dont have any specific idea, thats why we created this task. help me scan the market."
user:       "i asked you to scan the market, help us come up with an idea."
user:       "we litterally dont know, come up with a good idea."
```

Now the AI has the context it needs and can proceed to do its actual job instead of asking the same question again.

---

## Verification

1. **Typecheck:** Run `npx tsc --noEmit` — should pass (server code is outside tsconfig include, but the change uses only standard TypeScript)
2. **Restart server:** `npm run dev` — no new compile errors
3. **Test the fix:** Restart the SEO subtask manually via the UI or API:
   ```bash
   curl -X POST http://localhost:3101/api/execute/subtask/49
   ```
   Expected: SEO specialist produces actual SEO analysis instead of another clarification request
4. **Verify logs:** Check that `execution_logs` for subtask 49 now shows a non-clarification output

---

## Risks & Edge Cases

1. **Thread status check:** We only append messages from threads with `awaiting_agent` or `open` status. A `resolved` or `awaiting_user` thread won't be included (correct — those are either already handled or the user still needs to respond).

2. **Long conversation:** If there are many prior messages, the conversation could get large. The provider's context window is the natural limit. For robustness, could truncate to last N messages, but not needed for correctness.

3. **Multiple threads:** We query `ORDER BY id DESC LIMIT 1` — only the most recent thread. A subtask shouldn't have multiple active threads, but if it does, we use the latest one (which is the one most likely to be active).

4. **Thread created by agent reply:** The `messages.ts` reply handler creates threads with `created_by: 'user'` for user replies and `created_by: 'agent'` for agent replies. The thread status transitions are `awaiting_user` → `awaiting_agent` (when user replies) → stays open. Our query correctly matches `awaiting_agent` and `open`.

5. **Non-clarification threads:** If the subtask has a general conversation thread (category='general'), it would also be picked up. This is actually desirable — it gives the AI broader context.

---

## Files to Commit

```bash
git add server/scheduler.ts
git commit -m "fix: include message thread history when re-executing subtask after user reply"
```

One file changed, ~15 lines added, no breaking changes.
