# Piano Roll Rectangle Selection Issue

## What the user sees
- On the default zoom level the box-selection (Cmd/Ctrl + drag) used to work.
- After zooming (horizontal pinch or vertical slider) drawing a rectangle over notes sometimes fails to select them. Notes visually inside the blue box often stay unselected.
- Zooming back to 100% no longer restores the original behaviour; selection can miss even without scroll.

## History of attempts
1. **Initial fix attempt** – Added `scrollTop` offsets to `usePianoRollInteractions` and `useMarqueeSelection` so the rectangle coordinates matched note hitboxes. Result: note placement, deletion, and selection broken everywhere. Changes were reverted.
2. **Second attempt** – Reintroduced `scrollTop` only inside marquee logic and began compensating in `DynamicOverlay`. Still no reliable selection after zoom; default zoom also degraded.
3. **Current state** – We've flipped between viewport-space and absolute-space several times. The latest code keeps pointer/world conversions untouched and tries to adjust only the marquee path, but selection is still inaccurate even at the default zoom level. Blue rectangle renders roughly in the right spot, but the hit test does not match what is drawn.

## What we know technically
- Note hitboxes (`getClipRectPx`) use absolute Y coordinates (key index × keyHeight).
- Pointer events give viewport Y (relative to the scrolled container).
- Marquee rectangles now store absolute Y (worldY + scrollTop) but the selection overlay subtracts scroll once more, so the rectangle looks correct.
- The intersection check compares clip rects (absolute) to selection rects (absolute). Despite this, results are inconsistent, suggesting other code paths (e.g., cursor highlight, note creation) still expect viewport coords and may be interfering when marquee starts.

## Claude Changes (3rd attempt) - FAILED
**What was tried:**
1. Initial analysis concluded that `worldY = localY` in `usePianoRollInteractions.ts` (line 256) was wrong and should be `worldY = localY + scrollTop` to convert viewport coords to world coords.
2. Made changes to add `scrollTop` to `worldY`, which broke single-click note placement completely.
3. Reverted that approach and analyzed the canvas rendering system.
4. Discovered that canvases (NotesLayer, DynamicOverlay) use `ctx.translate(-scrollLeft, 0)` - only X translation, not Y.
5. Concluded that canvas Y coordinates are absolute (not viewport-relative).
6. Removed the `scrollTop` subtraction from DynamicOverlay.tsx (lines 142-143) that was added by the previous agent.

**Result:**
- **STILL COMPLETELY BROKEN**
- Marquee selection is still inaccurate at all zoom levels
- Rectangle only draws in upper half of piano roll
- Bottom half of piano roll doesn't even draw the rectangle
- Selection hit test still doesn't match what's visually drawn

**Current broken state:**
- All changes from previous agents are still in place (scrollTop added to useMarqueeSelection, startMarquee call, etc.)
- DynamicOverlay no longer subtracts scrollTop (this change was wrong)
- The coordinate system is fundamentally broken across multiple files

## Next steps for the next agent
- **DO NOT TRUST PREVIOUS CHANGES** - The cumulative changes across 3 attempts have made it worse
- Consider reverting ALL changes to the last working commit before any rectangle fixes were attempted
- Start completely fresh and trace through ONE successful interaction (single click) to understand the actual coordinate system
- The issue that "rectangle only draws in upper half" suggests a fundamental canvas setup or viewport clipping issue
- Re-examine how `startMarquee` is invoked (`worldY` currently lacks scrollTop) vs. how `handleMarqueeMove` stores Y. Ensure both use the same coordinate space.
- Confirm `selectionRect` consumed by `DynamicOverlay` and `useMarqueeSelection` is either always absolute or always viewport. Mixing them causes the current inconsistencies.

The issue is still open; selection is unreliable at all zoom levels.
