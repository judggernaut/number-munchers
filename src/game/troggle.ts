import type { Rng } from '../content/types';

/**
 * Troggle AI, aligned with the behaviour recovered from the original NM.EXE
 * (see docs/re/original-analysis.md).
 *
 * Five species:
 *   normalus  - walks straight, turns only when blocked
 *   laborus   - mostly straight, sometimes side-steps; re-rolls the tile it leaves
 *   timidus   - flees when the Muncher is within ~96 px, otherwise wanders
 *   assistus  - same movement as laborus; erases the tile it leaves
 *   smarticus - turns toward the Muncher within 96 px, 50/50 within 192 px,
 *               walks straight beyond that
 *
 * All rules are pure functions of position + direction + RNG.
 */
export type TroggleSpecies = 'normalus' | 'laborus' | 'timidus' | 'assistus' | 'smarticus';

/** Species names as the game announces them. */
export const SPECIES_NAMES: Record<TroggleSpecies, string> = {
  normalus: 'Trogglus normalus',
  laborus: 'Trogglus laborus',
  timidus: 'Trogglus timidus',
  assistus: 'Trogglus assistus',
  smarticus: 'Trogglus smarticus',
};

/** Friendly nicknames used in menus and lessons. */
export const SPECIES_NICKNAMES: Record<TroggleSpecies, string> = {
  normalus: 'Reggie',
  laborus: 'Worker',
  timidus: 'Bashful',
  assistus: 'Helper',
  smarticus: 'Smarty',
};

export const SPECIES_COLORS: Record<TroggleSpecies, string> = {
  normalus: '#ff5a5a',
  laborus: '#ffb347',
  smarticus: '#b06bff',
  timidus: '#5ad2ff',
  assistus: '#7dff7d',
};

/** One cell is 64 px, so the original 96 px / 192 px radii are ~1.5 / ~3 cells. */
export const CHASE_RADIUS = 2;
export const FAR_RADIUS = 4;

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

const reverse = (dir: Vec): Vec => ({ dc: -dir.dc, dr: -dir.dr });

/** Perpendicular turns, the original's only alternative to going straight. */
const sideSteps = (dir: Vec): Vec[] => [
  { dc: dir.dr, dr: -dir.dc },
  { dc: -dir.dr, dr: dir.dc },
];

/** Decide the next direction. Returns the current direction when wedged. */
function chooseDirection(t: Troggle, ctx: WalkContext): Vec {
  const { rng } = ctx;
  const valid = DIRS.filter((dir) => isInside(advance(t, dir), ctx));
  if (valid.length === 0) return t.dir;

  const forwardOk = valid.some((dir) => sameVec(dir, t.dir));
  const distance = manhattan(t, ctx.muncher);

  const usable = (dirs: Vec[]): Vec[] => dirs.filter((dir) => valid.some((v) => sameVec(v, dir)));

  switch (t.species) {
    case 'normalus': {
      // Straight until something blocks it, then a side-step or a turnaround.
      if (forwardOk) return t.dir;
      const sides = usable(sideSteps(t.dir));
      if (sides.length > 0) return rng.pick(sides);
      const back = usable([reverse(t.dir)]);
      return back[0] ?? rng.pick(valid);
    }

    case 'laborus':
    case 'assistus': {
      // 80% straight, 20% side-step (matches the original's asymmetry).
      if (forwardOk && rng.chance(0.8)) return t.dir;
      const sides = usable(sideSteps(t.dir));
      const options = forwardOk ? sides : [...sides, reverse(t.dir)];
      const pool = options.filter((dir) => isInside(advance(t, dir), ctx));
      if (pool.length === 0) return t.dir;
      return rng.pick(pool);
    }

    case 'timidus': {
      // Flee inside the danger radius, wander (with reversals) outside it.
      if (distance <= CHASE_RADIUS) {
        // Fleeing may require a reversal, so every direction is allowed.
        let best = valid[0]!;
        let bestScore = -Infinity;
        for (const dir of valid) {
          const score =
            manhattan(advance(t, dir), ctx.muncher) + (sameVec(dir, t.dir) ? 0.25 : 0);
          if (score > bestScore) {
            bestScore = score;
            best = dir;
          }
        }
        return best;
      }
      if (forwardOk && rng.chance(0.8)) return t.dir;
      const back = reverse(t.dir);
      const pool = usable([back, ...sideSteps(t.dir)]);
      return pool.length > 0 ? rng.pick(pool) : rng.pick(valid);
    }

    case 'smarticus': {
      // Close: always home in. Mid: coin flip. Far: straight line.
      const chase = (): Vec => {
        // Homing may reverse; ties prefer the current heading.
        let best = valid[0]!;
        let bestScore = Infinity;
        for (const dir of valid) {
          const score =
            manhattan(advance(t, dir), ctx.muncher) + (sameVec(dir, t.dir) ? -0.25 : 0);
          if (score < bestScore) {
            bestScore = score;
            best = dir;
          }
        }
        return best;
      };
      if (distance <= CHASE_RADIUS) return chase();
      if (distance <= FAR_RADIUS && rng.chance(0.5)) return chase();
      if (forwardOk) return t.dir;
      return chase();
    }

    default:
      return forwardOk ? t.dir : rng.pick(valid);
  }
}

export function stepTroggle(t: Troggle, ctx: WalkContext, now = 0): Troggle {
  const next = chooseDirection(t, ctx);
  const target = advance(t, next);
  if (!isInside(target, ctx)) return { ...t };

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

/** Species whose passage changes the board underneath them. */
export const rerollsTiles = (species: TroggleSpecies): boolean => species === 'laborus';
export const erasesTiles = (species: TroggleSpecies): boolean => species === 'assistus';
