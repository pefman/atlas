# Notifications, Create Task & Drag-and-Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add notification system for CEO/agent messaging, create task button on Kanban, and drag-and-drop for tasks/subtasks.

**Architecture:** SQLite `notifications` table with SSE real-time delivery, REST API for task creation with CEO auto-decomposition, and `@dnd-kit` for drag-and-drop with optimistic UI updates.

**Tech Stack:** TypeScript, Express, SQLite (better-sqlite3), React 19, shadcn/ui, Base UI v1.6.0, `@dnd-kit/core` v7.x, `@dnd-kit/sortable` v7.x

## Global Constraints

- Use Base UI `render` prop (not `asChild`) for custom elements
- Follow existing theme colors from `src/index.css`
- No new dependencies except `@dnd-kit/core` and `@dnd-kit/sortable`
- Priority values: `'high'`, `'medium'`, `'low'` (lowercase)
- Notification sender: CEO only (agents escalate to CEO)
- Drag-and-drop: optimistic UI with revert on API failure
- SSE for real-time notifications, 30s polling fallback

## Migration Strategy

New `notifications` table requires no data migration. Existing data unaffected.

---

### Task 1: Database - Add Notifications Table

**Files:**
- Modify: `server/db.ts` (line 41-53, add notifications table after subtasks)

**Interfaces:**
- Consumes: None
- Produces: `notifications` table with `id`, `sender_role`, `message`, `task_id`, `is_read`, `created_at`

**Steps:**

- [ ] **Step 1: Add notifications table to db.ts**

In `server/db.ts`, after the subtasks table definition, add:

```typescript
db.run(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_role TEXT NOT NULL,
    message TEXT NOT NULL,
    task_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`);
```

- [ ] **Step 2: Commit**

```bash
git add server/db.ts
git commit -m "db: add notifications table"
```

### Task 2: Backend - Notification API Endpoints

**Files:**
- Create: `server/routes/notifications.ts`
- Modify: `server/index.ts` (register notifications router)

**Interfaces:**
- Consumes: `notifications` table from Task 1
- Produces: REST API endpoints for CRUD + SSE

**Steps:**

- [ ] **Step 1: Create notifications router**

Create `server/routes/notifications.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/notifications - fetch all notifications
router.get('/', (req: Request, res: Response) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all() as any[];
  
  res.json(notifications);
});

// PATCH /api/notifications/:id/read - mark as read
router.patch('/:id/read', (req: Request, res: Response) => {
  const notificationId = parseInt(req.params.id);
  const result = db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ?'
  ).run(notificationId);
  
  if (result.changes === 0) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  
  res.json({ success: true });
});

// POST /api/notifications - internal: create notification
router.post('/', (req: Request, res: Response) => {
  const { sender_role, message, task_id } = req.body;
  
  if (!sender_role || !message) {
    res.status(400).json({ error: 'sender_role and message are required' });
    return;
  }
  
  const result = db.prepare(`
    INSERT INTO notifications (sender_role, message, task_id)
    VALUES (?, ?, ?)
  `).run(sender_role, message, task_id || null);
  
  res.status(201).json({ id: result.lastInsertRowid });
});

export default router;
```

- [ ] **Step 2: Register router in server/index.ts**

In `server/index.ts`, add after the existing router registrations:

```typescript
import notificationsRouter from './routes/notifications';
app.use('/api/notifications', notificationsRouter);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/notifications.ts server/index.ts
git commit -m "feat: add notification API endpoints"
```

### Task 3: Backend - SSE for Real-Time Notifications

**Files:**
- Modify: `server/events.ts` (add notification event type)
- Create: `server/routes/notificationsStream.ts`

**Interfaces:**
- Consumes: Event bus from `server/events.ts`
- Produces: SSE endpoint that streams notification events

**Steps:**

- [ ] **Step 1: Add notification event to events.ts**

In `server/events.ts`, add to the event type union:

```typescript
export type ServerEvent = 
  | { type: 'subtask_start'; data: any }
  | { type: 'subtask_progress'; data: any }
  | { type: 'subtask_complete'; data: any }
  | { type: 'error'; data: any }
  | { type: 'notification'; data: any };  // NEW
```

- [ ] **Step 2: Create notificationsStream route**

Create `server/routes/notificationsStream.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { execEventBus } from '../events';

const router = Router();

// GET /api/notifications/stream - SSE endpoint
router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  const subscription = execEventBus.on('notification', (data: any) => {
    res.write(`event: notification\ndata: ${JSON.stringify(data)}\n\n`);
  });
  
  req.on('close', () => {
    subscription.unsubscribe();
  });
});

export default router;
```

- [ ] **Step 3: Register SSE route in server/index.ts**

```typescript
import notificationsStreamRouter from './routes/notificationsStream';
app.use('/api/notifications/stream', notificationsStreamRouter);
```

- [ ] **Step 4: Commit**

```bash
git add server/events.ts server/routes/notificationsStream.ts server/index.ts
git commit -m "feat: add SSE for real-time notifications"
```

### Task 4: Backend - Executor notifyUser Method

**Files:**
- Modify: `server/executor.ts` (add notifyUser method to CEO class)

**Interfaces:**
- Consumes: Notification API from Task 2
- Produces: `ceo.notifyUser(message, taskId)` method

**Steps:**

- [ ] **Step 1: Add notifyUser to executor.ts**

In the CEO class (or standalone function), add:

```typescript
async function notifyUser(message: string, taskId?: number): Promise<void> {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_role: 'ceo',
        message,
        task_id: taskId || null
      })
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/executor.ts
git commit -m "feat: add notifyUser method to executor"
```

### Task 5: Frontend - Notification Types and Provider

**Files:**
- Modify: `src/types/index.ts` (add Notification interface)
- Create: `src/components/notifications/NotificationProvider.tsx`

**Interfaces:**
- Consumes: Notification types
- Produces: Context provider with notifications state + SSE consumer

**Steps:**

- [ ] **Step 1: Add Notification interface to types/index.ts**

```typescript
export interface Notification {
  id: number;
  sender_role: string;
  message: string;
  task_id?: number;
  is_read: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Create NotificationProvider**

Create `src/components/notifications/NotificationProvider.tsx`:

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { Notification } from '@/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await fetchNotifications();
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s fallback
    return () => clearInterval(interval);
  }, []);

  // SSE connection
  useEffect(() => {
    const eventSource = new EventSource('/api/notifications/stream');
    
    eventSource.addEventListener('notification', (event) => {
      const newNotification = JSON.parse(event.data);
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => eventSource.close();
  }, []);

  const value = { notifications, unreadCount, markAsRead, refresh: fetchNotifications };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
```

- [ ] **Step 3: Wrap app in NotificationProvider**

In `src/main.tsx` or `src/App.tsx`, wrap the app:

```typescript
import { NotificationProvider } from '@/components/notifications/NotificationProvider';

// ...
<NotificationProvider>
  <Router>
    {/* existing app */}
  </Router>
</NotificationProvider>
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/notifications/NotificationProvider.tsx src/App.tsx
git commit -m "feat: add notification provider with SSE"
```

### Task 6: Frontend - Notification Bell UI

**Files:**
- Create: `src/components/notifications/NotificationBell.tsx`

**Interfaces:**
- Consumes: `useNotifications()` from Task 5
- Produces: Bell icon with unread badge and dropdown

**Steps:**

- [ ] **Step 1: Create NotificationBell component**

Create `src/components/notifications/NotificationBell.tsx`:

```typescript
import { Bell } from 'lucide-react';
import { useNotifications } from './NotificationProvider';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.task_id) {
      navigate(`/task/${notification.task_id}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notifications</p>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-2 rounded-md cursor-pointer text-sm ${
                  notification.is_read ? 'bg-transparent' : 'bg-accent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{notification.sender_role}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs mt-1">{notification.message}</p>
                {notification.task_id && (
                  <p className="text-xs text-primary mt-1">View task #{notification.task_id}</p>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Add to header**

In `src/components/site-header.tsx` or wherever the header is, add the bell icon.

- [ ] **Step 3: Commit**

```bash
git add src/components/notifications/NotificationBell.tsx src/components/site-header.tsx
git commit -m "feat: add notification bell UI"
```

### Task 7: Frontend - Create Task Dialog

**Files:**
- Create: `src/components/kanban/CreateTaskDialog.tsx`
- Modify: `src/components/kanban/KanbanBoard.tsx` (add button)

**Interfaces:**
- Consumes: None
- Produces: Modal dialog for creating tasks

**Steps:**

- [ ] **Step 1: Create CreateTaskDialog**

Create `src/components/kanban/CreateTaskDialog.tsx`:

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateTaskDialog({ open, onOpenChange, onCreated }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [roleId, setRoleId] = useState<number>(7); // researcher default
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, priority, role_id: roleId })
      });

      if (!res.ok) throw new Error('Failed to create task');

      onCreated();
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setRoleId(7);
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
              required
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Assignee</label>
            <Select value={roleId.toString()} onValueChange={(v) => setRoleId(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Researcher</SelectItem>
                <SelectItem value="8">Writer</SelectItem>
                <SelectItem value="9">Reviewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add button to KanbanBoard.tsx**

In `src/components/kanban/KanbanBoard.tsx`, add state and button:

```typescript
import { CreateTaskDialog } from './CreateTaskDialog';
import { Plus } from 'lucide-react';

// Add state
const [createDialogOpen, setCreateDialogOpen] = useState(false);

// Add button in header area (before the columns)
<div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold">Kanban Board</h2>
  <Button onClick={() => setCreateDialogOpen(true)}>
    <Plus className="h-4 w-4 mr-2" />
    Create Task
  </Button>
</div>

// Add dialog at end of component
<CreateTaskDialog
  open={createDialogOpen}
  onOpenChange={setCreateDialogOpen}
  onCreated={fetchData}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/kanban/CreateTaskDialog.tsx src/components/kanban/KanbanBoard.tsx
git commit -m "feat: add create task dialog to kanban"
```

### Task 8: Frontend - Install dnd-kit Dependencies

**Files:**
- Modify: `package.json` (add dependencies)
- Run: `npm install`

**Steps:**

- [ ] **Step 1: Add dependencies to package.json**

```json
{
  "dependencies": {
    // ... existing deps
    "@dnd-kit/core": "^7.0.2",
    "@dnd-kit/sortable": "^7.0.2",
    "@dnd-kit/utilities": "^3.2.2"
  }
}
```

- [ ] **Step 2: Install**

```bash
npm install
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add dnd-kit dependencies"
```

### Task 9: Frontend - Drag-and-Drop Provider

**Files:**
- Create: `src/components/kanban/KanbanDndProvider.tsx`

**Interfaces:**
- Consumes: `@dnd-kit/core`, `@dnd-kit/sortable`
- Produces: DnD context wrapper with drag handlers

**Steps:**

- [ ] **Step 1: Create KanbanDndProvider**

Create `src/components/kanban/KanbanDndProvider.tsx`:

```typescript
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';

interface KanbanDndProviderProps {
  children: React.ReactNode;
  items: Array<{ id: string; status: string }>;
  onDrop: (itemId: string, newStatus: string) => Promise<void>;
}

export function KanbanDndProvider({ children, items, onDrop }: KanbanDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const itemId = active.id as string;
    const newStatus = over.id as string;

    await onDrop(itemId, newStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay>
        {activeId ? <div className="opacity-50">Dragging...</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/kanban/KanbanDndProvider.tsx
git commit -m "feat: add dnd-kit provider"
```

### Task 10: Frontend - Integrate Drag-and-Drop

**Files:**
- Modify: `src/components/kanban/KanbanBoard.tsx` (wrap with DnD provider)
- Modify: `src/components/kanban/KanbanCard.tsx` (make draggable)
- Modify: `src/components/kanban/KanbanColumn.tsx` (make subtask cards draggable)

**Steps:**

- [ ] **Step 1: Wrap KanbanBoard with DnD provider**

In `src/components/kanban/KanbanBoard.tsx`:

```typescript
import { KanbanDndProvider } from './KanbanDndProvider';

// Wrap the columns
<KanbanDndProvider
  items={[
    ...backlogTasks.map(t => ({ id: `task-${t.id}`, status: t.status })),
    ...doneTasks.map(t => ({ id: `task-${t.id}`, status: t.status })),
    ...backlogSubtasks.map(s => ({ id: `subtask-${s.id}`, status: s.status })),
    ...doneSubtasks.map(s => ({ id: `subtask-${s.id}`, status: s.status }))
  ]}
  onDrop={handleDrop}
>
  {/* existing columns */}
</KanbanDndProvider>

// Add handleDrop function
const handleDrop = async (itemId: string, newStatus: string) => {
  const [type, idStr] = itemId.split('-');
  const id = parseInt(idStr);
  
  if (type === 'task') {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  } else if (type === 'subtask') {
    await fetch(`/api/subtasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  }
  
  await fetchData();
};
```

- [ ] **Step 2: Make KanbanCard draggable**

In `src/components/kanban/KanbanCard.tsx`:

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Add to component
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
  id: `task-${task.id}` 
});

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : 1,
};

// Add to card div
<div
  ref={setNodeRef}
  style={style}
  {...attributes}
  {...listeners}
  className="..."
>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/kanban/KanbanBoard.tsx src/components/kanban/KanbanCard.tsx src/components/kanban/KanbanColumn.tsx
git commit -m "feat: integrate drag-and-drop into kanban"
```
