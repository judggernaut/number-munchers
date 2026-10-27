import { describe, expect, it } from 'vitest';
import { trigonometryTopics } from './trigonometry';
import { createRng } from '../rng';
import {
  ASCII_ONLY,
  close,
  evalArith,
  evalIdentity,
  isUndefinedTile,
} from './test-utils';

const samples = (topicIndex: number) => {
  const topic = trigonometryTopics[topicIndex]!;
  const rounds = [];
  for (const level of [1, 7, 14, 20]) {
    for (let seed = 0; seed < 5; seed++) {
      rounds.push({ level, seed, round: topic.round(createRng(seed * 101 + level), level) });
    }
  }
  return rounds;
};

const allRounds = (topicIndex: number) => {
  const topic = trigonometryTopics[topicIndex]!;
  const rounds = [];
  for (let level = 1; level <= 20; level++) {
    for (let seed = 0; seed < 20; seed++) {
      rounds.push({ level, seed, round: topic.round(createRng(seed * 7919 + level * 31), level) });
    }
  }
  return rounds;
};

const parseFraction = (text: string): [number, number] => {
  const m = /^(\d+)\/(\d+)$/.exec(text);
  expect(m, text).not.toBeNull();
  return [Number(m![1]), Number(m![2])];
};

const degreesFromTile = (text: string): number | null => {
  const raw = text.replace(/deg|rad/g, '');
  const value = evalArith(raw, {}, Math.PI);
  if (value === null) return null;
  return /pi/.test(text) ? (value * 180) / Math.PI : value;
};

for (const topic of trigonometryTopics) {
  describe(topic.id, () => {
    it('is deterministic for a fixed seed', () => {
      const a = topic.round(createRng(9876), 8);
      const b = topic.round(createRng(9876), 8);
      expect(a.heading).toBe(b.heading);
      expect(a.instruction).toBe(b.instruction);
      expect(a.correctCount).toBe(b.correctCount);
      expect(a.tiles).toEqual(b.tiles);
      for (const tile of a.tiles) expect(a.explain(tile.text)).toBe(b.explain(tile.text));
    });

    it('always produces a valid 30-tile board', () => {
      for (const { level, seed, round } of samples(trigonometryTopics.indexOf(topic))) {
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

describe('trigonometry independent checks', () => {
  it('trig-ratios: every correct fraction matches the triangle ratio', () => {
    for (const { round } of allRounds(0)) {
      const m = /^Sides (\d+)-(\d+)-(\d+): (sin|cos|tan) A$/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const [a, b, c] = [Number(m![1]), Number(m![2]), Number(m![3])];
      const fn = m![4];
      const [num, den] = fn === 'sin' ? [a, c] : fn === 'cos' ? [b, c] : [a, b];
      for (const tile of round.tiles) {
        const [n, d] = parseFraction(tile.text);
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(n * den === d * num);
      }
    }
  });

  it('special-angles: every tile evaluates to the exact trigonometric value', () => {
    for (const { round } of allRounds(1)) {
      const m = /^(sin|cos|tan) (\d+) deg$/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const fn = m![1] as 'sin' | 'cos' | 'tan';
      const angle = Number(m![2]);
      const undefinedValue = fn === 'tan' && (angle === 90 || angle === 270);
      const expected = undefinedValue ? null : Math[fn]((angle * Math.PI) / 180);
      for (const tile of round.tiles) {
        if (undefinedValue) {
          expect(tile.correct, tile.text).toBe(isUndefinedTile(tile.text));
        } else if (isUndefinedTile(tile.text)) {
          expect(tile.correct, `${round.heading} ${tile.text}`).toBe(false);
        } else {
          const value = evalArith(tile.text);
          expect(value, tile.text).not.toBeNull();
          expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected!, 1e-8));
        }
      }
    }
  });

  it('trig-identities: tiles agree with the target at three sample angles', () => {
    for (const { round } of allRounds(2)) {
      const target = round.heading.replace('Identity ', '');
      const xs = [0.7, 1.3, 2.1];
      const expected = xs.map((x) => evalIdentity(target, x));
      expect(expected.every((v) => v !== null)).toBe(true);
      for (const tile of round.tiles) {
        const values = xs.map((x) => evalIdentity(tile.text, x));
        expect(values.every((v) => v !== null), `${target} ${tile.text}`).toBe(true);
        const matches = values.every((v, i) => close(v!, expected[i]!, 1e-8));
        expect(tile.correct, `${target} ${tile.text}`).toBe(matches);
      }
    }
  });

  it('radians-degrees: every tile has the same angle measure', () => {
    for (const { round } of allRounds(3)) {
      const m = /^(.+) (deg|rad) in (degrees|radians)$/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const expected = m![2] === 'deg'
        ? Number(m![1])
        : ((evalArith(m![1]!, {}, Math.PI) ?? Number.NaN) * 180) / Math.PI;
      for (const tile of round.tiles) {
        const value = degreesFromTile(tile.text);
        expect(value, `${round.heading} ${tile.text}`).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected, 1e-7));
      }
    }
  });
});
