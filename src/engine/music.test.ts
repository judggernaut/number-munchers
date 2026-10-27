import { describe, expect, it } from 'vitest';

import { Music, nextCursor, parseManifest, shuffleOrder } from './music';

describe('music manifest', () => {
  it('reads plain file names', () => {
    expect(parseManifest({ tracks: [{ file: 'a.mp3' }, { file: 'b.mp3' }] })).toEqual(['a.mp3', 'b.mp3']);
  });

  it('rejects paths, traversal and junk entries', () => {
    const files = parseManifest({
      tracks: [
        { file: '../secret.mp3' },
        { file: 'sub/dir.mp3' },
        { file: 'https://example.com/x.mp3' },
        { file: '  ' },
        { file: 42 },
        {},
        null,
        { file: 'ok.mp3' },
      ],
    });
    expect(files).toEqual(['ok.mp3']);
  });

  it('survives missing or malformed manifests', () => {
    expect(parseManifest(null)).toEqual([]);
    expect(parseManifest('nope')).toEqual([]);
    expect(parseManifest({})).toEqual([]);
    expect(parseManifest({ tracks: 'nope' })).toEqual([]);
  });
});

describe('music defaults', () => {
  it('plays quietly by default', () => {
    expect(new Music().volume).toBe(0.08);
  });

  it('can be told a different volume', () => {
    expect(new Music(0.2).volume).toBe(0.2);
  });
});

describe('playlist order', () => {
  it('is a full permutation', () => {
    const order = shuffleOrder(7, () => 0.42);
    expect(order.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('is deterministic for a fixed rng', () => {
    expect(shuffleOrder(5, () => 0.5)).toEqual(shuffleOrder(5, () => 0.5));
  });

  it('wraps at the end of the playlist', () => {
    expect(nextCursor(0, 3)).toBe(1);
    expect(nextCursor(2, 3)).toBe(0);
    expect(nextCursor(0, 0)).toBe(0);
  });
});
