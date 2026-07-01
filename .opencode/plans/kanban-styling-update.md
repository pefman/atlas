# Plan: Update Kanban Board Styling to Match shadcn/ui Kit

## Overview
Update our kanban board components to use the same CSS classes and styling patterns as the shadcn/ui kit kanban example.

## Current State
Our kanban board uses basic Tailwind classes with dynamic column colors. The shadcn/ui kit version has more polished styling with better shadows, borders, and spacing.

## Files to Update

### 1. `src/components/kanban/KanbanBoard.tsx`
**Current:** `flex gap-4 p-6 overflow-x-auto`
**Target:** `flex gap-4 p-6 overflow-x-auto` (same, but verify container styling)

### 2. `src/components/kanban/KanbanColumn.tsx`
**Changes needed:**
- Column container: Add `shadow-sm` for subtle shadow
- Column header: Update to match exact structure
- Status indicator: Use `Circle` icon from lucide-react
- Count badge: Update classes to `text-xs bg-background/50 px-2 py-1 rounded-full`

**Current column container:**
```typescript
<div className={`flex-1 min-w-[280px] ${columnColors[status]} border ${columnBorders[status]} rounded-lg p-4`}>
```

**Target column container:**
```typescript
<div className={`flex-1 min-w-[280px] ${columnColors[status]} border ${columnBorders[status]} rounded-lg p-4 shadow-sm`}>
```

**Current header:**
```typescript
<h3 className="font-semibold mb-4 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Circle className={`h-3 w-3 ${statusColors[status]}`} />
    <span>{title}</span>
  </div>
  <span className="text-xs bg-background/50 px-2 py-1 rounded-full">{totalCount}</span>
</h3>
```

**Target header:**
```typescript
<h3 className="font-semibold mb-4 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Circle className={`h-3 w-3 ${statusColors[status]}`} />
    <span className="text-sm">{title}</span>
  </div>
  <span className="text-xs bg-background/50 px-2 py-1 rounded-full">{totalCount}</span>
</h3>
```

### 3. `src/components/kanban/KanbanCard.tsx`
**Changes needed:**
- Card container: Add `shadow-sm hover:shadow-md transition-shadow cursor-pointer`
- Card title: Add `leading-tight` class
- Role badge: Ensure `text-xs shrink-0` classes
- Description: Ensure `text-xs text-muted-foreground mb-3 line-clamp-2`
- Action buttons: Update to exact button classes

**Current card container:**
```typescript
<div className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
```

**Target card container:** (same as current - already correct!)

**Current card title:**
```typescript
<h4 className="font-medium text-sm flex-1 leading-tight">{item.title}</h4>
```

**Target card title:** (same as current - already correct!)

**Current role badge:**
```typescript
<Badge variant="secondary" className="text-xs shrink-0">{item.role_name}</Badge>
```

**Target role badge:** (same as current - already correct!)

**Current description:**
```typescript
<p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
```

**Target description:** (same as current - already correct!)

**Current action buttons:**
```typescript
<Button size="sm" variant="secondary" className="flex-1 h-7 text-xs" ...>
<Button size="sm" variant="secondary" className="w-full h-7 text-xs" ...>
```

**Target action buttons:** (same as current - already correct!)

### 4. `src/components/kanban/KanbanColumn.tsx` - Import Update
**Add import:**
```typescript
import { Circle } from 'lucide-react';
```

## CSS Variables (Already in our project)
Our `src/index.css` already has the correct CSS variables:
- `--background`, `--foreground`, `--card`, `--card-foreground`
- `--border`, `--muted`, `--muted-foreground`
- `--secondary`, `--secondary-foreground`, `--ring`
- `--radius`

## Implementation Steps

1. **Update KanbanColumn.tsx**
   - Add `Circle` icon import
   - Add `shadow-sm` to column container
   - Add `text-sm` to column title span

2. **Verify KanbanCard.tsx**
   - All classes already match target
   - No changes needed

3. **Verify KanbanBoard.tsx**
   - Container styling already matches
   - No changes needed

4. **Test in both light and dark mode**
   - Verify shadows work in both modes
   - Verify column colors are consistent

## Expected Result
Kanban board will have:
- Subtle shadows on columns and cards
- Better visual hierarchy with proper text sizing
- Consistent styling with shadcn/ui kit
- Smooth hover transitions on cards
- Proper spacing and alignment

## Testing
1. Create a test task
2. Watch CEO decompose and process it
3. Verify kanban board displays correctly
4. Test in light and dark mode
5. Verify hover effects on cards
