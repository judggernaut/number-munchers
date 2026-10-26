/**
 * Content model for Number Munchers.
 *
 * The whole curriculum is expressed as a list of `Topic`s. A topic is a pure
 * generator: given a seeded RNG and a level number it produces one `Round`,
 * which is the 6x5 grid of tiles plus the text that explains the goal.
 *
 * Keeping topics pure (no DOM, no React, no globals) means every generator is
 * unit-testable and the engine can schedule them without knowing what math
 * they contain.
 */

/** Coarse curriculum band. Used for menu grouping and default progression. */
export type Band = 'elementary' | 'middle' | 'high';

/** Subject family. Used for colour-coding and menu filters. */
export type Family =
  | 'number'
  | 'arithmetic'
  | 'algebra'
  | 'geometry'
  | 'trigonometry'
  | 'statistics'
  | 'precalculus';

export const BAND_LABELS: Record<Band, string> = {
  elementary: 'Grades 3-5',
  middle: 'Grades 6-8',
  high: 'Grades 9-12',
};

/** Deterministic PRNG surface handed to topic generators and the troggle AI. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform pick from a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates copy. The input is never mutated. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability p. */
  chance(p: number): boolean;
}

export const BOARD_COLS = 6;
export const BOARD_ROWS = 5;
export const BOARD_CELLS = BOARD_COLS * BOARD_ROWS;

/** Function families a graph tile can depict. */
export type PlotFamily =
  | 'linear'
  | 'quadratic'
  | 'cubic'
  | 'exponential'
  | 'logarithmic'
  | 'reciprocal'
  | 'sqrt'
  | 'absolute'
  | 'sine';

/** A small function plot drawn inside a cell instead of text. */
export interface PlotSpec {
  kind: 'plot';
  family: PlotFamily;
  /** Solid curve, evaluated in math units. `null` means "not defined here". */
  f(x: number): number | null;
  xRange: [number, number];
  yRange: [number, number];
  /** Optional dashed guide, e.g. an asymptote at y = 0. */
  asymptoteY?: number;
}

export type ShapeName =
  | 'circle'
  | 'square'
  | 'rectangle'
  | 'triangle'
  | 'right-triangle'
  | 'pentagon'
  | 'hexagon'
  | 'trapezoid'
  | 'parallelogram'
  | 'cube'
  | 'prism'
  | 'triangular-prism'
  | 'pyramid'
  | 'cylinder'
  | 'cone'
  | 'sphere';

/** Extra geometry for a drawn triangle: real angles drive the drawing. */
export interface TriangleSpec {
  /** Interior angles in degrees, summing to 180. */
  angles: [number, number, number];
  /** Indices of sides that carry an equality tick mark (side i is opposite vertex i). */
  marks?: number[];
}

/** A geometric figure drawn inside a cell. */
export interface ShapeSpec {
  kind: 'shape';
  shape: ShapeName;
  dimension: 2 | 3;
  /** Present when `shape` is a triangle; angles define the actual shape. */
  triangle?: TriangleSpec;
}

/** Anything a tile can draw instead of its text. */
export type TileVisual = PlotSpec | ShapeSpec;

/** One edible cell. `correct` means "the muncher should eat this". */
export interface Tile {
  /** Stable identifier. Rendered only when there is no `visual`. */
  text: string;
  correct: boolean;
  /** When present the renderer draws this instead of `text`. */
  visual?: TileVisual;
}

export interface Round {
  /** Short label under the level header, e.g. "Factors of 36". */
  heading: string;
  /** Imperative goal statement, e.g. "Munch every factor of 36." */
  instruction: string;
  /** Exactly BOARD_CELLS tiles. */
  tiles: Tile[];
  /** How many tiles are correct. Always >= 1 and < BOARD_CELLS. */
  correctCount: number;
  /** Explains why a munched tile was wrong, given its text. */
  explain(text: string): string;
}

/** A worked example for the in-game lesson page. */
export interface LessonExample {
  /** The prompt the player would see, e.g. "Munch every factor of 36." */
  prompt: string;
  /** A tile that satisfies it. */
  answer: string;
  /** Why that answer is right, in one or two short sentences. */
  why: string;
}

/** Everything the "Learn" page shows for one topic. */
export interface Lesson {
  /** What the topic is about, 1-3 short sentences. */
  summary: string;
  /** 2-4 ordered how-to steps. */
  steps: string[];
  example: LessonExample;
  tip?: string;
}

export interface Topic {
  /** Stable kebab-case id, persisted in save data. */
  id: string;
  /** Menu label, e.g. "Prime Numbers". */
  name: string;
  family: Family;
  band: Band;
  /** Human-readable grade span, e.g. "Grades 6-8". */
  grades: string;
  /** One line shown in the topic picker. */
  blurb: string;
  /**
   * Produce one round. `level` is 1-based and lets a topic widen its number
   * ranges or add steps as the player progresses.
   */
  round(rng: Rng, level: number): Round;
}
