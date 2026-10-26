import { BOARD_CELLS, type Round, type Rng, type Tile, type TileVisual } from './types';

export interface RoundSpec {
  rng: Rng;
  heading: string;
  instruction: string;
  /** Candidate answers that the muncher SHOULD eat. Provide more than needed. */
  correct: readonly string[];
  /** Candidate answers that the muncher should NOT eat. Provide more than needed. */
  incorrect: readonly string[];
  correctCount: number;
  /** Explains a wrong munch. Receives the tile text that was eaten. */
  explain(text: string): string;
  /** Visuals keyed by tile id, for boards drawn as graphs or shapes. */
  visuals?: Record<string, TileVisual>;
  /**
   * When true (default) a starved pool throws instead of recycling duplicates,
   * so bad content is caught by tests rather than shipped.
   */
  strict?: boolean;
}

/**
 * Assemble a validated 6x5 board.
 *
 * Sampling is without replacement and duplicates are dropped, so generators
 * that want a full board must hand over enough distinct material. We fall back
 * to recycling only when a generator is starved, so a bad pool degrades
 * gracefully instead of throwing mid-game.
 */
export function makeRound(spec: RoundSpec): Round {
  const { rng } = spec;
  const correctPool = unique(spec.correct);
  const incorrectPool = unique(spec.incorrect).filter((t) => !correctPool.includes(t));

  if (correctPool.length === 0) {
    throw new Error(`makeRound(${spec.heading}): no correct answers supplied`);
  }
  if (incorrectPool.length === 0) {
    throw new Error(`makeRound(${spec.heading}): no distractors supplied`);
  }

  const wanted = Math.min(Math.max(1, spec.correctCount), BOARD_CELLS - 1);
  const distractorsNeeded = BOARD_CELLS - wanted;
  const strict = spec.strict ?? true;

  if (strict && correctPool.length < wanted) {
    throw new Error(
      `makeRound(${spec.heading}): need ${wanted} correct answers, only ${correctPool.length} distinct supplied`,
    );
  }
  if (strict && incorrectPool.length < distractorsNeeded) {
    throw new Error(
      `makeRound(${spec.heading}): need ${distractorsNeeded} distractors, only ${incorrectPool.length} distinct supplied`,
    );
  }

  const effectiveWanted = Math.min(wanted, correctPool.length);
  const pickedCorrect = shuffleTake(rng, correctPool, effectiveWanted);
  const pickedIncorrect = shuffleTake(rng, incorrectPool, BOARD_CELLS - effectiveWanted);

  const attach = (tile: Tile): Tile => {
    const visual = spec.visuals?.[tile.text];
    return visual ? { ...tile, visual } : tile;
  };
  const tiles: Tile[] = [
    ...pickedCorrect.map((text) => attach({ text, correct: true })),
    ...pickedIncorrect.map((text) => attach({ text, correct: false })),
  ];

  return {
    heading: spec.heading,
    instruction: spec.instruction,
    tiles: rng.shuffle(tiles),
    correctCount: effectiveWanted,
    explain: spec.explain,
  };
}

function unique(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function shuffleTake(rng: Rng, pool: readonly string[], count: number): string[] {
  if (pool.length >= count) {
    return rng.shuffle(pool).slice(0, count);
  }
  // Starved pool: recycle in shuffled passes so the board still fills.
  const out: string[] = [];
  while (out.length < count) {
    const pass = rng.shuffle(pool);
    for (const item of pass) {
      if (out.length >= count) break;
      out.push(item);
    }
  }
  return out;
}

/** Shared helper: pick `count` distinct values from a numeric range. */
export function distinctInts(rng: Rng, count: number, min: number, max: number): number[] {
  const span = max - min + 1;
  if (span <= count) {
    return Array.from({ length: span }, (_, i) => min + i);
  }
  const seen = new Set<number>();
  while (seen.size < count) seen.add(rng.int(min, max));
  return [...seen];
}
