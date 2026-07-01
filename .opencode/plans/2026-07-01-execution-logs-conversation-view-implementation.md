# Execution Logs: Full Conversation View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace step-based execution logs with chat bubble conversation view showing AI interactions as user/assistant messages with role avatars.

**Architecture:** Create a new `ConversationView` component that transforms execution log data into a chat interface with message bubbles, avatars, and timestamps. Replace the existing `ExecutionLogs` component with this new implementation.

**Tech Stack:** React 19, TypeScript, shadcn/ui (Card, Badge, ScrollArea), Base UI v1.6.0, Lucide React icons

## Global Constraints

- Use Base UI `render` prop (not `asChild`) for custom elements
- Follow existing theme colors from `src/index.css`: `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`
- No new dependencies allowed
- Component must work in both light and dark modes
- All existing execution logs data must display correctly

---

### Task 1: Create ConversationView Component

**Files:**
- Create: `src/components/execution/ConversationView.tsx`

**Interfaces:**
```typescript
interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: string;
  stepType?: 'assign' | 'execute';
}

interface SubtaskMessage {
  subtaskId: number;
  subtaskTitle: string;
  subtaskStatus: string;
  roleInitials: string;
  messages: ConversationMessage[];
}

interface ConversationViewProps {
  subtasks: Array<{
    id: number;
    title: string;
    status: string;
    role_name: string;
  }>;
}
```

**Steps:**

- [ ] **Step 1: Create component file with basic structure**

```typescript
// src/components/execution/ConversationView.tsx
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: string;
  stepType?: 'assign' | 'execute';
}

interface SubtaskMessage {
  subtaskId: number;
  subtaskTitle: string;
  subtaskStatus: string;
  roleInitials: string;
  messages: ConversationMessage[];
}

interface ConversationViewProps {
  subtasks: Array<{
    id: number;
    title: string;
    status: string;
    role_name: string;
  }>;
}

export function ConversationView({ subtasks }: ConversationViewProps) {
  // Transform subtasks and logs into conversation structure
  const conversationData: SubtaskMessage[] = subtasks.map(subtask => ({
    subtaskId: subtask.id,
    subtaskTitle: subtask.title,
    subtaskStatus: subtask.status,
    roleInitials: getRoleInitials(subtask.role_name),
    messages: [], // Will be populated from logs
  }));

  return (
    <div className="space-y-6">
      {conversationData.map((subtask) => (
        <div key={subtask.subtaskId}>
          <SubtaskHeader subtask={subtask} />
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            <div className="space-y-3">
              {subtask.messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

function getRoleInitials(roleName: string): string {
  const initials = roleName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || roleName[0].toUpperCase();
}
```

- [ ] **Step 2: Add SubtaskHeader component**

```typescript
function SubtaskHeader({ subtask }: { subtask: SubtaskMessage }) {
  return (
    <div className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <AvatarCircle initials={subtask.roleInitials} size="sm" />
        <span className="font-medium text-sm">{subtask.subtaskTitle}</span>
      </div>
      <Badge variant="secondary">{subtask.subtaskStatus}</Badge>
    </div>
  );
}
```

- [ ] **Step 3: Add MessageBubble component with role-based styling**

```typescript
function MessageBubble({ message }: { message: ConversationMessage }) {
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';
  const isAssign = message.stepType === 'assign';

  const baseClasses = 'rounded-lg p-3 border';
  
  let styleClasses = '';
  if (isSystem) {
    styleClasses = `${baseClasses} bg-muted text-muted-foreground text-xs max-w-[80%]`;
  } else if (isAssistant) {
    styleClasses = `${baseClasses} bg-primary text-primary-foreground text-sm max-w-[80%] ml-auto`;
  } else {
    styleClasses = `${baseClasses} bg-card text-foreground text-sm max-w-[80%]`;
  }

  if (isAssign) {
    return (
      <div className="flex justify-center">
        <div className={`${baseClasses} bg-secondary text-secondary-foreground text-xs py-2 px-4`}>
          <div className="flex items-center gap-2">
            <AvatarCircle initials="CEO" size="xs" />
            <span>Assigned to {message.content}</span>
            {message.timestamp && (
              <Clock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isAssistant ? 'justify-end' : 'justify-start'}`}>
      {!isAssistant && (
        <AvatarCircle initials={message.role === 'system' ? 'SYS' : 'USR'} size="sm" />
      )}
      <div className={styleClasses}>
        {message.content}
        {message.timestamp && (
          <div className="text-muted-foreground text-xs mt-1">
            {message.timestamp}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add AvatarCircle component**

```typescript
function AvatarCircle({ initials, size }: { initials: string; size: 'xs' | 'sm' | 'md' }) {
  const sizeClasses = {
    xs: 'h-5 w-5 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-accent text-accent-foreground flex items-center justify-center font-medium`}>
      {initials}
    </div>
  );
}
```

- [ ] **Step 5: Add data transformation function**

```typescript
function transformLogsToConversation(logs: any[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  
  logs.forEach((log: any) => {
    // Handle assign step
    if (log.step_type === 'assign') {
      messages.push({
        role: 'user',
        content: log.output || 'Assigned',
        timestamp: new Date(log.created_at).toLocaleTimeString(),
        stepType: 'assign',
      });
      return;
    }

    // Parse input JSON to extract messages
    try {
      const inputMessages = JSON.parse(log.input);
      if (Array.isArray(inputMessages)) {
        // Add system and user messages from input
        inputMessages.forEach((msg: any, idx: number) => {
          if (msg.role && msg.content) {
            messages.push({
              role: msg.role as 'system' | 'user' | 'assistant',
              content: msg.content,
              timestamp: idx === 0 ? new Date(log.created_at).toLocaleTimeString() : undefined,
            });
          }
        });
      }
    } catch (e) {
      // If not JSON, treat as single message
      messages.push({
        role: 'user',
        content: log.input,
        timestamp: new Date(log.created_at).toLocaleTimeString(),
      });
    }

    // Add assistant output
    if (log.output) {
      messages.push({
        role: 'assistant',
        content: log.output,
        timestamp: new Date(log.created_at).toLocaleTimeString(),
      });
    }
  });

  return messages;
}
```

- [ ] **Step 6: Add empty state message**

```typescript
if (subtasks.length === 0) {
  return (
    <div className="flex items-center justify-center h-40 text-muted-foreground">
      <div className="text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-muted-foreground">No execution logs yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Logs will appear after subtasks are executed
        </p>
      </div>
    </div>
  );
}
```

**Expected Output:** Component renders conversation view with chat bubbles, avatars, and timestamps.

**Verification:** Run `npm run dev` and check that `ConversationView` component renders without errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/execution/ConversationView.tsx
git commit -m "feat: add conversation view component for execution logs"
```

### Task 2: Integrate with TaskDetail

**Files:**
- Modify: `src/components/tasks/TaskDetail.tsx:32-390`

**Interfaces:**
- Consumes: `ConversationView` component from `@/components/execution/ConversationView`
- Produces: Updated execution logs tab with conversation view

**Steps:**

- [ ] **Step 1: Update imports**

```typescript
// Remove old import
import { ExecutionLogs } from '@/components/execution/ExecutionLogs';

// Add new import
import { ConversationView } from '@/components/execution/ConversationView';
```

- [ ] **Step 2: Replace execution logs tab content**

Replace lines 354-390 in `TaskDetail.tsx`:

```typescript
{/* Execution Logs Tab */}
<TabsContent value="logs">
  {task.subtasks.length === 0 ? (
    <Card>
      <CardContent className="flex items-center justify-center h-40">
        <div className="text-center">
          <ListTodo className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-muted-foreground">No execution logs yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Logs will appear after subtasks are executed
          </p>
        </div>
      </CardContent>
    </Card>
  ) : (
    <ConversationView subtasks={task.subtasks} />
  )}
</TabsContent>
```

**Expected Output:** TaskDetail uses ConversationView instead of ExecutionLogs.

**Verification:** Open a task with execution logs and verify the conversation view renders correctly.

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/TaskDetail.tsx
git commit -m "feat: integrate conversation view with task detail"
```

### Task 3: Test and Verify

**Files:**
- No new files
- Modify: Existing execution logs data

**Steps:**

- [ ] **Step 1: Create test task with execution logs**

Run the app and create a task that will generate execution logs:
1. Start the dev server: `npm run dev`
2. Create a new task in the dashboard
3. Wait for CEO to decompose and execute
4. Navigate to the task's Execution Logs tab

- [ ] **Step 2: Verify conversation view renders correctly**

Check that:
- Subtask headers show with role initials and status badges
- Messages appear as chat bubbles with correct alignment (left for user/system, right for assistant)
- Avatars display role initials
- Timestamps appear below each bubble
- Scrollable container works properly
- Both light and dark modes work correctly

- [ ] **Step 3: Test edge cases**

Test scenarios:
- Empty execution logs (no subtasks)
- Single message in a subtask
- Multiple steps in a subtask
- Long messages (should wrap properly)
- Assign steps (CEO assigning work)

- [ ] **Step 4: Fix any issues**

If issues are found:
- Adjust styling for better readability
- Fix alignment issues
- Ensure proper spacing between messages
- Verify theme colors work in both modes

- [ ] **Step 5: Commit final changes**

```bash
git add -A
git commit -m "feat: complete conversation view for execution logs"
```

## Success Criteria

- [ ] All existing execution logs display correctly as conversation bubbles
- [ ] Messages are clearly distinguishable by role (system/user/assistant)
- [ ] Theme colors applied consistently in both light and dark modes
- [ ] Smooth scrolling for long conversations
- [ ] No layout breaks in existing pages
- [ ] Avatar circles show role initials
- [ ] Timestamps appear below each bubble
- [ ] Empty state message displays when no logs exist
- [ ] Assign steps show as centered messages with CEO avatar
