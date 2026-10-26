import { describe, expect, it } from 'vitest';

import { ALL_TOPICS } from './registry';
import { createRng } from './rng';
import { LESSON_LIMITS, LESSONS, fallbackLesson, lessonFor } from './lessons';

const ASCII = /^[\x20-\x7e]+$/;

describe('lesson pages', () => {
  it('always produces a usable page, authored or fallback', () => {
    for (const topic of ALL_TOPICS) {
      const lesson = lessonFor(topic);
      expect(lesson.summary.length).toBeGreaterThan(20);
      expect(lesson.summary.length).toBeLessThanOrEqual(LESSON_LIMITS.summary);
      expect(lesson.steps.length).toBeGreaterThanOrEqual(LESSON_LIMITS.steps.min);
      expect(lesson.steps.length).toBeLessThanOrEqual(LESSON_LIMITS.steps.max);
      for (const step of lesson.steps) {
        expect(step.length).toBeLessThanOrEqual(LESSON_LIMITS.step);
        expect(step).toMatch(ASCII);
      }
      expect(lesson.example.prompt.length).toBeLessThanOrEqual(LESSON_LIMITS.prompt);
      expect(lesson.example.answer.length).toBeGreaterThan(0);
      expect(lesson.example.answer.length).toBeLessThanOrEqual(LESSON_LIMITS.answer);
      expect(lesson.example.why.length).toBeGreaterThan(10);
      expect(lesson.example.why.length).toBeLessThanOrEqual(LESSON_LIMITS.why);
      expect(lesson.tip).toBeTruthy();
      expect(lesson.tip!.length).toBeLessThanOrEqual(LESSON_LIMITS.tip);
      expect(lesson.summary).toMatch(ASCII);
      expect(lesson.example.why).toMatch(ASCII);
    }
  });

  it('falls back deterministically for topics without authored copy', () => {
    const topic = ALL_TOPICS[0]!;
    const a = fallbackLesson(topic);
    const b = fallbackLesson(topic);
    expect(a).toEqual(b);
  });

  it('every authored lesson obeys the limits', () => {
    for (const [id, lesson] of Object.entries(LESSONS)) {
      expect(lesson.summary.length, `${id} summary`).toBeLessThanOrEqual(LESSON_LIMITS.summary);
      expect(lesson.steps.length, `${id} steps`).toBeLessThanOrEqual(LESSON_LIMITS.steps.max);
      for (const step of lesson.steps) {
        expect(step.length, `${id} step`).toBeLessThanOrEqual(LESSON_LIMITS.step);
      }
      expect(lesson.tip?.length ?? 0, `${id} tip`).toBeLessThanOrEqual(LESSON_LIMITS.tip);
      expect(lesson.example.why.length, `${id} why`).toBeLessThanOrEqual(LESSON_LIMITS.why);
      expect(lesson.summary, `${id} ascii`).toMatch(ASCII);
    }
  });

  it('attaches a drawn example to every visual topic, and only those', () => {
    for (const topic of ALL_TOPICS) {
      const visualTopic = topic.round(createRng(11), 1).tiles.some((tile) => tile.visual);
      const lesson = lessonFor(topic);
      expect(Boolean(lesson.figure), `${topic.id}`).toBe(visualTopic);
      if (lesson.figure) {
        expect(lesson.figure.caption.length).toBeGreaterThan(0);
        expect(['plot', 'shape']).toContain(lesson.figure.visual.kind);
      }
    }
  });

  it('has authored copy for every topic', () => {
    const authored = new Set(Object.keys(LESSONS));
    const missing = ALL_TOPICS.filter((topic) => !authored.has(topic.id)).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('has no lessons for unknown topics', () => {
    const known = new Set(ALL_TOPICS.map((topic) => topic.id));
    const orphans = Object.keys(LESSONS).filter((id) => !known.has(id));
    expect(orphans).toEqual([]);
  });
});
