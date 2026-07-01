# UI Redesign Plan - Atlas

## Current State
- 16 shadcn/ui components installed (Button, Card, Badge, Dialog, Input, Textarea, Label, Select, Separator, Sidebar, Sheet, Skeleton, Switch, Tooltip, Sonner)
- Missing: Dropdown Menu, Table, Tabs, Breadcrumb, Command, Avatar, Calendar, Collapsible, Combobox, Context Menu, Hover Card, Input OTP, Navigation Menu, Pagination, Popover, Progress, Radio Group, Resizable, Scroll Area, Slider, Spinner, Toggle, Toggle Group, Typography
- Basic layout with sidebar, header, and page content
- Custom task cards and kanban board

## Goals
- Use as many shadcn/ui components as possible
- Match shadcn/ui website style and aesthetics
- Modern, clean design
- Better UX with proper components

## Phase 1: Add Missing Components

### Install via `npx shadcn@latest add`
- `dropdown-menu` - For task actions, agent menu
- `table` - For task list table view
- `tabs` - For task detail tabs (Subtasks, Logs, Details)
- `breadcrumb` - For navigation in task detail
- `avatar` - For agent avatars
- `calendar` - For date display
- `collapsible` - For expandable sections
- `combobox` - For agent/model selection
- `command` - For command palette (Ctrl+K)
- `hover-card` - For agent hover info
- `input-otp` - For API key verification
- `navigation-menu` - For main nav
- `pagination` - For task list pagination
- `popover` - For tooltips and popovers
- `progress` - For task progress
- `radio-group` - For provider selection
- `scroll-area` - For long content
- `slider` - For progress indicators
- `spinner` - For loading states
- `toggle` - For theme toggle
- `toggle-group` - For button groups
- `typography` - For text formatting
- `separator` - (already installed)

## Phase 2: Redesign Pages

### Dashboard (/)
- Use `Table` component for task list with sorting, filtering, pagination
- Replace custom cards with table rows
- Add `DropdownMenu` for row actions (edit, delete, execute)
- Add `Command` palette for quick actions
- Use `Badge` for status with proper colors

### Kanban (/kanban)
- Keep kanban board but improve card design
- Use `HoverCard` for quick agent info
- Add `Progress` bar for task completion
- Use `Tabs` to switch between board/list view

### Task Detail (/task/:id)
- Add `Breadcrumb` navigation
- Use `Tabs` for sections: Overview, Subtasks, Execution Logs
- Use `ScrollArea` for log content
- Add `Progress` for task status
- Use `Avatar` for agent display

### Settings (/settings)
- Use `Tabs` for AI Provider, General, Advanced
- Use `RadioGroup` for provider selection
- Use `Command` for model search
- Better form layout with `Separator`

### Sidebar
- Use `NavigationMenu` for main nav
- Add `Command` palette trigger
- Use `Avatar` for user profile
- Add `DropdownMenu` for user menu

## Phase 3: Global Improvements

### Typography
- Use `typography` component for consistent text
- Proper heading hierarchy
- Better font sizing

### Loading States
- Use `Spinner` component consistently
- Add `Skeleton` for loading states
- Better empty states

### Dark Mode
- Ensure all components support dark mode
- Test color contrast
- Use shadcn/ui theme variables

## Implementation Order

1. Install all missing components
2. Redesign Dashboard with Table
3. Redesign Task Detail with Tabs
4. Redesign Settings with Tabs
5. Add Command Palette
6. Improve Sidebar
7. Add Avatar and HoverCard
8. Global polish and testing

## Files to Create/Modify

### New Components
- `components/command-palette.tsx` - Command palette
- `components/task-table.tsx` - Task table with sorting/filtering
- `components/task-table-columns.tsx` - Table column definitions
- `components/task-table-pagination.tsx` - Pagination controls
- `components/agent-avatar.tsx` - Agent avatar with status

### Modified Files
- `src/components/tasks/TaskList.tsx` - Use table instead of cards
- `src/components/tasks/TaskDetail.tsx` - Use tabs, breadcrumb
- `src/components/tasks/CreateTaskDialog.tsx` - Improve form
- `src/components/kanban/KanbanBoard.tsx` - Improve cards
- `src/components/kanban/KanbanCard.tsx` - Use hover card
- `src/components/settings/SettingsForm.tsx` - Use tabs, radio group
- `src/components/app-sidebar.tsx` - Use navigation menu, avatar
- `src/pages/DashboardPage.tsx` - Use new table component
- `src/pages/SettingsPage.tsx` - Use tabs layout

## Testing
- Test all components in light and dark mode
- Test responsive design
- Test keyboard navigation
- Test accessibility (ARIA labels, focus management)
- Verify all interactions work
