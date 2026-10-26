import { createRng } from './rng';
import { plotForFamily } from './topics/graphs';
import { GENERATED_LESSONS } from './lessons-data';
import type { Lesson, LessonFigure, PlotFamily, ShapeSpec, Topic } from './types';

/**
 * Lesson pages, keyed by topic id. Authored copy lives in `lessons-data.ts`;
 * any topic without an entry still gets a usable page via `fallbackLesson`.
 */
export const LESSONS: Record<string, Lesson> = { ...GENERATED_LESSONS };

export function lessonFor(topic: Topic): Lesson {
  const lesson = LESSONS[topic.id] ?? fallbackLesson(topic);
  if (lesson.figure) return lesson;
  const figure = figureFor(topic, lesson);
  return figure ? { ...lesson, figure } : lesson;
}

/** Keyword -> shape, so a lesson's answer text picks the matching drawing. */
const SHAPE_KEYWORDS: Array<[RegExp, ShapeSpec]> = [
  [/equilateral/i, { kind: 'shape', shape: 'triangle', dimension: 2, triangle: { angles: [60, 60, 60], marks: [0, 1, 2] } }],
  [/isosceles/i, { kind: 'shape', shape: 'triangle', dimension: 2, triangle: { angles: [40, 70, 70], marks: [1, 2] } }],
  [/scalene/i, { kind: 'shape', shape: 'triangle', dimension: 2, triangle: { angles: [80, 60, 40] } }],
  [/right triangle/i, { kind: 'shape', shape: 'right-triangle', dimension: 2 }],
  [/triangle/i, { kind: 'shape', shape: 'triangle', dimension: 2, triangle: { angles: [70, 60, 50] } }],
  [/triangular prism/i, { kind: 'shape', shape: 'triangular-prism', dimension: 3 }],
  [/rectangular prism|prism/i, { kind: 'shape', shape: 'prism', dimension: 3 }],
  [/cube/i, { kind: 'shape', shape: 'cube', dimension: 3 }],
  [/pyramid/i, { kind: 'shape', shape: 'pyramid', dimension: 3 }],
  [/cylinder/i, { kind: 'shape', shape: 'cylinder', dimension: 3 }],
  [/cone/i, { kind: 'shape', shape: 'cone', dimension: 3 }],
  [/sphere/i, { kind: 'shape', shape: 'sphere', dimension: 3 }],
  [/pentagon/i, { kind: 'shape', shape: 'pentagon', dimension: 2 }],
  [/hexagon/i, { kind: 'shape', shape: 'hexagon', dimension: 2 }],
  [/trapezoid/i, { kind: 'shape', shape: 'trapezoid', dimension: 2 }],
  [/parallelogram/i, { kind: 'shape', shape: 'parallelogram', dimension: 2 }],
  [/rectangle/i, { kind: 'shape', shape: 'rectangle', dimension: 2 }],
  [/square/i, { kind: 'shape', shape: 'square', dimension: 2 }],
  [/circle/i, { kind: 'shape', shape: 'circle', dimension: 2 }],
];

/** Keyword -> plot family, so graph lessons show the family they discuss. */
const PLOT_KEYWORDS: Array<[RegExp, PlotFamily]> = [
  [/parabola|quadratic|U-shaped/i, 'quadratic'],
  [/cubic|S-shaped/i, 'cubic'],
  [/exponential/i, 'exponential'],
  [/logarithm/i, 'logarithmic'],
  [/reciprocal|two branches/i, 'reciprocal'],
  [/square root|sqrt/i, 'sqrt'],
  [/absolute|V shape/i, 'absolute'],
  [/sine|wave/i, 'sine'],
  [/linear|straight line/i, 'linear'],
];

/**
 * Visual topics get a drawn example. When the lesson's answer names a shape or
 * a graph family we draw exactly that; otherwise we fall back to the first
 * correct visual tile from a deterministic round.
 */
export function figureFor(topic: Topic, lesson?: Lesson): LessonFigure | null {
  const caption = lesson?.example.answer ?? 'Example';
  const answer = caption.toLowerCase();
  const round = topic.round(createRng(0x5eed), 3);
  const sample = round.tiles.find((candidate) => candidate.visual)?.visual;
  if (!sample) return null;

  // The board type decides which keyword table applies: a geometry board must
  // never be matched by "square root", and a graph board never by "square".
  if (sample.kind === 'plot') {
    for (const [pattern, family] of PLOT_KEYWORDS) {
      if (pattern.test(answer)) return { visual: plotForFamily(family), caption };
    }
    const tile = round.tiles.find((candidate) => candidate.visual?.kind === 'plot' && candidate.correct);
    return tile?.visual ? { visual: tile.visual, caption } : null;
  }

  for (const [pattern, spec] of SHAPE_KEYWORDS) {
    if (pattern.test(answer)) return { visual: spec, caption };
  }
  const tile = round.tiles.find((candidate) => candidate.visual?.kind === 'shape' && candidate.correct);
  if (!tile?.visual) return null;
  return { visual: tile.visual, caption };
}

/**
 * A generated page for topics without authored copy: the blurb, a live
 * instruction from a real round, and one correct tile as the example.
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
