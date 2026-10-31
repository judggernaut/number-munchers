/** Fixed logical resolution. Everything is drawn at this size and scaled by CSS. */
export const VIEW_W = 640;
export const VIEW_H = 400;

export interface TextStyle {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  shadow?: string;
  weight?: string;
  family?: string;
  alpha?: number;
}

const DEFAULT_FAMILY = '"Courier New", ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * Thin wrapper over a 2D context that keeps drawing calls terse and clamps
 * everything to the logical viewport. The backing store stays at 640x400 and
 * CSS handles upscaling, which preserves hard pixel edges.
 */
export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private shake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  /** Begin a frame with an optional screen-shake offset. */
  begin(color: string, shake = 0): void {
    this.clear(color);
    const { ctx } = this;
    ctx.save();
    if (shake > 0) {
      const dx = (Math.random() * 2 - 1) * shake;
      const dy = (Math.random() * 2 - 1) * shake;
      ctx.translate(Math.round(dx), Math.round(dy));
    }
  }

  end(): void {
    this.ctx.restore();
  }

  setShake(pixels: number): void {
    this.shake = pixels;
  }

  getShake(): number {
    return this.shake;
  }

  fadeShake(amount = 0.5): void {
    this.shake = this.shake > 0.4 ? this.shake * amount : 0;
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    ctx.restore();
  }

  stroke(x: number, y: number, w: number, h: number, color: string, lineWidth = 2): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
    ctx.restore();
  }

  /** Retro double-line panel: filled, with an inset border. */
  panel(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { fill?: string; border?: string; inner?: string; alpha?: number } = {},
  ): void {
    const { fill = '#00006b', border = '#ffffff', inner = '#3b6bff', alpha = 1 } = opts;
    this.rect(x, y, w, h, fill, alpha);
    this.stroke(x, y, w, h, border, 2);
    this.stroke(x + 4, y + 4, w - 8, h - 8, inner, 1);
  }

  text(str: string, x: number, y: number, style: TextStyle = {}): void {
    const {
      size = 16,
      color = '#ffffff',
      align = 'left',
      baseline = 'top',
      shadow = '#000000',
      weight = 'bold',
      family = DEFAULT_FAMILY,
      alpha = 1,
    } = style;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.fillText(str, Math.round(x) + 2, Math.round(y) + 2);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, Math.round(x), Math.round(y));
    ctx.restore();
  }

  /** Text with a horizontal gradient, used for the title treatment. */
  gradientText(
    str: string,
    x: number,
    y: number,
    stops: Array<[number, string]>,
    style: TextStyle = {},
  ): void {
    const { size = 16, align = 'left', baseline = 'top', weight = 'bold', family = DEFAULT_FAMILY } = style;
    const { ctx } = this;
    ctx.save();
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    const width = ctx.measureText(str).width;
    const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    const grad = ctx.createLinearGradient(left, y, left + width, y);
    for (const [offset, color] of stops) grad.addColorStop(offset, color);
    ctx.fillStyle = '#000000';
    ctx.fillText(str, Math.round(x) + 3, Math.round(y) + 3);
    ctx.fillStyle = grad;
    ctx.fillText(str, Math.round(x), Math.round(y));
    ctx.restore();
  }

  measure(str: string, size: number, weight = 'bold', family = DEFAULT_FAMILY): number {
    const { ctx } = this;
    ctx.save();
    ctx.font = `${weight} ${size}px ${family}`;
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  /** Draw a sprite centred in a cell, preserving aspect ratio. */
  sprite(img: HTMLImageElement, cx: number, cy: number, box: number, flipX = false): void {
    const scale = Math.min(box / img.width, box / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    if (!flipX) {
      this.ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
      return;
    }
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(cx), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, Math.round(cy - h / 2), Math.round(w), Math.round(h));
    ctx.restore();
  }

  /** Sprite with scale, rotation and optional mirroring, for flourishes. */
  spriteTransformed(
    img: HTMLImageElement,
    cx: number,
    cy: number,
    box: number,
    scale = 1,
    rotation = 0,
    alpha = 1,
    flipX = false,
  ): void {
    const { ctx } = this;
    const fit = Math.min(box / img.width, box / img.height);
    const w = img.width * fit * scale;
    const h = img.height * fit * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /** Simple starfield used behind menus. */
  stars(stars: Array<{ x: number; y: number; s: number; c: string }>, t: number): void {
    for (const star of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * 0.001 + star.x * 0.37);
      this.rect(star.x, star.y, star.s, star.s, star.c, twinkle);
    }
  }
}
