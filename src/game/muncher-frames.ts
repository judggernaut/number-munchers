/**
 * Muncher animation, matched to the original binary.
 *
 * From NM.EXE (see docs/re/original-analysis.md):
 *   - the munch is ONE pass of frames 0..6, 7 scheduler frames ≈ 240 ms
 *     (FUN_17e7_1539)
 *   - standing and walking are a single static pose, frame 4 / frame 3 -
 *     the same bitmap (FUN_17e7_1c31, FUN_17e7_11dd); the mouth does not
 *     animate while moving
 *   - frame 2 is the wrong-munch pose, frame 6 the caught-by-Troggle pose
 */

/**
 * One full munch: the original's 7-frame pass. The binary ticks it at
 * ~34 ms/frame (240 ms total), which is too fast to read at 60 fps, so the
 * pass plays at 70 ms/frame (490 ms) - same sequence, visible chomp.
 */
export const MUNCH_ANIM_MS = 490;
export const MUNCH_FRAME_MS = 70;

/**
 * Frame index within the munch cycle. Returns 0 outside a munch; the caller
 * draws the rest pose in that case anyway.
 */
export function muncherFrameIndex(munchElapsed: number | null, frameCount: number): number {
  if (frameCount <= 1) return 0;
  if (munchElapsed === null || munchElapsed < 0 || munchElapsed >= MUNCH_ANIM_MS) return 0;
  return Math.floor(munchElapsed / MUNCH_FRAME_MS) % frameCount;
}

/**
 * Facing direction: 1 = right, -1 = left. Vertical movement keeps the current
 * facing, exactly like a platformer, so the Muncher always chomps toward the
 * way it last walked.
 */
export type Facing = 1 | -1;

export function nextFacing(current: Facing, dc: number): Facing {
  if (dc > 0) return 1;
  if (dc < 0) return -1;
  return current;
}

/** True while a munch animation is still playing. */
export function isMunching(munchElapsed: number | null): boolean {
  return munchElapsed !== null && munchElapsed >= 0 && munchElapsed < MUNCH_ANIM_MS;
}
