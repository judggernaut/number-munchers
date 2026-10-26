import type { Rng } from '../content/types';

/**
 * Troggle AI.
 *
 * Five species, each with one readable movement idea (mirroring the original
 * roster: Reggie, Worker, Smarty, Bashful, Helper). All rules are pure
 * functions of position + direction + RNG so they are deterministic in tests.
 */
export type TroggleSpecies = 'reggie' | 'worker' | 'smarty' | 'bashful' | 'helper';

export const SPECIES_NAMES: Record<TroggleSpecies, string> = {
  reggie: 'Reggulus randomus',
  worker: 'Trogglus laborus',
  smarty: 'Trogglus smartus',
  bashful: 'Trogglus timidus',
  helper: 'Trogglus helpus',
};

export const SPECIES_COLORS: Record<TroggleSpecies, string> = {
  reggie: '#ff5a5a',
  worker: '#ffb347',
  smarty: '#b06bff',
  bashful: '#5ad2ff',
  helper: '#7dff7d',
};

export interface Vec {
  dc: number;
  dr: number;
}

export interface Cell {
  col: number;
  row: number;
}

export interface Troggle {
  id: number;
  species: TroggleSpecies;
  col: number;
  row: number;
  dir: Vec;
  /** Visual interpolation: where the troggle was before this step. */
  fromCol: number;
  fromRow: number;
  /** Timestamp of the last step, for easing. */
  steppedAt: number;
}

export interface WalkContext {
  cols: number;
  rows: number;
  muncher: Cell;
  rng: Rng;
}

const DIRS: Vec[] = [
  { dc: 0, dr: -1 },
  { dc: 1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
];

export const sameVec = (a: Vec, b: Vec): boolean => a.dc === b.dc && a.dr === b.dr;

const isInside = (cell: Cell, ctx: WalkContext): boolean =>
  cell.col >= 0 && cell.col < ctx.cols && cell.row >= 0 && cell.row < ctx.rows;

const advance = (t: { col: number; row: number }, dir: Vec): Cell => ({
  col: t.col + dir.dc,
  row: t.row + dir.dr,
});

const manhattan = (a: Cell, b: Cell): number => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

/**
 * One step for one troggle. Returns a new troggle; if every neighbouring cell
 * is off-board (impossible on a 6x5 board, but defensive) it stays put.
 */
export function stepTroggle(t: Troggle, ctx: WalkContext, now = 0): Troggle {
  const valid = DIRS.filter((dir) => isInside(advance(t, dir), ctx));
  if (valid.length === 0) return { ...t };

  const forwardOk = valid.find((dir) => sameVec(dir, t.dir));
  const next = chooseDir(t, valid, forwardOk ?? null, ctx);
  const target = advance(t, next);

  return {
    ...t,
    fromCol: t.col,
    fromRow: t.row,
    col: target.col,
    row: target.row,
    dir: next,
    steppedAt: now,
  };
}

function chooseDir(t: Troggle, valid: Vec[], forward: Vec | null, ctx: WalkContext): Vec {
  const { rng } = ctx;
  switch (t.species) {
    case 'worker': {
      // Never turns voluntarily: bounces off walls, otherwise keeps going.
      if (forward) return forward;
      return { dc: -t.dir.dc, dr: -t.dir.dr };
    }
    case 'smarty': {
      // Greedy chase, never doubles back unless trapped.
      const candidates = valid.filter((dir) => !sameVec(dir, { dc: -t.dir.dc, dr: -t.dir.dr }));
      const pool = candidates.length > 0 ? candidates : valid;
      let best = pool[0]!;
      let bestScore = Infinity;
      for (const dir of pool) {
        const score = manhattan(advance(t, dir), ctx.muncher) + (forward && sameVec(dir, forward) ? -0.25 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = dir;
        }
      }
      return best;
    }
    case 'bashful': {
      // Maximise distance from the muncher.
      let best = valid[0]!;
      let bestScore = -Infinity;
      for (const dir of valid) {
        const score = manhattan(advance(t, dir), ctx.muncher);
        if (score > bestScore) {
          bestScore = score;
          best = dir;
        }
      }
      return best;
    }
    case 'helper': {
      // Aimless but persistent: usually continues, occasionally sideslips.
      if (forward && rng.chance(0.78)) return forward;
      return rng.pick(valid);
    }
    case 'reggie':
    default: {
      // Random walk with momentum: continue unless it hits a wall.
      if (forward && rng.chance(0.65)) return forward;
      const pool = valid.filter((dir) => !sameVec(dir, forward ?? { dc: 0, dr: 0 }));
      return rng.pick(pool.length > 0 ? pool : valid);
    }
  }
}

/** Spawn a troggle on a random edge cell, facing inward. */
export function spawnAtEdge(
  ctx: WalkContext,
  species: TroggleSpecies,
  id: number,
  muncher: Cell,
): Troggle {
  const { rng, cols, rows } = ctx;
  type Edge = { col: number; row: number; dir: Vec };
  const edges: Edge[] = [];
  for (let col = 0; col < cols; col++) {
    edges.push({ col, row: 0, dir: { dc: 0, dr: 1 } });
    edges.push({ col, row: rows - 1, dir: { dc: 0, dr: -1 } });
  }
  for (let row = 1; row < rows - 1; row++) {
    edges.push({ col: 0, row, dir: { dc: 1, dr: 0 } });
    edges.push({ col: cols - 1, row, dir: { dc: -1, dr: 0 } });
  }
  // Prefer an edge away from the muncher so spawns are never instant deaths.
  const scored = edges
    .map((edge) => ({ edge, dist: manhattan(edge, muncher) }))
    .sort((a, b) => b.dist - a.dist);
  const pool = scored.slice(0, Math.max(3, Math.ceil(scored.length / 3))).map((s) => s.edge);
  const pick = rng.pick(pool);
  return {
    id,
    species,
    col: pick.col,
    row: pick.row,
    dir: pick.dir,
    fromCol: pick.col,
    fromRow: pick.row,
    steppedAt: 0,
  };
}

/** True when a troggle occupies the muncher's cell. */
export function collides(t: Troggle, muncher: Cell): boolean {
  return t.col === muncher.col && t.row === muncher.row;
}
