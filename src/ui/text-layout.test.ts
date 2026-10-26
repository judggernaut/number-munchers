import { describe, expect, it } from 'vitest';

import { layoutText, planOverlay, wrapToWidth, type Measure } from './text-layout';

/** Monospace-ish stand-in for the canvas measureText call. */
const measure: Measure = (text, size) => text.length * size * 0.6;

const longest = (lines: string[]): number => Math.max(0, ...lines.map((line) => line.length));

describe('wrapToWidth', () => {
  it('keeps every line inside the box', () => {
    const text =
      'Its angles are 100, 40 and 40 degrees, so it is obtuse, not scalene. Pick the triangle that matches the asked-for classification.';
    const lines = wrapToWidth(text, 13, 396, measure);
    for (const line of lines) {
      expect(measure(line, 13)).toBeLessThanOrEqual(396);
    }
    expect(lines.join(' ')).toContain('obtuse');
  });

  it('hard-breaks words that are wider than the box', () => {
    const token = 'x^3-2x^2+11x-12+sqrt(144)/12+somethingverylong';
    const lines = wrapToWidth(token, 13, 60, measure);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line, 13)).toBeLessThanOrEqual(60);
  });

  it('collapses whitespace and handles empty input', () => {
    expect(wrapToWidth('  a   b \n c ', 13, 400, measure)).toEqual(['a b c']);
    expect(wrapToWidth('   ', 13, 400, measure)).toEqual([]);
  });
});

describe('layoutText', () => {
  const options = { maxWidth: 200, maxLines: 3, sizes: [16, 14, 12] };

  it('uses the largest font that fits', () => {
    const result = layoutText('short text', measure, options);
    expect(result.size).toBe(16);
    expect(result.overflow).toBe(false);
  });

  it('shrinks the font before giving up', () => {
    const text = 'word '.repeat(30);
    const result = layoutText(text, measure, options);
    expect(result.size).toBeLessThan(16);
    expect(result.lines.length).toBeLessThanOrEqual(3);
  });

  it('flags and ellipsises text that cannot fit at any size', () => {
    const text = 'word '.repeat(400);
    const result = layoutText(text, measure, options);
    expect(result.overflow).toBe(true);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[2]!.endsWith('\u2026')).toBe(true);
    for (const line of result.lines) {
      expect(measure(line, result.size)).toBeLessThanOrEqual(options.maxWidth);
    }
  });
});

describe('planOverlay', () => {
  it('grows the box instead of letting text escape', () => {
    const short = planOverlay('Nope.', measure);
    const long = planOverlay(
      'This is an S-shaped curve with no turning points - a cubic function, not linear. ' +
        'A linear graph is a straight line, so look for constant slope across the whole domain.',
      measure,
    );
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.lines.length).toBeGreaterThan(short.lines.length);
    expect(long.overflow).toBe(false);
  });

  it('keeps the reported cubic explanation inside the panel', () => {
    // Exact phrasing produced by the Function Families topic.
    const message =
      'This is an S-shaped curve with no turning points - a cubic function, not linear.';
    const plan = planOverlay(message, measure);
    expect(plan.width).toBeLessThanOrEqual(640 - 40);
    expect(plan.height).toBeLessThanOrEqual(400 - 80);
    for (const line of plan.lines) {
      expect(measure(line, plan.size)).toBeLessThanOrEqual(396);
    }
    expect(plan.lines.join(' ')).toContain('cubic function');
  });

  it('fits a very long formula without overflowing the panel width', () => {
    const message =
      'Explain: 9^2 + 40^2 = 81 + 1600 = 1681; sqrt(1681) = 41, so the missing hypotenuse is 41. ' +
      'Check: 41^2 = 1681 and 9^2 + 40^2 = 1681, therefore the triangle is right.';
    const plan = planOverlay(message, measure);
    expect(plan.height).toBeLessThanOrEqual(400 - 80);
    expect(longest(plan.lines)).toBeGreaterThan(0);
  });
});
