import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { BOARD_CELLS, type Round, type Topic } from '../types';
import { arithmeticTopics } from './arithmetic';

const EXPECTED_IDS = [
  'equality',
  'inequality',
  'place-value',
  'rounding',
  'fractions',
  'decimals',
  'percents',
  'integers',
  'order-of-operations',
  'exponents',
];

/** Number topics get 7 characters, expression topics get 9. */
const TILE_LIMITS: Record<string, number> = {
  equality: 9,
  inequality: 9,
  'place-value': 7,
  rounding: 7,
  fractions: 7,
  decimals: 7,
  percents: 7,
  integers: 9,
  'order-of-operations': 9,
  exponents: 9,
};

const validate = (round: Round, topic: Topic): void => {
  expect(round.tiles).toHaveLength(BOARD_CELLS);

  const texts = round.tiles.map((tile) => tile.text);
  expect(new Set(texts).size).toBe(BOARD_CELLS);

  const correctTiles = round.tiles.filter((tile) => tile.correct);
  expect(round.correctCount).toBe(correctTiles.length);
  expect(round.correctCount).toBeGreaterThanOrEqual(8);
  expect(round.correctCount).toBeLessThanOrEqual(12);

  expect(round.heading.trim().length).toBeGreaterThan(0);
  expect(round.instruction.trim().length).toBeGreaterThan(0);
  expect(round.instruction.toLowerCase()).toContain('munch');

  const limit = TILE_LIMITS[topic.id];
  expect(limit).toBeTypeOf('number');

  for (const tile of round.tiles) {
    expect(tile.text.length).toBeGreaterThan(0);
    expect(tile.text.length).toBeLessThanOrEqual(limit ?? 9);
    expect(tile.text).toMatch(/^[\x20-\x7e]+$/);

    const explanation = round.explain(tile.text);
    expect(typeof explanation).toBe('string');
    expect(explanation.trim().length).toBeGreaterThan(0);
  }

  // Explain both outcomes explicitly, even if a random board happened to
  // contain only one kind of tile.
  expect(round.explain(correctTiles[0]?.text ?? '')).not.toBe('');
  const wrong = round.tiles.find((tile) => !tile.correct);
  if (wrong) expect(round.explain(wrong.text)).not.toBe('');
};

describe('arithmetic topics', () => {
  it('exports the expected topics in order', () => {
    expect(arithmeticTopics.map((topic) => topic.id)).toEqual(EXPECTED_IDS);
  });

  for (const topic of arithmeticTopics) {
    describe(topic.id, () => {
      it('is deterministic for a fixed seed', () => {
        const first = topic.round(createRng(0xc0ffee), 7);
        const second = topic.round(createRng(0xc0ffee), 7);

        expect(second.heading).toBe(first.heading);
        expect(second.instruction).toBe(first.instruction);
        expect(second.correctCount).toBe(first.correctCount);
        expect(second.tiles).toEqual(first.tiles);
        for (const tile of first.tiles) {
          expect(second.explain(tile.text)).toBe(first.explain(tile.text));
        }
      });

      it(
        'builds valid boards across 20 levels',
        () => {
          for (let level = 1; level <= 20; level++) {
            validate(topic.round(createRng(1000 + level * 37), level), topic);
          }
        },
        20000,
      );

      it(
        'never throws across 20 seeds and 20 levels',
        () => {
          for (let seed = 0; seed < 20; seed++) {
            for (let level = 1; level <= 20; level++) {
              const round = topic.round(createRng(seed * 131 + level), level);
              expect(round.tiles).toHaveLength(BOARD_CELLS);
              expect(round.correctCount).toBeGreaterThanOrEqual(8);
              expect(round.correctCount).toBeLessThanOrEqual(12);
            }
          }
        },
        30000,
      );
    });
  }

  it(
    'place-value: "worth" means digit x place value',
    () => {
      const topic = arithmeticTopics.find((item) => item.id === 'place-value');
      expect(topic).toBeDefined();
      for (let level = 1; level <= 20; level++) {
        for (let seed = 0; seed < 20; seed++) {
          const round = topic!.round(createRng(seed * 131 + level), level);
          const match = round.heading.match(/^The (\d) is worth (\d+)$/);
          expect(match).not.toBeNull();
          const digit = Number(match![1]);
          const worth = Number(match![2]);
          for (const tile of round.tiles) {
            let matches = false;
            for (let i = 0; i < tile.text.length; i++) {
              const candidate = Number(tile.text[tile.text.length - 1 - i]);
              if (candidate === digit && digit * 10 ** i === worth) matches = true;
            }
            expect(tile.correct).toBe(matches);
          }
        }
      }
    },
    20000,
  );

  it('clamps out-of-range levels instead of throwing', () => {
    for (const topic of arithmeticTopics) {
      for (const level of [0, -4, 21, 40, 100]) {
        const round = topic.round(createRng(level + 7), level);
        expect(round.tiles).toHaveLength(BOARD_CELLS);
        expect(round.correctCount).toBeGreaterThanOrEqual(8);
        expect(round.correctCount).toBeLessThanOrEqual(12);
        expect(round.instruction.toLowerCase()).toContain('munch');
      }
    }
  });
});
