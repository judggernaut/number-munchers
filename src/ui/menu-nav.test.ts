import { describe, expect, it } from 'vitest';

import { PAUSE_ITEMS, cycleIndex, rowAt } from './menu-nav';

describe('pause menu', () => {
  it('has three reachable options in order', () => {
    expect(PAUSE_ITEMS).toEqual(['RESUME', 'LEARN THIS TOPIC', 'QUIT TO MENU']);
    expect(PAUSE_ITEMS).toHaveLength(3);
  });

  it('reaches every option by pressing down repeatedly', () => {
    let index = 0;
    const visited = [index];
    for (let i = 0; i < 3; i++) {
      index = cycleIndex(index, 1, PAUSE_ITEMS.length);
      visited.push(index);
    }
    expect(visited).toEqual([0, 1, 2, 0]);
  });

  it('wraps upwards', () => {
    expect(cycleIndex(0, -1, 3)).toBe(2);
    expect(cycleIndex(2, 1, 3)).toBe(0);
  });

  it('is stable for a single-item menu', () => {
    expect(cycleIndex(0, 1, 1)).toBe(0);
    expect(cycleIndex(0, -1, 1)).toBe(0);
    expect(cycleIndex(0, 1, 0)).toBe(0);
  });
});

describe('rowAt', () => {
  it('maps pointer rows inside the list', () => {
    expect(rowAt(175, 170, 24, 3)).toBe(0);
    expect(rowAt(200, 170, 24, 3)).toBe(1);
    expect(rowAt(230, 170, 24, 3)).toBe(2);
  });

  it('returns -1 outside the list', () => {
    expect(rowAt(100, 170, 24, 3)).toBe(-1);
    expect(rowAt(400, 170, 24, 3)).toBe(-1);
  });
});
