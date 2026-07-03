# Deterministic Pixel Avatar Generator - Implementation Plan

## Overview
Replace the current LLM-based portrait generation (~40s/role) with a deterministic algorithm that generates avatars instantly (~0ms) while maintaining consistency (same role always produces same avatar).

## Implementation Steps

### 1. Create Avatar Generator Utility (`server/lib/avatarGenerator.ts`)

**Functions:**
- `generateAvatar(roleName: string): string[][]` - Generates 32x32 pixel grid
- `seededRandom(seed: number): number` - Deterministic random from seed
- `hashString(str: string): number` - Simple hash for role name
- `renderPixelGridToBase64(grid: string[][]): string` - Convert to PNG base64 (reuse existing)

**Color Palettes:**
```javascript
const palettes = {
  background: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#2b2d42'],
  skin: ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'],
  hair: ['#2c1b16', '#4a2c1f', '#8b4513', '#d2691e', '#f4a460'],
  clothes: ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e67e22'],
  eyes: ['#2c3e50', '#3498db', '#27ae60', '#8e44ad', '#e74c3c'],
};
```

**Face Shape Logic:**
- Face: Center 16x20 area (x: 8-23, y: 6-26)
- Hair: Top area (x: 7-24, y: 2-8)
- Eyes: Two small rectangles in face area
- Mouth: Small line in lower face area
- Clothes: Bottom area (x: 6-25, y: 24-31)

**Algorithm:**
1. Hash role name to get seed
2. Use seed to pick colors from palettes
3. Fill grid based on shape logic
4. Add simple features (eyes, mouth)
5. Return 32x32 color grid

### 2. Update Scheduler (`server/scheduler.ts`)

**Replace `generatePortrait` method:**
```typescript
private async generatePortrait(roleName: string): Promise<string> {
  // Use deterministic generator instead of LLM
  const grid = generateAvatar(roleName);
  return this.renderPixelGridToBase64(grid);
}
```

**Keep old method as `generatePortraitAI` for manual regeneration:**
- Add new endpoint `POST /:id/regenerate-ai-portrait`
- Calls original LLM-based generation
- Allows users to upgrade specific avatars

### 3. Update `seedPortraits` Method

Current implementation calls `generatePortrait` for each role without portrait. This will now be instant.

**Optional optimization:** Add a flag to skip regeneration if avatars already exist.

### 4. Add Regenerate Endpoint

**`POST /api/agents/:id/regenerate-ai-portrait`**
- Uses original LLM-based generation
- Allows manual upgrade of specific avatars
- Optional feature - not required for initial implementation

### 5. Testing

**Test cases:**
1. Generate avatar for each existing role
2. Verify same input produces same output (deterministic)
3. Verify different roles produce different avatars
4. Verify base64 output renders correctly
5. Test with empty role names (edge case)

**Visual verification:**
- Check that avatars look like recognizable pixel art
- Verify color variety across different roles
- Ensure no artifacts or rendering issues

## Files to Modify

1. `server/lib/avatarGenerator.ts` - NEW utility file
2. `server/scheduler.ts` - Replace `generatePortrait` method
3. `server/routes/agents.ts` - Optional: Add regenerate endpoint
4. `tests/avatarGenerator.test.ts` - NEW test file

## Migration Path

1. **Phase 1:** Implement deterministic generator
2. **Phase 2:** Replace `generatePortrait` in scheduler
3. **Phase 3:** Run `seedPortraits` to regenerate all avatars
4. **Phase 4:** (Optional) Add AI regenerate endpoint for manual upgrades

## Performance Expectations

- **Before:** ~40 seconds per role (LLM API call)
- **After:** ~0ms per role (deterministic algorithm)
- **Total startup time:** Reduced from minutes to milliseconds

## Backward Compatibility

- Existing avatars in database remain valid
- New avatars generated using new algorithm
- Both formats render identically in UI (base64 PNG)
