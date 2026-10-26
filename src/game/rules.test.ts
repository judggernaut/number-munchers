import { describe, expect, it } from 'vitest';

import { RULESETS, tickMsFor } from './rules';

describe('rulesets', () => {
  it('classic scores follow the original table', () => {
    const classic = RULESETS.original;
    expect(classic.pointsForLevel(1)).toBe(5);
    expect(classic.pointsForLevel(3)).toBe(5);
    expect(classic.pointsForLevel(4)).toBe(10);
    expect(classic.pointsForLevel(16)).toBe(70);
    // The table tops out and stays there.
    expect(classic.pointsForLevel(20)).toBe(75);
    expect(classic.pointsForLevel(99)).toBe(75);
  });

  it('classic has four lives, modern has three', () => {
    expect(RULESETS.original.startingLives).toBe(4);
    expect(RULESETS.modern.startingLives).toBe(3);
  });

  it('classic ticks start slow and get faster, then floor', () => {
    const classic = RULESETS.original;
    expect(classic.troggleTickMs(1)).toBeGreaterThan(9000);
    expect(classic.troggleTickMs(12)).toBeLessThan(1500);
    for (let level = 2; level <= 12; level++) {
      expect(classic.troggleTickMs(level)).toBeLessThanOrEqual(classic.troggleTickMs(level - 1));
    }
    expect(classic.troggleTickMs(30)).toBe(classic.troggleTickMs(12));
  });

  it('classic cuts to an interlude every three levels', () => {
    expect(RULESETS.original.levelsPerInterlude).toBe(3);
    expect(RULESETS.modern.levelsPerInterlude).toBe(4);
  });

  it('classic starts with troggles on the board and no random spawns', () => {
    const classic = RULESETS.original;
    expect(classic.initialTroggles(1)).toBe(1);
    expect(classic.initialTroggles(8)).toBe(3);
    expect(classic.maxTroggles(99)).toBe(3);
    expect(classic.spawnChance(5)).toBe(0);
  });

  it('modern keeps its tuned pacing', () => {
    expect(RULESETS.modern.troggleTickMs(1)).toBe(1200);
    expect(RULESETS.modern.troggleTickMs(20)).toBe(260);
    expect(RULESETS.modern.initialTroggles(1)).toBe(0);
  });

  it('difficulty multiplies the tick', () => {
    const rules = RULESETS.modern;
    expect(tickMsFor(rules, 1, 'chill')).toBeGreaterThan(tickMsFor(rules, 1, 'normal'));
    expect(tickMsFor(rules, 1, 'fast')).toBeLessThan(tickMsFor(rules, 1, 'normal'));
    expect(tickMsFor(rules, 50, 'fast')).toBeGreaterThanOrEqual(140);
  });

  it('classic unlocks species on the levels the binary does', () => {
    const at = (level: number) => RULESETS.original.speciesForLevel(level).map((s) => s.species);
    expect(at(1)).toContain('normalus');
    expect(at(3)).not.toContain('laborus');
    expect(at(4)).toContain('laborus');
    expect(at(4)).not.toContain('smarticus');
    expect(at(5)).toContain('smarticus');
  });
});
