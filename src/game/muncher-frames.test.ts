import { describe, expect, it } from 'vitest';

import { MUNCH_ANIM_MS, MUNCH_FRAME_MS, isMunching, muncherFrameIndex } from './muncher-frames';

// The original munch is one pass of frames 0..6 over ~240 ms.
const FRAMES = 7;

describe('muncher frame selection', () => {
  it('plays one pass of the original 7-frame sequence', () => {
    expect(muncherFrameIndex(0, FRAMES)).toBe(0);
    expect(muncherFrameIndex(MUNCH_FRAME_MS, FRAMES)).toBe(1);
    expect(muncherFrameIndex(MUNCH_FRAME_MS * 5, FRAMES)).toBe(5);
    // The final frame shows before the munch resolves.
    expect(muncherFrameIndex(MUNCH_ANIM_MS - 1, FRAMES)).toBe(FRAMES - 1);
  });

  it('rests outside a munch', () => {
    expect(muncherFrameIndex(null, FRAMES)).toBe(0);
    expect(muncherFrameIndex(MUNCH_ANIM_MS + 1, FRAMES)).toBe(0);
    expect(muncherFrameIndex(-1, FRAMES)).toBe(0);
  });

  it('never opens the mouth just from walking', () => {
    // Walking is not an input to the selector at all: any non-munch state
    // resolves to the rest pose, exactly like the original (frames 3 and 4
    // are the same static bitmap).
    expect(muncherFrameIndex(null, FRAMES)).toBe(0);
  });

  it('is safe with no frames or a single frame', () => {
    expect(muncherFrameIndex(100, 0)).toBe(0);
    expect(muncherFrameIndex(100, 1)).toBe(0);
  });

  it('matches the original timing: 7 frames in ~240 ms', () => {
    expect(MUNCH_ANIM_MS).toBe(240);
    expect(Math.round(MUNCH_FRAME_MS * FRAMES)).toBe(MUNCH_ANIM_MS);
  });

  it('reports when a munch is in progress', () => {
    expect(isMunching(0)).toBe(true);
    expect(isMunching(MUNCH_ANIM_MS - 1)).toBe(true);
    expect(isMunching(MUNCH_ANIM_MS)).toBe(false);
    expect(isMunching(null)).toBe(false);
    expect(isMunching(-1)).toBe(false);
  });
});
