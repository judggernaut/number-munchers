/**
 * Menu cursor maths, kept pure so the navigation rules are testable without a
 * canvas. The pause menu is the reason this exists: when it had a hand-rolled
 * two-item toggle, "Learn" and "Quit" collapsed into the same slot and the
 * third option became unreachable.
 */

export const PAUSE_ITEMS = ['RESUME', 'LEARN THIS TOPIC', 'QUIT TO MENU'] as const;
export type PauseItem = (typeof PAUSE_ITEMS)[number];

/** Move a cursor by `delta`, wrapping in both directions. */
export function cycleIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  const start = ((index % count) + count) % count;
  return (((start + delta) % count) + count) % count;
}

/** Row index under a vertical position inside a list. */
export function rowAt(y: number, top: number, rowHeight: number, count: number): number {
  const row = Math.floor((y - top) / rowHeight);
  return row >= 0 && row < count ? row : -1;
}
