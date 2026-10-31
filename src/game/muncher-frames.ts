/**
 * Muncher animation frame selection, pure so it is testable.
 *
 * The Muncher only cycles frames while it munches. Walking and standing use
 * the rest frame (mouth closed) - cycling while walking made it look like it
 * was biting at every step.
 */

/** One full munch: 14 frames at 40 ms reads as a quick, snappy chomp. */
export const MUNCH_ANIM_MS = 560;
export const MUNCH_FRAME_MS = 40;

/**
 * Frame index for a munch in progress. Returns 0 (the rest pose) when no munch
 * is happening; the caller draws the rest image in that case anyway.
 */
export function muncherFrameIndex(munchElapsed: number | null, frameCount: number): number {
  if (frameCount <= 1) return 0;
  if (munchElapsed === null || munchElapsed < 0 || munchElapsed >= MUNCH_ANIM_MS) return 0;
  return Math.floor(munchElapsed / MUNCH_FRAME_MS) % frameCount;
}

/** True while a munch animation is still playing. */
export function isMunching(munchElapsed: number | null): boolean {
  return munchElapsed !== null && munchElapsed >= 0 && munchElapsed < MUNCH_ANIM_MS;
}
