import { describe, expect, it } from 'vitest';

import { createRng } from '../rng';
import { ALL_TOPICS, BANDS, FAMILY_LABELS, findTopic, orderedTopics, topicsForBand } from '../registry';
import { BOARD_CELLS, type Round } from '../types';

const ASCII = /^[\x20-\x7e]+$/;

/**
 * Comparable signature for a round. Visual tiles hold closures, so we sample
 * their plots instead of comparing function identity.
 */
const roundSignature = (round: Round): string =>
  round.tiles
    .map((tile) => {
      if (tile.visual?.kind === 'plot') {
        const spec = tile.visual;
        const samples = [-1, 0, 1]
          .map((x) => {
            const y = spec.f(x);
            return y === null || !Number.isFinite(y) ? 'x' : y.toFixed(3);
          })
          .join('/');
        return `${spec.family}:${samples}`;
      }
      if (tile.visual?.kind === 'shape') {
        const tri = tile.visual.triangle;
        return tri
          ? `shape:${tile.visual.shape}:${tri.angles.join('/')}:${(tri.marks ?? []).join('')}`
          : `shape:${tile.visual.shape}`;
      }
      return tile.text;
    })
    .join('|');

describe('topic registry', () => {
  it('has unique ids and names', () => {
    const ids = ALL_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = ALL_TOPICS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers every band and family with a usable amount of content', () => {
    for (const band of BANDS) {
      expect(topicsForBand(band).length).toBeGreaterThanOrEqual(6);
    }
    const families = new Set(ALL_TOPICS.map((t) => t.family));
    for (const family of families) expect(FAMILY_LABELS[family]).toBeTruthy();
    expect(families.has('algebra')).toBe(true);
    expect(families.has('geometry')).toBe(true);
    expect(families.has('trigonometry')).toBe(true);
  });

  it('resolves topics by id', () => {
    for (const topic of ALL_TOPICS) expect(findTopic(topic.id)).toBe(topic);
    expect(findTopic('does-not-exist')).toBeUndefined();
  });

  it('orders each band by grade', () => {
    for (const band of BANDS) {
      const list = orderedTopics(band);
      const grades = list.map((t) => Number(t.grades.match(/\d+/)?.[0] ?? 99));
      expect(grades).toEqual([...grades].sort((a, b) => a - b));
    }
  });
});

describe('every topic produces playable boards', () => {
  for (const topic of ALL_TOPICS) {
    describe(`${topic.id} (${topic.name})`, () => {
      it('is reproducible for a seed and varied across seeds', () => {
        const a = topic.round(createRng(2024), 3);
        const b = topic.round(createRng(2024), 3);
        expect(roundSignature(a)).toBe(roundSignature(b));
        expect(a.heading).toBe(b.heading);
        expect(a.tiles.map((t) => t.correct)).toEqual(b.tiles.map((t) => t.correct));

        const variants = new Set(
          Array.from({ length: 8 }, (_, i) => roundSignature(topic.round(createRng(1000 + i), 3))),
        );
        expect(variants.size).toBeGreaterThan(1);
      });

      it('fills the board with fit, ASCII-only, unique tiles', () => {
        for (let level = 1; level <= 20; level++) {
          for (let seed = 1; seed <= 4; seed++) {
            const round = topic.round(createRng(seed * 104729 + level), level);
            expect(round.tiles).toHaveLength(BOARD_CELLS);
            const texts = round.tiles.map((t) => t.text);
            expect(new Set(texts).size).toBe(BOARD_CELLS);
            expect(round.correctCount).toBe(round.tiles.filter((t) => t.correct).length);
            expect(round.correctCount).toBeGreaterThanOrEqual(8);
            expect(round.correctCount).toBeLessThanOrEqual(13);
            expect(round.heading.trim().length).toBeGreaterThan(0);
            expect(round.instruction).toMatch(/munch/i);
            for (const tile of round.tiles) {
              // Visual tiles use their id only for scoring, so the text rules
              // (width, ASCII) apply to what the player actually reads.
              if (tile.visual) {
                expect(tile.text.length).toBeGreaterThan(0);
                continue;
              }
              const text = tile.text;
              expect(text).toMatch(ASCII);
              expect(text.trim()).toBe(text);
              expect(text.length).toBeLessThanOrEqual(12);
              // No whitespace in tiles. Commas are allowed: geometry uses
              // them for angle pairs (21,159) and ordered pairs (6,3).
              expect(text).not.toMatch(/\s/);
            }
          }
        }
      });

      it('explains both right and wrong munches', () => {
        const round = topic.round(createRng(77), 5);
        const right = round.tiles.find((t) => t.correct)!;
        const wrong = round.tiles.find((t) => !t.correct)!;
        for (const tile of [right, wrong]) {
          const text = round.explain(tile.text);
          expect(typeof text).toBe('string');
          expect(text.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }
});
