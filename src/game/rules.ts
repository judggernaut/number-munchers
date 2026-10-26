/**
 * Tunable game rules.
 *
 * Values marked RE are grounded in static analysis of the original NM.EXE and
 * are documented in docs/re/original-analysis.md. Values marked "design" are
 * deliberate modern choices where the original had no direct equivalent.
 */
import type { Rng } from '../content/types';
import type { TroggleSpecies } from './troggle';

export interface SpeciesLock {
  species: TroggleSpecies;
  fromLevel: number;
  weight: number;
}

export interface RuleSet {
  startingLives: number;
  pointsPerMunch: number;
  livesPerLevelUp: number;
  /** Milliseconds between troggle steps. */
  troggleTickMs(level: number): number;
  /** Milliseconds between muncher cell steps while a direction is held. */
  muncherStepMs(level: number): number;
  /** How many troggles may be alive at once. */
  maxTroggles(level: number): number;
  /** Probability per troggle tick that a new troggle enters. */
  spawnChance(level: number): number;
  /** Which species can appear at a given level, with relative weights. */
  speciesForLevel(level: number): SpeciesLock[];
  levelsPerInterlude: number;
}

/** Species unlock schedule: early levels stay readable, later ones get spicy. */
export const SPECIES_SCHEDULE: SpeciesLock[] = [
  { species: 'reggie', fromLevel: 1, weight: 4 },
  { species: 'worker', fromLevel: 2, weight: 3 },
  { species: 'helper', fromLevel: 3, weight: 2 },
  { species: 'bashful', fromLevel: 4, weight: 2 },
  { species: 'smarty', fromLevel: 6, weight: 2 },
];

export const RULES: RuleSet = {
  startingLives: 3,
  pointsPerMunch: 5,
  livesPerLevelUp: 0,
  troggleTickMs: (level) => Math.max(260, 1200 - (level - 1) * 70),
  muncherStepMs: () => 105,
  maxTroggles: (level) => Math.min(4, 1 + Math.floor((level - 1) / 2)),
  spawnChance: (level) => Math.min(0.45, 0.12 + (level - 1) * 0.02),
  speciesForLevel: (level) => SPECIES_SCHEDULE.filter((entry) => level >= entry.fromLevel),
  levelsPerInterlude: 4,
};

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
  return Math.round(rules.troggleTickMs(level) * DIFFICULTY_SPEED[difficulty]);
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
