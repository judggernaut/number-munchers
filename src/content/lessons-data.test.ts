import { describe, expect, it } from 'vitest';

import { ALL_TOPICS } from './registry';
import { GENERATED_LESSONS } from './lessons-data';
import { LESSON_LIMITS } from './lessons';
import type { Lesson } from './types';

const ASCII = /^[\x20-\x7e]+$/;
const SENTENCE_END = /[.!?](?=\s|$)/g;

const textFields = (lesson: Lesson): string[] => [
  lesson.summary,
  ...lesson.steps,
  lesson.example.prompt,
  lesson.example.answer,
  lesson.example.why,
  lesson.tip ?? '',
];

const entries = Object.entries(GENERATED_LESSONS);
const ids = ALL_TOPICS.map((topic) => topic.id);

describe('authored lessons', () => {
  it('covers every topic exactly once, with no unknown ids', () => {
    expect(entries).toHaveLength(ids.length);
    for (const id of ids) expect(GENERATED_LESSONS[id], `missing lesson for ${id}`).toBeDefined();
    for (const id of Object.keys(GENERATED_LESSONS)) {
      expect(ids, `unknown lesson id ${id}`).toContain(id);
    }
  });

  it('has no duplicate summaries or tips', () => {
    const summaries = entries.map(([, lesson]) => lesson.summary);
    const tips = entries.map(([, lesson]) => lesson.tip);
    expect(new Set(summaries).size).toBe(summaries.length);
    expect(new Set(tips).size).toBe(tips.length);
  });

  for (const id of ids) {
    describe(id, () => {
      const lesson = GENERATED_LESSONS[id];

      it('exists with a non-empty tip', () => {
        expect(lesson).toBeDefined();
        expect(lesson!.tip).toBeDefined();
        expect(lesson!.tip!.trim().length).toBeGreaterThan(0);
      });

      it('respects every length limit', () => {
        const item = lesson!;
        expect(item.summary.length).toBeLessThanOrEqual(LESSON_LIMITS.summary);
        expect(item.steps.length).toBeGreaterThanOrEqual(LESSON_LIMITS.steps.min);
        expect(item.steps.length).toBeLessThanOrEqual(LESSON_LIMITS.steps.max);
        for (const step of item.steps) expect(step.length).toBeLessThanOrEqual(LESSON_LIMITS.step);
        expect(item.example.prompt.length).toBeLessThanOrEqual(LESSON_LIMITS.prompt);
        expect(item.example.answer.length).toBeLessThanOrEqual(LESSON_LIMITS.answer);
        expect(item.example.why.length).toBeLessThanOrEqual(LESSON_LIMITS.why);
        expect(item.tip!.length).toBeLessThanOrEqual(LESSON_LIMITS.tip);
      });

      it('has 1-3 sentences in the summary', () => {
        const sentences = lesson!.summary.match(SENTENCE_END) ?? [];
        expect(sentences.length).toBeGreaterThanOrEqual(1);
        expect(sentences.length).toBeLessThanOrEqual(3);
      });

      it('is clean ASCII with no empty fields, newlines or double spaces', () => {
        for (const field of textFields(lesson!)) {
          expect(field.trim().length).toBeGreaterThan(0);
          expect(field).toMatch(ASCII);
          expect(field).not.toContain('\n');
          expect(field).not.toContain('\r');
          expect(field).not.toContain('  ');
        }
        expect(lesson!.steps.length).toBeGreaterThanOrEqual(2);
        expect(lesson!.steps.length).toBeLessThanOrEqual(4);
        expect(lesson!.example.answer.trim().length).toBeGreaterThan(0);
        expect(lesson!.example.why.trim().length).toBeGreaterThan(0);
      });
    });
  }
});
