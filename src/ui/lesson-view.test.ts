import { describe, expect, it } from 'vitest';

import { ALL_TOPICS } from '../content/registry';
import { lessonFor } from '../content/lessons';
import type { Lesson } from '../content/types';
import { planLesson } from './lesson-view';
import { planOverlay, type Measure } from './text-layout';

const measure: Measure = (text, size) => text.length * size * 0.6;

const longLesson: Lesson = {
  summary:
    'A cubic function has an S-shaped graph with no turning points. It grows in one direction and can cross the x-axis up to three times, which is why its factors matter.',
  steps: [
    'Look at the ends of the curve: they head in opposite directions.',
    'Check the number of bends: a cubic has none, a quadratic has one.',
    'Compare with exponential growth, which curves one way only.',
  ],
  example: {
    prompt: 'Munch every graph of a cubic function.',
    answer: 'the S-shaped curve',
    why: 'A cubic rises, flattens briefly, then rises again, so the ends go opposite ways.',
  },
  tip: 'Cubic graphs never have a turning point, so any bend means you are looking at a quadratic.',
};

describe('planLesson', () => {
  it('lays out a realistic lesson inside the panel', () => {
    const plan = planLesson(longLesson, measure, { maxWidth: 488, maxHeight: 288 });
    expect(plan.overflow).toBe(false);
    expect(plan.height).toBeLessThanOrEqual(288);
    for (const block of plan.blocks) {
      for (const line of block.lines) expect(measure(line, plan.size)).toBeLessThanOrEqual(488);
    }
  });

  it('fits every topic lesson, authored or fallback', () => {
    for (const topic of ALL_TOPICS) {
      const plan = planLesson(lessonFor(topic), measure, { maxWidth: 488, maxHeight: 288 });
      expect(plan.overflow, `${topic.id} overflows`).toBe(false);
      expect(plan.height, `${topic.id} too tall`).toBeLessThanOrEqual(288);
    }
  });

  it('trims blocks rather than spilling when content is absurd', () => {
    const absurd: Lesson = {
      ...longLesson,
      summary: 'word '.repeat(500),
      steps: ['word '.repeat(50), 'word '.repeat(50), 'word '.repeat(50), 'word '.repeat(50)],
    };
    const plan = planLesson(absurd, measure, { maxWidth: 488, maxHeight: 288 });
    expect(plan.overflow).toBe(true);
    expect(plan.height).toBeLessThanOrEqual(288);
  });
});

describe('overlay messages from real topics', () => {
  it('never overflows the popup for any topic explanation', async () => {
    const { createRng } = await import('../content/rng');
    const failures: string[] = [];
    for (const topic of ALL_TOPICS) {
      for (let level = 1; level <= 5; level++) {
        for (let seed = 1; seed <= 3; seed++) {
          const round = topic.round(createRng(seed * 7919 + level), level);
          for (const tile of round.tiles.filter((t) => !t.correct).slice(0, 3)) {
            const message = round.explain(tile.text);
            const plan = planOverlay(message, measure);
            if (plan.overflow) failures.push(`${topic.id}: "${message}"`);
            if (plan.height > 356) failures.push(`${topic.id}: too tall (${plan.height})`);
          }
        }
      }
    }
    expect(failures.slice(0, 8)).toEqual([]);
  });
});
