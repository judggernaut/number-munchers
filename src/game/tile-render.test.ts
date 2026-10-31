import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { TileVisual } from '../content/types';
import { drawTile, tileFontSize, type TileBox, type TileCanvas } from './tile-render';

const box: TileBox = { x: 128, y: 56, w: 64, h: 64 };

/** Records every draw call so two tiles can be compared exactly. */
class Recorder implements TileCanvas {
  calls: string[] = [];

  text(
    str: string,
    x: number,
    y: number,
    style: { size: number; color: string; align: CanvasTextAlign; baseline: CanvasTextBaseline },
  ): void {
    this.calls.push(`text:${str}@${Math.round(x)},${Math.round(y)}:${JSON.stringify(style)}`);
  }

  drawVisual(visual: TileVisual, visualBox: TileBox): void {
    this.calls.push(`visual:${visual.kind}:${Math.round(visualBox.x)},${Math.round(visualBox.y)}`);
  }
}

describe('tile rendering', () => {
  it('draws text centred in the cell with the shared ink', () => {
    const rec = new Recorder();
    drawTile(rec, { text: '42' }, box);
    expect(rec.calls).toEqual([
      `text:42@${box.x + 32},${box.y + 32}:{"size":24,"color":"#ffffff","align":"center","baseline":"middle"}`,
    ]);
  });

  it('shrinks the font as the tile gets longer', () => {
    expect(tileFontSize('42')).toBe(24);
    expect(tileFontSize('12345')).toBe(19);
    expect(tileFontSize('3x+2=5')).toBe(15);
    expect(tileFontSize('log2(32)')).toBe(12);
  });

  it('insets drawn figures inside the cell', () => {
    const rec = new Recorder();
    drawTile(rec, { text: 'g1', visual: { kind: 'shape', shape: 'cube', dimension: 3 } }, box);
    expect(rec.calls).toEqual(['visual:shape:134,62']);
  });

  it('accepts no correctness information', () => {
    const rec = new Recorder();
    // If TileInfo ever grows a `correct` field this line stops failing to
    // compile, the build breaks, and the leak is caught before it ships.
    // @ts-expect-error - correctness must not be part of tile drawing
    drawTile(rec, { text: '7', correct: true }, box);
    expect(rec.calls).toHaveLength(1);
  });
});

describe('the grid renderer', () => {
  it('never branches on tile correctness while drawing', () => {
    const source = readFileSync(new URL('./session.ts', import.meta.url), 'utf8');
    const start = source.indexOf('private drawGrid');
    const end = source.indexOf('private drawActors');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const gridCode = source.slice(start, end);
    expect(gridCode).not.toMatch(/\.correct\b|correct\s*\?/);
  });
});
