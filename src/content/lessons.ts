import { createRng } from './rng';
import { GENERATED_LESSONS } from './lessons-data';
import type { Lesson, Topic } from './types';

/**
 * Lesson pages, keyed by topic id. Authored copy lives in `lessons-data.ts`;
 * any topic without an entry still gets a usable page via `fallbackLesson`.
 */
export const LESSONS: Record<string, Lesson> = { ...GENERATED_LESSONS };

export function lessonFor(topic: Topic): Lesson {
  return LESSONS[topic.id] ?? fallbackLesson(topic);
}

/**
 * A generated page: the topic blurb, a live instruction from a real round, and
 * one correct tile as the worked example. Deliberately short so it always fits
 * the page without scrolling.
 */
export function fallbackLesson(topic: Topic): Lesson {
  const round = topic.round(createRng(0x5eed), 3);
  const correct = round.tiles.find((tile) => tile.correct);
  const answer = correct ? (correct.visual ? 'the matching picture' : correct.text) : 'any matching tile';
  return {
    summary: topic.blurb,
    steps: [
      round.instruction,
      'Munch the tiles that fit the rule and leave the rest alone.',
      'Clear every correct tile to finish the level.',
    ],
    example: {
      prompt: round.instruction,
      answer,
      why: `That tile is one of the answers for ${topic.name.toLowerCase()}.`,
    },
    tip: `Grades ${topic.grades.replace(/^Grades\s*/i, '')}. Wrong tiles cost a life, so check before you munch.`,
  };
}

/** Limits enforced by tests so a lesson can never overflow its page. */
export const LESSON_LIMITS = {
  summary: 220,
  step: 100,
  prompt: 90,
  answer: 40,
  why: 170,
  tip: 140,
  steps: { min: 2, max: 4 },
} as const;
