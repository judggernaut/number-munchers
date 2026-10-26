import type { Lesson } from '../content/types';
import { wrapToWidth, type Measure } from './text-layout';

/**
 * Lays out a lesson page inside the fixed game panel. Sections are planned at
 * the largest font that fits the panel height, so authored copy cannot spill
 * past the frame.
 */

export interface LessonBlock {
  header: string;
  lines: string[];
}

export interface LessonPlan {
  size: number;
  lineHeight: number;
  blocks: LessonBlock[];
  height: number;
  overflow: boolean;
}

export interface LessonLayoutOptions {
  maxWidth: number;
  maxHeight: number;
  sizes?: number[];
}

const HEADER_HEIGHT = 15;
const BLOCK_GAP = 9;

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

const planAtSize = (lesson: Lesson, size: number, maxWidth: number, measure: Measure): LessonPlan => {
  const blocks = buildBlocks(lesson, size, maxWidth, measure);
  const lineHeight = Math.round(size * 1.5);
  const height = blocks.reduce(
    (total, block) => total + HEADER_HEIGHT + block.lines.length * lineHeight + BLOCK_GAP,
    0,
  );
  return { size, lineHeight, blocks, height, overflow: false };
};

export function planLesson(lesson: Lesson, measure: Measure, options: LessonLayoutOptions): LessonPlan {
  const sizes = options.sizes ?? [11, 10, 9];
  if (sizes.length === 0) throw new Error('planLesson needs at least one size');

  for (const size of sizes) {
    const plan = planAtSize(lesson, size, options.maxWidth, measure);
    if (plan.height <= options.maxHeight) return plan;
  }

  // Nothing fits: keep the smallest and drop trailing blocks until it does.
  const plan = planAtSize(lesson, sizes[sizes.length - 1]!, options.maxWidth, measure);
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
