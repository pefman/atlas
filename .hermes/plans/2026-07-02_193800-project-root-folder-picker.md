# Project Root Folder Picker Implementation Plan

> **For Hermes:** This is a plan for adding root folder navigation to the project creation picker.

**Goal:** Allow users to navigate to and select any root directory on the filesystem when creating/editing a project, not just subfolders of the server's cwd.

**Architecture:** Add a "parent directory" button to the folder picker, expose the current path in the picker header, and allow the folder path input field to be manually editable so users can paste any path. Server already handles arbitrary absolute paths — no backend changes needed.

**Tech Stack:** React (ProjectsPage.tsx), TypeScript, Tailwind, lucide-react icons.

---

## Task 1: Add parent-directory ("..") navigation to folder picker

**Objective:** Let users click "up" to go to the parent directory of whatever they're currently viewing.

**Files:**
- Modify: `src/pages/ProjectsPage.tsx`

**Step 1: Add state for the currently viewed directory**

Add a `currentViewPath` state that tracks which directory is currently expanded in the picker. Default it to `cwd` on picker open.

**Step 2: Add a ".." breadcrumb row**

At the top of the picker popup, render a clickable ".." entry that calls `listTree` with the parent of the current path. Show a `GoUp` or `ArrowUp` icon.

**Step 3: Wire it into toggleDir or add a new goUp handler**

```tsx
const goUp = async () => {
  if (!cwd) return;
  const parts = cwd.split('/').filter(Boolean);
  if (parts.length <= 1) return; // already at root
  const parent = '/' + parts.slice(0, -1).join('/');
  setCwd(parent);
  setTree([]);
  setExpandedDirs(new Set());
  setPickerLoading(true);
  try {
    const data = await listTree(parent);
    setTree(data);
  } catch {
    toast.error('Cannot go up');
  } finally {
    setPickerLoading(false);
  }
};
```

**Step 4: Render the ".." row at the top of the picker**

```tsx
{cwd && (
  <div
    className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-accent text-sm mb-1"
    onClick={goUp}
  >
    <ChevronRight className="h-3 w-3 text-muted-foreground" />
    <span className="truncate">..</span>
  </div>
)}
```

**Verification:**
- Run `npx tsc --noEmit` — no errors
- Open picker in browser, click "..", verify parent dir loads

---

## Task 2: Make folder path input editable + show current path

**Objective:** Let users type or paste any absolute path directly, and show the current picker path so they know where they are.

**Files:**
- Modify: `src/pages/ProjectsPage.tsx`

**Step 1: Remove `readOnly` from the folder path input**

```tsx
<Input
  value={folderPath}
  onChange={(e) => setFolderPath(e.target.value)}
  placeholder="/home/pefman/git/atlas"
  className="flex-1"
/>
```

**Step 2: Add path breadcrumb/badge above the picker tree**

When picker is open, show the current `cwd` as a small badge so users see where they are:

```tsx
{pickerOpen && cwd && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
    <Folder className="h-3 w-3" />
    <span className="truncate">{cwd}</span>
  </div>
)}
```

**Verification:**
- Run `npx tsc --noEmit` — no errors
- Type a path into the input, verify it sets `folderPath`
- Click picker folder icon, verify cwd badge shows

---

## Task 3: Reset picker state when folder path changes externally

**Objective:** If user types a path manually, close/open the picker shows them the right directory instead of the old cwd.

**Files:**
- Modify: `src/pages/ProjectsPage.tsx`

**Step 1: Add a useEffect that syncs cwd with folderPath when picker opens**

```tsx
useEffect(() => {
  if (!pickerOpen) return;
  if (folderPath) {
    setCwd(folderPath);
  }
  // ... existing load logic ...
}, [pickerOpen, folderPath]);
```

**Verification:**
- Type `/tmp` into the input
- Click folder icon — picker shows `/tmp` contents, not cwd

---

## Files to change

| File | Change |
|------|--------|
| `src/pages/ProjectsPage.tsx` | Add `goUp` handler, `currentViewPath` state, editable input, path breadcrumb |

## Verification

```bash
npx tsc --noEmit
npm run build
```

## Risks

- None significant. Purely frontend changes. Server already accepts any absolute path.
