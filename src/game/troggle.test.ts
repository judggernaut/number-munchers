import { describe, expect, it } from 'vitest';

import { createRng } from '../content/rng';
import {
  CHASE_RADIUS,
  stepTroggle,
  spawnAtEdge,
  type Troggle,
  type TroggleSpecies,
  type WalkContext,
} from './troggle';

const ctx = (muncher = { col: 0, row: 0 }, seed = 7): WalkContext => ({
  cols: 6,
  rows: 5,
  muncher,
  rng: createRng(seed),
});

const troggle = (over: Partial<Troggle> = {}): Troggle => ({
  id: 1,
  species: 'normalus',
  col: 3,
  row: 2,
  dir: { dc: 1, dr: 0 },
  fromCol: 3,
  fromRow: 2,
  steppedAt: 0,
  ...over,
});

const distance = (t: Troggle, muncher: { col: number; row: number }): number =>
  Math.abs(t.col - muncher.col) + Math.abs(t.row - muncher.row);

describe('troggle movement', () => {
  it('normalus walks straight while the path is clear', () => {
    const walking = stepTroggle(troggle({ species: 'normalus', col: 2, row: 2, dir: { dc: 1, dr: 0 } }), ctx());
    expect(walking.col).toBe(3);
    expect(walking.row).toBe(2);
    expect(walking.dir).toEqual({ dc: 1, dr: 0 });
  });

  it('normalus turns instead of reversing when it hits a wall', () => {
    const atWall = stepTroggle(troggle({ species: 'normalus', col: 5, row: 2, dir: { dc: 1, dr: 0 } }), ctx());
    expect(atWall.col).toBeLessThanOrEqual(5);
    expect(atWall.col).toBeGreaterThanOrEqual(0);
    // A side-step keeps one axis moving; a reversal would be dc = -1.
    const reversed = atWall.dir.dc === -1 && atWall.dir.dr === 0;
    expect(reversed).toBe(false);
  });

  it('laborus mostly keeps going straight', () => {
    const context = ctx({ col: 0, row: 0 }, 99);
    let current = troggle({ species: 'laborus', col: 2, row: 2, dir: { dc: 1, dr: 0 } });
    let straight = 0;
    for (let i = 0; i < 40; i++) {
      const next = stepTroggle(current, context, i);
      if (next.dir.dc === current.dir.dc && next.dir.dr === current.dir.dr) straight++;
      current = next;
    }
    // ~80% straight by design; allow slack for wall bounces.
    expect(straight).toBeGreaterThan(20);
  });

  it('smarticus closes the distance inside the chase radius', () => {
    const muncher = { col: 0, row: 0 };
    const start = troggle({ species: 'smarticus', col: CHASE_RADIUS, row: 0, dir: { dc: 1, dr: 0 } });
    const after = stepTroggle(start, ctx(muncher));
    expect(distance(after, muncher)).toBeLessThan(distance(start, muncher));
  });

  it('timidus opens the distance inside the chase radius', () => {
    const muncher = { col: 0, row: 0 };
    const start = troggle({ species: 'timidus', col: 1, row: 1, dir: { dc: 1, dr: 0 } });
    const after = stepTroggle(start, ctx(muncher));
    expect(distance(after, muncher)).toBeGreaterThanOrEqual(distance(start, muncher));
  });

  it('keeps every species inside the board for 300 steps', () => {
    const species: TroggleSpecies[] = ['normalus', 'laborus', 'timidus', 'assistus', 'smarticus'];
    for (const kind of species) {
      let current = troggle({ species: kind, col: 2, row: 2, dir: { dc: 0, dr: 1 } });
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
      let current = troggle({ species: 'normalus' });
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
      const spawned = spawnAtEdge(context, 'normalus', i, context.muncher);
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
