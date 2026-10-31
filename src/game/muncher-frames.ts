/**
 * Muncher animation frame selection, pure so it is testable.
 *
 * When the optional original-art pack (public/sprites/muncher) is present the
 * Muncher is drawn from the 1990 sprite frames instead of a single static
 * image: a fast frame cycle right after a munch, a slower walk cycle, and the
 * first frame at rest.
 */

export const MUNCH_ANIM_MS = 450;
export const MOVE_ANIM_MS = 380;
export const MUNCH_FRAME_MS = 70;
export const MOVE_FRAME_MS = 140;

export interface MuncherFrameState {
  /** Milliseconds since the last munch attempt, or null. */
  munchElapsed: number | null;
  /** Milliseconds since the last step, or null. */
  moveElapsed: number | null;
}

export function muncherFrameIndex(state: MuncherFrameState, frameCount: number): number {
  if (frameCount <= 1) return 0;
  const { munchElapsed, moveElapsed } = state;
  if (munchElapsed !== null && munchElapsed >= 0 && munchElapsed < MUNCH_ANIM_MS) {
    return Math.floor(munchElapsed / MUNCH_FRAME_MS) % frameCount;
  }
  if (moveElapsed !== null && moveElapsed >= 0 && moveElapsed < MOVE_ANIM_MS) {
    return Math.floor(moveElapsed / MOVE_FRAME_MS) % frameCount;
  }
  // At rest: the first frame.
  return 0;
}
