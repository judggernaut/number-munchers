import type { TileVisual } from '../content/types';

/**
 * Tile drawing, isolated from everything else so that correctness can never
 * leak into the picture.
 *
 * The input is deliberately `{ text, visual }` and nothing else: no `correct`
 * flag, no score state. A tile that is right and a tile that is wrong with the
 * same content are pixel-identical, which keeps the game honest - if the board
 * could be read by colour, it would stop being a math test.
 */

export interface TileBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything tile drawing needs; tests record calls through a fake. */
export interface TileCanvas {
  text(
    str: string,
    x: number,
    y: number,
    style: { size: number; color: string; align: CanvasTextAlign; baseline: CanvasTextBaseline },
  ): void;
  drawVisual(visual: TileVisual, box: TileBox): void;
}

/** One ink for every uneaten tile. */
export const TILE_INK = '#ffffff';

/** Inset for drawn figures inside a cell. */
const VISUAL_INSET = 6;

export function tileFontSize(text: string): number {
  const length = text.length;
  if (length <= 3) return 24;
  if (length <= 5) return 19;
  if (length <= 7) return 15;
  return 12;
}

export interface TileInfo {
  text: string;
  visual?: TileVisual;
}

export function drawTile(canvas: TileCanvas, info: TileInfo, cellBox: TileBox): void {
  if (info.visual) {
    canvas.drawVisual(info.visual, {
      x: cellBox.x + VISUAL_INSET,
      y: cellBox.y + VISUAL_INSET,
      w: cellBox.w - VISUAL_INSET * 2,
      h: cellBox.h - VISUAL_INSET * 2,
    });
    return;
  }
  canvas.text(info.text, cellBox.x + cellBox.w / 2, cellBox.y + cellBox.h / 2, {
    size: tileFontSize(info.text),
    color: TILE_INK,
    align: 'center',
    baseline: 'middle',
  });
}
