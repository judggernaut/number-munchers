import { describe, expect, it } from 'vitest';
import { statisticsTopics } from './statistics';
import { createRng } from '../rng';
import { ASCII_ONLY, close, evalArith } from './test-utils';

const samples = (topicIndex: number) => {
  const topic = statisticsTopics[topicIndex]!;
  const rounds = [];
  for (const level of [1, 7, 14, 20]) {
    for (let seed = 0; seed < 5; seed++) {
      rounds.push({ level, seed, round: topic.round(createRng(seed * 101 + level), level) });
    }
  }
  return rounds;
};

const allRounds = (topicIndex: number) => {
  const topic = statisticsTopics[topicIndex]!;
  const rounds = [];
  for (let level = 1; level <= 20; level++) {
    for (let seed = 0; seed < 20; seed++) {
      rounds.push({ level, seed, round: topic.round(createRng(seed * 7919 + level * 31), level) });
    }
  }
  return rounds;
};

const dataFrom = (heading: string): number[] => {
  const m = /^Data: (.+)$/.exec(heading);
  expect(m, heading).not.toBeNull();
  return m![1]!.split(',').map(Number);
};

const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;

const median = (values: number[]): number => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const mode = (values: number[]): number => {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0]!;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
};

const perm = (n: number, r: number): number => {
  let out = 1;
  for (let i = 0; i < r; i++) out *= n - i;
  return out;
};

const comb = (n: number, r: number): number => perm(n, r) / perm(r, r);

const percentFromTile = (text: string): number | null => {
  if (text.endsWith('%')) {
    const n = Number(text.slice(0, -1));
    return Number.isFinite(n) ? n : null;
  }
  return evalArith(text);
};

const percentMatches = (text: string, expected: number): boolean => {
  const raw = percentFromTile(text);
  if (raw === null) return false;
  return close(raw, expected, 1e-8) || close(raw * 100, expected, 1e-8);
};

for (const topic of statisticsTopics) {
  describe(topic.id, () => {
    it('is deterministic for a fixed seed', () => {
      const a = topic.round(createRng(2468), 9);
      const b = topic.round(createRng(2468), 9);
      expect(a.heading).toBe(b.heading);
      expect(a.instruction).toBe(b.instruction);
      expect(a.correctCount).toBe(b.correctCount);
      expect(a.tiles).toEqual(b.tiles);
      for (const tile of a.tiles) expect(a.explain(tile.text)).toBe(b.explain(tile.text));
    });

    it('always produces a valid 30-tile board', () => {
      for (const { level, seed, round } of samples(statisticsTopics.indexOf(topic))) {
        const texts = round.tiles.map((t) => t.text);
        expect(round.tiles, `${topic.id} L${level} S${seed}`).toHaveLength(30);
        expect(round.tiles.filter((t) => t.correct)).toHaveLength(round.correctCount);
        expect(round.correctCount).toBeGreaterThanOrEqual(8);
        expect(round.correctCount).toBeLessThanOrEqual(12);
        expect(new Set(texts).size).toBe(30);
        expect(round.heading.length).toBeGreaterThan(0);
        expect(round.instruction.length).toBeGreaterThan(0);
        for (const text of texts) {
          expect(text.length).toBeLessThanOrEqual(9);
          expect(text).toMatch(ASCII_ONLY);
          expect(round.explain(text).length).toBeGreaterThan(0);
        }
      }
    });

    it('never throws over 20 levels and 20 seeds', () => {
      for (let level = 1; level <= 20; level++) {
        for (let seed = 0; seed < 20; seed++) {
          expect(() => topic.round(createRng(seed * 7919 + level * 31), level)).not.toThrow();
        }
      }
    });
  });
}

describe('statistics independent checks', () => {
  it('central-tendency: recomputes the requested statistic from the data', () => {
    for (const { round } of allRounds(0)) {
      const values = dataFrom(round.heading);
      const which = /equal to the (mean|median|mode)/.exec(round.instruction)?.[1];
      expect(which, round.instruction).toBeDefined();
      const expected = which === 'mean' ? mean(values) : which === 'median' ? median(values) : mode(values);
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${round.instruction} ${tile.text}`).toBe(close(value!, expected));
      }
    }
  });

  it('probability: recomputes the favourable-over-total ratio', () => {
    for (const { round } of allRounds(1)) {
      let expected = Number.NaN;
      const die = /^Die: P\((.+)\)$/.exec(round.heading);
      const coins = /^2 coins: P\((.+)\)$/.exec(round.heading);
      const bag = /^Bag: (\d+)R,(\d+)B: P\((red|blue)\)$/.exec(round.heading);
      const dice = /^2 dice: P\((.+)\)$/.exec(round.heading);
      if (die) {
        const table: Record<string, number> = { even: 3 / 6, '>4': 2 / 6, prime: 3 / 6, '<3': 2 / 6, 'not 6': 5 / 6, '3': 1 / 6 };
        expected = table[die[1]!]!;
      } else if (coins) {
        const table: Record<string, number> = { '2 heads': 1 / 4, '1 head': 2 / 4, 'at least 1 head': 3 / 4 };
        expected = table[coins[1]!]!;
      } else if (bag) {
        const red = Number(bag[1]);
        const blue = Number(bag[2]);
        expected = (bag[3] === 'red' ? red : blue) / (red + blue);
      } else {
        expect(dice).not.toBeNull();
        const table: Record<string, number> = {
          'sum 7': 6 / 36, 'sum 12': 1 / 36, doubles: 6 / 36, 'sum>9': 6 / 36, 'sum 5': 4 / 36,
        };
        expected = table[dice![1]!]!;
      }
      expect(Number.isFinite(expected), round.heading).toBe(true);
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected));
      }
    }
  });

  it('counting: recomputes nPr and nCr', () => {
    for (const { round } of allRounds(2)) {
      const m = /^(Permutation|Combination) (\d+)([PC])(\d+)$/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const n = Number(m![2]);
      const r = Number(m![4]);
      expect(m![3]).toBe(m![1] === 'Permutation' ? 'P' : 'C');
      const expected = m![1] === 'Permutation' ? perm(n, r) : comb(n, r);
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected));
      }
    }
  });

  it('percent-change: recomputes the percent increase or decrease', () => {
    for (const { round } of allRounds(3)) {
      const m = /^(\d+) to (\d+): change %$/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const oldValue = Number(m![1]);
      const newValue = Number(m![2]);
      const expected = ((newValue - oldValue) / oldValue) * 100;
      for (const tile of round.tiles) {
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(percentMatches(tile.text, expected));
      }
    }
  });

  it('spread: recomputes range, IQR and population SD', () => {
    for (const { round } of allRounds(4)) {
      const values = dataFrom(round.heading);
      const sorted = values.slice().sort((a, b) => a - b);
      let expected: number;
      if (round.instruction.includes('range') && !round.instruction.includes('interquartile')) {
        expected = sorted[sorted.length - 1]! - sorted[0]!;
      } else if (round.instruction.includes('interquartile')) {
        const q1 = sorted[1]!;
        const q3 = sorted[3]!;
        expected = q3 - q1;
      } else {
        const avg = mean(values);
        const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
        expected = Math.round(Math.sqrt(variance) * 10) / 10;
      }
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${round.instruction} ${tile.text}`).toBe(close(value!, expected));
      }
    }
  });

  it('unit-rates: recomputes numerator / denominator', () => {
    for (const { round } of allRounds(5)) {
      const m = /^Rate: ([\d.]+) [A-Za-z]+ \/ \$?([\d.]+)/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const expected = Number(m![1]) / Number(m![2]);
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected));
      }
    }
  });
});
