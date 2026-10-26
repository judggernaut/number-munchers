import type { Rng } from '../content/types';
import type { TroggleSpecies } from './troggle';

/**
 * Two complete rulesets.
 *
 * `modern` is tuned for playing today. `original` reproduces the values
 * recovered from NM.EXE (see docs/re/original-analysis.md): a slow 10.3 s
 * troggle tick at level 1 dropping to 1.03 s, four lives, the per-level point
 * table, three-level interludes and tile churn.
 */
export type RulesetId = 'modern' | 'original';

export interface SpeciesLock {
  species: TroggleSpecies;
  fromLevel: number;
  weight: number;
}

export interface RuleSet {
  id: RulesetId;
  label: string;
  startingLives: number;
  /** Points for a correct munch at this level. */
  pointsForLevel(level: number): number;
  /** Base milliseconds between troggle steps. */
  troggleTickMs(level: number): number;
  /** Extra random delay added to each tick (0 disables). */
  tickJitterMs: number;
  muncherStepMs(level: number): number;
  maxTroggles(level: number): number;
  /** Troggles present when the level starts. */
  initialTroggles(level: number): number;
  /** Probability per tick of an extra spawn during play. */
  spawnChance(level: number): number;
  speciesForLevel(level: number): SpeciesLock[];
  levelsPerInterlude: number;
  /** Troggles re-roll/erase the tiles they leave. */
  tileChurn: boolean;
  /** Award an extra life every N points; 0 disables. */
  extraLifeEvery: number;
}

const MODERN_SPECIES: SpeciesLock[] = [
  { species: 'normalus', fromLevel: 1, weight: 4 },
  { species: 'laborus', fromLevel: 2, weight: 3 },
  { species: 'assistus', fromLevel: 3, weight: 2 },
  { species: 'timidus', fromLevel: 4, weight: 2 },
  { species: 'smarticus', fromLevel: 6, weight: 2 },
];

/** labourus appears at level 4, smarticus at level 5 (RE). */
const ORIGINAL_SPECIES: SpeciesLock[] = [
  { species: 'normalus', fromLevel: 1, weight: 4 },
  { species: 'timidus', fromLevel: 2, weight: 2 },
  { species: 'assistus', fromLevel: 3, weight: 2 },
  { species: 'laborus', fromLevel: 4, weight: 3 },
  { species: 'smarticus', fromLevel: 5, weight: 2 },
];

/** RE: correct munch is 5,5,5,10,15...70 for levels 1-16, then 75. */
const ORIGINAL_POINTS = [5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];

/** RE: 300,300,270,270,240,210,180,150,120,90,60,30 timer units. */
const ORIGINAL_TICKS_MS = [10300, 10300, 9270, 9270, 8240, 7210, 6180, 5150, 4120, 3090, 2060, 1030];

/** RE: 1,1,1,2,2,2,2,3,3,3,3,3 troggles on screen from level 1. */
const ORIGINAL_TROGGLES = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3];

const table = (values: number[], level: number): number =>
  values[Math.min(values.length - 1, Math.max(0, level - 1))]!;

export const RULESETS: Record<RulesetId, RuleSet> = {
  modern: {
    id: 'modern',
    label: 'Modern',
    startingLives: 3,
    pointsForLevel: () => 5,
    troggleTickMs: (level) => Math.max(260, 1200 - (level - 1) * 70),
    tickJitterMs: 0,
    muncherStepMs: () => 105,
    maxTroggles: (level) => Math.min(4, 1 + Math.floor((level - 1) / 2)),
    initialTroggles: () => 0,
    spawnChance: (level) => Math.min(0.45, 0.12 + (level - 1) * 0.02),
    speciesForLevel: (level) => MODERN_SPECIES.filter((entry) => level >= entry.fromLevel),
    levelsPerInterlude: 4,
    tileChurn: false,
    extraLifeEvery: 0,
  },
  original: {
    id: 'original',
    label: 'Classic',
    startingLives: 4,
    // Levels 1-16 use the table; beyond that it stays at 75 (RE).
    pointsForLevel: (level) => (level > ORIGINAL_POINTS.length ? 75 : table(ORIGINAL_POINTS, level)),
    troggleTickMs: (level) => table(ORIGINAL_TICKS_MS, level),
    tickJitterMs: 3050,
    muncherStepMs: () => 240,
    maxTroggles: (level) => Math.min(3, table(ORIGINAL_TROGGLES, level)),
    initialTroggles: (level) => table(ORIGINAL_TROGGLES, level),
    spawnChance: () => 0,
    speciesForLevel: (level) => ORIGINAL_SPECIES.filter((entry) => level >= entry.fromLevel),
    levelsPerInterlude: 3,
    tileChurn: true,
    extraLifeEvery: 10000,
  },
};

export const RULES = RULESETS.modern;

export function rulesetFor(id: RulesetId): RuleSet {
  return RULESETS[id] ?? RULESETS.modern;
}

export type DifficultyId = 'chill' | 'normal' | 'fast';

export const DIFFICULTY_LABELS: Record<DifficultyId, string> = {
  chill: 'Chill',
  normal: 'Normal',
  fast: 'Fast',
};

export const DIFFICULTY_SPEED: Record<DifficultyId, number> = {
  chill: 1.35,
  normal: 1,
  fast: 0.75,
};

export function tickMsFor(rules: RuleSet, level: number, difficulty: DifficultyId): number {
  return Math.max(140, Math.round(rules.troggleTickMs(level) * DIFFICULTY_SPEED[difficulty]));
}

/** Weighted species pick for a level. */
export function pickSpecies(schedule: SpeciesLock[], rng: Rng): TroggleSpecies {
  const total = schedule.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * total;
  for (const entry of schedule) {
    roll -= entry.weight;
    if (roll <= 0) return entry.species;
  }
  return schedule[schedule.length - 1]!.species;
}
