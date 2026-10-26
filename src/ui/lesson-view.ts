import type { Lesson } from '../content/types';
import { wrapToWidth, type Measure } from './text-layout';

/**
 * Lays out a lesson page inside the fixed game panel.
 *
 * Lessons with a figure use a two-column layout: text on the left, the drawn
 * example pinned top-right. That keeps the page height unchanged, which matters
 * because the panel cannot scroll.
 */

export interface LessonBlock {
  header: string;
  lines: string[];
}

export interface LessonPlan {
  size: number;
  lineHeight: number;
  blocks: LessonBlock[];
  /** Caption lines drawn under the figure, already wrapped. */
  captionLines: string[];
  /** Height of the text column. */
  height: number;
  overflow: boolean;
}

export interface LessonLayoutOptions {
  maxWidth: number;
  maxHeight: number;
  sizes?: number[];
  /** Width reserved for the figure column when the lesson has one. */
  figureWidth?: number;
}

const HEADER_HEIGHT = 15;
const BLOCK_GAP = 9;
const FIGURE_GAP = 16;

const buildBlocks = (lesson: Lesson, size: number, maxWidth: number, measure: Measure): LessonBlock[] => {
  const wrap = (text: string): string[] => wrapToWidth(text, size, maxWidth, measure);
  const blocks: LessonBlock[] = [
    { header: 'WHAT IT IS', lines: wrap(lesson.summary) },
    {
      header: 'HOW TO DO IT',
      lines: lesson.steps.flatMap((step, index) => wrap(`${index + 1}. ${step}`)),
    },
    {
      header: 'WORKED EXAMPLE',
      lines: [
        ...wrap(lesson.example.prompt),
        ...wrap(`Answer: ${lesson.example.answer}`),
        ...wrap(lesson.example.why),
      ],
    },
  ];
  if (lesson.tip) blocks.push({ header: 'TIP', lines: wrap(lesson.tip) });
  return blocks;
};

const textWidthFor = (options: LessonLayoutOptions, hasFigure: boolean): number =>
  hasFigure ? options.maxWidth - (options.figureWidth ?? 132) - FIGURE_GAP : options.maxWidth;

const planAtSize = (
  lesson: Lesson,
  size: number,
  options: LessonLayoutOptions,
  measure: Measure,
  hasFigure: boolean,
): LessonPlan => {
  const width = textWidthFor(options, hasFigure);
  const blocks = buildBlocks(lesson, size, width, measure);
  const lineHeight = Math.round(size * 1.5);
  const height = blocks.reduce(
    (total, block) => total + HEADER_HEIGHT + block.lines.length * lineHeight + BLOCK_GAP,
    0,
  );
  const captionLines = lesson.figure
    ? wrapToWidth(lesson.figure.caption, Math.max(8, size - 1), options.figureWidth ?? 132, measure)
    : [];
  return { size, lineHeight, blocks, captionLines, height, overflow: false };
};

export function planLesson(lesson: Lesson, measure: Measure, options: LessonLayoutOptions): LessonPlan {
  const sizes = options.sizes ?? [11, 10, 9, 8];
  if (sizes.length === 0) throw new Error('planLesson needs at least one size');
  const hasFigure = Boolean(lesson.figure);

  for (const size of sizes) {
    const plan = planAtSize(lesson, size, options, measure, hasFigure);
    if (plan.height <= options.maxHeight) return plan;
  }

  // Nothing fits: keep the smallest size and drop trailing blocks.
  const plan = planAtSize(lesson, sizes[sizes.length - 1]!, options, measure, hasFigure);
  const kept: LessonBlock[] = [];
  let used = 0;
  for (const block of plan.blocks) {
    const cost = HEADER_HEIGHT + block.lines.length * plan.lineHeight + BLOCK_GAP;
    if (used + cost > options.maxHeight) break;
    kept.push(block);
    used += cost;
  }
  return { ...plan, blocks: kept, height: used, overflow: true };
}
