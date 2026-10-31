import { describe, expect, it } from 'vitest';

import { MUNCH_ANIM_MS, MUNCH_FRAME_MS, isMunching, muncherFrameIndex } from './muncher-frames';

describe('muncher frame selection', () => {
  it('cycles the sheet while munching', () => {
    expect(muncherFrameIndex(0, 14)).toBe(0);
    expect(muncherFrameIndex(MUNCH_FRAME_MS, 14)).toBe(1);
    expect(muncherFrameIndex(MUNCH_FRAME_MS * 5, 14)).toBe(5);
    // Wraps around the sheet.
    expect(muncherFrameIndex(MUNCH_FRAME_MS * 14, 14)).toBe(0);
  });

  it('rests outside a munch', () => {
    expect(muncherFrameIndex(null, 14)).toBe(0);
    expect(muncherFrameIndex(MUNCH_ANIM_MS + 1, 14)).toBe(0);
    expect(muncherFrameIndex(-1, 14)).toBe(0);
  });

  it('never opens the mouth just from walking', () => {
    // Walking is not an input to the selector at all: any non-munch state
    // resolves to the rest pose.
    expect(muncherFrameIndex(null, 14)).toBe(0);
  });

  it('is safe with no frames or a single frame', () => {
    expect(muncherFrameIndex(100, 0)).toBe(0);
    expect(muncherFrameIndex(100, 1)).toBe(0);
  });

  it('reports when a munch is in progress', () => {
    expect(isMunching(0)).toBe(true);
    expect(isMunching(MUNCH_ANIM_MS - 1)).toBe(true);
    expect(isMunching(MUNCH_ANIM_MS)).toBe(false);
    expect(isMunching(null)).toBe(false);
    expect(isMunching(-1)).toBe(false);
  });
});
