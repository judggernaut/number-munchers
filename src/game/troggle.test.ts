import { describe, expect, it } from 'vitest';

import { createRng } from '../content/rng';
import { stepTroggle, spawnAtEdge, type Troggle, type WalkContext } from './troggle';

const ctx = (muncher = { col: 0, row: 0 }, seed = 7): WalkContext => ({
  cols: 6,
  rows: 5,
  muncher,
  rng: createRng(seed),
});

const troggle = (over: Partial<Troggle> = {}): Troggle => ({
  id: 1,
  species: 'reggie',
  col: 3,
  row: 2,
  dir: { dc: 1, dr: 0 },
  fromCol: 3,
  fromRow: 2,
  steppedAt: 0,
  ...over,
});

describe('troggle movement', () => {
  it('worker never turns on its own and bounces off the wall', () => {
    const walking = stepTroggle(troggle({ species: 'worker', col: 3, row: 2, dir: { dc: 1, dr: 0 } }), ctx());
    expect(walking.col).toBe(4);
    expect(walking.row).toBe(2);
    expect(walking.dir).toEqual({ dc: 1, dr: 0 });

    const atWall = stepTroggle(troggle({ species: 'worker', col: 5, row: 2, dir: { dc: 1, dr: 0 } }), ctx());
    expect(atWall.col).toBe(4);
    expect(atWall.dir.dc).toBe(-1);
    expect(Math.abs(atWall.dir.dr)).toBe(0);
  });

  it('smarty closes the distance to the muncher', () => {
    const start = troggle({ species: 'smarty', col: 4, row: 4, dir: { dc: 0, dr: -1 } });
    const muncher = { col: 0, row: 0 };
    const before = Math.abs(start.col - muncher.col) + Math.abs(start.row - muncher.row);
    const after = stepTroggle(start, ctx(muncher));
    const distance = Math.abs(after.col - muncher.col) + Math.abs(after.row - muncher.row);
    expect(distance).toBeLessThan(before);
  });

  it('bashful opens the distance from the muncher', () => {
    const start = troggle({ species: 'bashful', col: 1, row: 1, dir: { dc: 1, dr: 0 } });
    const muncher = { col: 0, row: 0 };
    const before = Math.abs(start.col - muncher.col) + Math.abs(start.row - muncher.row);
    const after = stepTroggle(start, ctx(muncher));
    const distance = Math.abs(after.col - muncher.col) + Math.abs(after.row - muncher.row);
    expect(distance).toBeGreaterThanOrEqual(before);
  });

  it('keeps every species inside the board for 300 steps', () => {
    for (const species of ['reggie', 'worker', 'smarty', 'bashful', 'helper'] as const) {
      let current = troggle({ species, col: 2, row: 2, dir: { dc: 0, dr: 1 } });
      const context = ctx({ col: 5, row: 4 }, 42);
      for (let i = 0; i < 300; i++) {
        current = stepTroggle(current, context, i);
        expect(current.col).toBeGreaterThanOrEqual(0);
        expect(current.col).toBeLessThan(6);
        expect(current.row).toBeGreaterThanOrEqual(0);
        expect(current.row).toBeLessThan(5);
        expect(Math.abs(current.col - current.fromCol) + Math.abs(current.row - current.fromRow)).toBe(1);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const run = (): Array<[number, number]> => {
      const context = ctx({ col: 0, row: 0 }, 99);
      let current = troggle({ species: 'reggie' });
      const trail: Array<[number, number]> = [];
      for (let i = 0; i < 40; i++) {
        current = stepTroggle(current, context);
        trail.push([current.col, current.row]);
      }
      return trail;
    };
    expect(run()).toEqual(run());
  });
});

describe('troggle spawning', () => {
  it('spawns on an edge, facing inward, away from the muncher', () => {
    const context = ctx({ col: 2, row: 2 }, 5);
    for (let i = 0; i < 50; i++) {
      const spawned = spawnAtEdge(context, 'reggie', i, context.muncher);
      const onEdge = spawned.col === 0 || spawned.col === 5 || spawned.row === 0 || spawned.row === 4;
      expect(onEdge).toBe(true);
      expect(spawned.col === context.muncher.col && spawned.row === context.muncher.row).toBe(false);
      expect(spawned.dir.dc === 0 && spawned.dir.dr === 0).toBe(false);
      expect(spawned.col + spawned.dir.dc).toBeGreaterThanOrEqual(0);
      expect(spawned.row + spawned.dir.dr).toBeGreaterThanOrEqual(0);
      expect(spawned.col + spawned.dir.dc).toBeLessThan(6);
      expect(spawned.row + spawned.dir.dr).toBeLessThan(5);
    }
  });
});
