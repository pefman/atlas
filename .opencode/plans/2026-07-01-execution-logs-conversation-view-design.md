# Execution Logs: Full Conversation View

**Date:** 2026-07-01
**Status:** Approved
**File:** `docs/superpowers/specs/2026-07-01-execution-logs-conversation-view-design.md`

## Overview

Replace the current step-based execution logs with a full conversation view that displays AI interactions as chat bubbles, following the existing theme colors and UI patterns.

## Current State

- Execution logs show steps as cards with JSON input and text output
- Data structure: `input` (JSON array of messages), `output` (AI response), `step_type` (assign/execute)
- Located in `src/components/execution/ExecutionLogs.tsx`

## Proposed Design

### Component Structure

```
ConversationView
├── SubtaskHeader (title, status badge, role)
└── MessageList
    ├── AssignMessage (CEO assigning work)
    ├── SystemMessage (role prompt)
    ├── UserMessage (task description)
    └── AssistantMessage (AI response)
```

### Message Types & Styling

| Message Type | Alignment | Background | Text | Font Size |
|--------------|-----------|------------|------|-----------|
| System (role) | Left, max 80% | `bg-muted` | `text-muted-foreground` | text-xs |
| User (task) | Left, max 80% | `bg-card` | `text-foreground` | text-sm |
| Assistant (AI) | Right, max 80% | `bg-primary` | `text-primary-foreground` | text-sm |
| Assign (CEO) | Center, full width | `bg-secondary` | `text-secondary-foreground` | text-xs |

### Avatar Circles

- Role initials (CEO, R, W, Re, Pl)
- `bg-accent text-accent-foreground`
- `h-8 w-8 rounded-full flex items-center justify-center`
- Positioned left of message

### Layout Details

- Padding: `p-4` inside scroll area
- Gap between messages: `gap-3`
- Scrollable container: `h-[400px] overflow-y-auto`
- Subtask sections separated by `border-t`
- Timestamps below each bubble: `text-muted-foreground text-xs`

### Data Transformation

1. Parse `input` JSON to extract individual messages
2. Add `output` as an assistant message after each step
3. Group by subtask with clear visual separation
4. Filter out empty/error messages

### Files to Modify

- `src/components/execution/ExecutionLogs.tsx` - Replace with `ConversationView`
- `src/components/tasks/TaskDetail.tsx` - Update import if needed

### Files to Create

- None (component replaces existing)

## Theme Colors

### Light Theme
- System: `bg-muted` (210 40% 96.1%)
- User: `bg-card` (0 0% 100%)
- Assistant: `bg-primary` (222.2 47.4% 11.2%)
- Assign: `bg-secondary` (210 40% 96.1%)
- Text: `text-foreground` (222.2 84% 4.9%)
- Muted: `text-muted-foreground` (215.4 16.3% 46.9%)

### Dark Theme
- System: `bg-muted` (217.2 32.6% 17.5%)
- User: `bg-card` (222.2 84% 4.9%)
- Assistant: `bg-primary` (210 40% 98%)
- Assign: `bg-secondary` (217.2 32.6% 17.5%)
- Text: `text-primary-foreground` (210 40% 98%)
- Muted: `text-muted-foreground` (215 20.2% 65.1%)

## Implementation Steps

1. Create `ConversationView` component
2. Add message type detection logic (system/user/assistant/assign)
3. Implement avatar rendering with role initials
4. Style bubbles according to theme colors
5. Add scrollable container with proper height
6. Integrate with existing TaskDetail component
7. Test with existing execution logs data

## Success Criteria

- All existing execution logs display correctly
- Messages are clearly distinguishable by role
- Theme colors applied consistently (light/dark mode)
- Smooth scrolling for long conversations
- No layout breaks in existing pages
