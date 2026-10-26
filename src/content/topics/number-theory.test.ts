import { describe, expect, it } from 'vitest';

import { makeRound } from '../build';
import { createRng } from '../rng';
import { BOARD_CELLS } from '../types';
import { numberTheoryTopics } from './number-theory';

const rounds = (topicId: string, levels = 20, seeds = 8) => {
  const topic = numberTheoryTopics.find((t) => t.id === topicId)!;
  const out: Array<{ round: ReturnType<typeof topic.round>; level: number }> = [];
  for (let level = 1; level <= levels; level++) {
    for (let seed = 1; seed <= seeds; seed++) {
      out.push({ round: topic.round(createRng(seed * 7919 + level), level), level });
    }
  }
  return out;
};

describe('makeRound', () => {
  const letters = (prefix: string, n: number): string[] =>
    Array.from({ length: n }, (_, i) => `${prefix}${i}`);

  it('fills 30 unique tiles and honours the requested correct count', () => {
    const round = makeRound({
      rng: createRng(4),
      heading: 'Test',
      instruction: 'Munch.',
      correct: letters('c', 8),
      incorrect: letters('d', 40),
      correctCount: 4,
      explain: () => 'nope',
    });
    expect(round.tiles).toHaveLength(BOARD_CELLS);
    expect(round.tiles.filter((t) => t.correct)).toHaveLength(4);
    expect(new Set(round.tiles.map((t) => t.text)).size).toBe(BOARD_CELLS);
  });

  it('throws instead of shipping duplicate tiles when a pool is starved', () => {
    expect(() =>
      makeRound({
        rng: createRng(1),
        heading: 'Broken',
        instruction: 'Munch.',
        correct: [],
        incorrect: ['1'],
        correctCount: 3,
        explain: () => '',
      }),
    ).toThrow(/no correct answers/);

    expect(() =>
      makeRound({
        rng: createRng(1),
        heading: 'Starved',
        instruction: 'Munch.',
        correct: letters('c', 6),
        incorrect: ['x', 'y'],
        correctCount: 3,
        explain: () => '',
      }),
    ).toThrow(/need 27 distractors/);
  });

  it('never lets a distractor duplicate a correct answer', () => {
    const round = makeRound({
      rng: createRng(11),
      heading: 'Overlap',
      instruction: 'Munch.',
      correct: ['1', '2', '3'],
      incorrect: ['1', '2', ...letters('d', 40)],
      correctCount: 2,
      explain: () => '',
    });
    const correct = new Set(round.tiles.filter((t) => t.correct).map((t) => t.text));
    expect(correct.size).toBe(2);
    for (const tile of round.tiles) {
      if (!tile.correct) expect(correct.has(tile.text)).toBe(false);
    }
  });
});

describe('number theory topics', () => {
  for (const topic of numberTheoryTopics) {
    describe(topic.id, () => {
      it('produces valid boards across levels', () => {
        for (const { round } of rounds(topic.id)) {
          expect(round.tiles).toHaveLength(BOARD_CELLS);
          expect(round.correctCount).toBe(round.tiles.filter((t) => t.correct).length);
          expect(round.correctCount).toBeGreaterThanOrEqual(8);
          expect(round.correctCount).toBeLessThanOrEqual(13);
          expect(new Set(round.tiles.map((t) => t.text)).size).toBe(BOARD_CELLS);
          expect(round.heading.length).toBeGreaterThan(0);
          expect(round.instruction).toMatch(/munch/i);
          for (const tile of round.tiles) {
            expect(tile.text.length).toBeLessThanOrEqual(6);
            const explanation = round.explain(tile.text);
            expect(typeof explanation).toBe('string');
            expect(explanation.length).toBeGreaterThan(0);
          }
        }
      });

      it('is deterministic for a seed but varies across seeds', () => {
        const a = topic.round(createRng(1234), 3);
        const b = topic.round(createRng(1234), 3);
        expect(a.tiles).toEqual(b.tiles);
        const signatures = new Set(
          Array.from({ length: 6 }, (_, i) =>
            topic.round(createRng(i + 1), 3).tiles.map((t) => t.text).join(','),
          ),
        );
        expect(signatures.size).toBeGreaterThan(1);
      });
    });
  }
});
