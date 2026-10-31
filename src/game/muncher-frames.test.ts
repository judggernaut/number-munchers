import { describe, expect, it } from 'vitest';

import {
  MUNCH_ANIM_MS,
  MUNCH_FRAME_MS,
  MOVE_ANIM_MS,
  MOVE_FRAME_MS,
  muncherFrameIndex,
} from './muncher-frames';

describe('muncher frame selection', () => {
  it('cycles quickly while munching', () => {
    expect(muncherFrameIndex({ munchElapsed: 0, moveElapsed: null }, 10)).toBe(0);
    expect(muncherFrameIndex({ munchElapsed: MUNCH_FRAME_MS, moveElapsed: null }, 10)).toBe(1);
    expect(muncherFrameIndex({ munchElapsed: MUNCH_FRAME_MS * 3, moveElapsed: null }, 10)).toBe(3);
    // Wraps around the sheet.
    expect(muncherFrameIndex({ munchElapsed: MUNCH_FRAME_MS * 10, moveElapsed: null }, 10)).toBe(0);
  });

  it('cycles more slowly while walking', () => {
    expect(muncherFrameIndex({ munchElapsed: null, moveElapsed: 0 }, 10)).toBe(0);
    expect(muncherFrameIndex({ munchElapsed: null, moveElapsed: MOVE_FRAME_MS }, 10)).toBe(1);
    expect(muncherFrameIndex({ munchElapsed: null, moveElapsed: MOVE_FRAME_MS * 2 }, 10)).toBe(2);
  });

  it('rests on the first frame', () => {
    expect(muncherFrameIndex({ munchElapsed: null, moveElapsed: null }, 10)).toBe(0);
    expect(muncherFrameIndex({ munchElapsed: MUNCH_ANIM_MS + 1, moveElapsed: MOVE_ANIM_MS + 1 }, 10)).toBe(0);
  });

  it('munching takes priority over walking', () => {
    expect(muncherFrameIndex({ munchElapsed: MUNCH_FRAME_MS * 2, moveElapsed: 0 }, 10)).toBe(2);
  });

  it('is safe with no frames or a single frame', () => {
    expect(muncherFrameIndex({ munchElapsed: 100, moveElapsed: null }, 0)).toBe(0);
    expect(muncherFrameIndex({ munchElapsed: 100, moveElapsed: null }, 1)).toBe(0);
  });

  it('treats negative elapsed as not happening', () => {
    expect(muncherFrameIndex({ munchElapsed: -1, moveElapsed: MOVE_FRAME_MS }, 10)).toBe(1);
  });
});
