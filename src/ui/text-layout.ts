/**
 * Text layout for fixed-size boxes.
 *
 * The game draws into a 640x400 canvas with no HTML reflow, so every message
 * that can grow (error explanations, lesson text) has to be wrapped and fitted
 * by hand. These helpers are pure and take a measuring function, which makes
 * them testable without a canvas.
 */

export interface LayoutOptions {
  /** Longest line allowed, in logical pixels. */
  maxWidth: number;
  /** How many lines the box can hold. */
  maxLines: number;
  /** Font sizes to try, largest first. */
  sizes: number[];
}

export interface LayoutResult {
  lines: string[];
  size: number;
  /** True when the text still did not fit at the smallest size and was cut. */
  overflow: boolean;
}

export type Measure = (text: string, size: number) => number;

/** Split a word that is wider than the box into hard-broken chunks. */
function breakWord(word: string, size: number, maxWidth: number, measure: Measure): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const char of word) {
    const candidate = current + char;
    if (current && measure(candidate, size) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Greedy word wrap at a fixed font size. Lines never exceed maxWidth. */
export function wrapToWidth(
  text: string,
  size: number,
  maxWidth: number,
  measure: Measure,
): string[] {
  const normalised = text.replace(/\s+/g, ' ').trim();
  if (!normalised) return [];

  const lines: string[] = [];
  let line = '';

  const pushLine = (): void => {
    if (line) lines.push(line);
    line = '';
  };

  for (const rawWord of normalised.split(' ')) {
    const pieces = measure(rawWord, size) > maxWidth ? breakWord(rawWord, size, maxWidth, measure) : [rawWord];
    for (const piece of pieces) {
      const candidate = line ? `${line} ${piece}` : piece;
      if (line && measure(candidate, size) > maxWidth) {
        pushLine();
        line = piece;
      } else {
        line = candidate;
      }
    }
  }
  pushLine();
  return lines;
}

/** Trim a trailing line and mark it with an ellipsis. */
function truncate(line: string, size: number, maxWidth: number, measure: Measure): string {
  let text = line;
  while (text.length > 1 && measure(`${text}\u2026`, size) > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text.trimEnd()}\u2026`;
}

/**
 * Wrap at the largest size that fits, shrinking the font if needed. If even the
 * smallest size overflows, the last visible line is ellipsised and `overflow`
 * is reported so callers can log it in tests.
 */
export function layoutText(text: string, measure: Measure, options: LayoutOptions): LayoutResult {
  const { maxWidth, maxLines, sizes } = options;
  if (sizes.length === 0) throw new Error('layoutText needs at least one size');

  for (const size of sizes) {
    const lines = wrapToWidth(text, size, maxWidth, measure);
    if (lines.length <= maxLines) return { lines, size, overflow: false };
  }

  const size = sizes[sizes.length - 1]!;
  const lines = wrapToWidth(text, size, maxWidth, measure).slice(0, maxLines);
  if (lines.length > 0) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1]!, size, maxWidth, measure);
  }
  return { lines, size, overflow: true };
}

/** Standard fonts and spacing for the in-game message box. */
export const OVERLAY_LAYOUT: LayoutOptions = {
  maxWidth: 396,
  maxLines: 7,
  sizes: [13, 12, 11, 10],
};

export interface OverlayPlan {
  lines: string[];
  size: number;
  lineHeight: number;
  width: number;
  height: number;
  overflow: boolean;
}

/**
 * Plan the message box: width is fixed, height grows with the number of lines
 * so a long explanation can never spill outside the panel.
 */
export function planOverlay(message: string, measure: Measure): OverlayPlan {
  const { lines, size, overflow } = layoutText(message, measure, OVERLAY_LAYOUT);
  const lineHeight = Math.round(size * 1.45);
  const paddingTop = 24;
  const paddingBottom = 34;
  const height = Math.max(120, paddingTop + lines.length * lineHeight + paddingBottom);
  return { lines, size, lineHeight, width: 460, height, overflow };
}
