import type { Screen } from '../engine/screen';

/**
 * The persistent sound control: same corner on every screen, one click to
 * change volume, never overlapping the board or the menus.
 */

export const SOUND_BUTTON = { x: 596, y: 4, w: 38, h: 22 } as const;

/** Click steps: full, quieter, quiet, silent - then back to full. */
export const VOLUME_STEPS: readonly number[] = [1, 0.6, 0.3, 0];

export function hitSoundButton(x: number, y: number): boolean {
  return (
    x >= SOUND_BUTTON.x &&
    x <= SOUND_BUTTON.x + SOUND_BUTTON.w &&
    y >= SOUND_BUTTON.y &&
    y <= SOUND_BUTTON.y + SOUND_BUTTON.h
  );
}

export function nextVolume(volume: number): number {
  const index = VOLUME_STEPS.findIndex((step) => Math.abs(step - volume) < 1e-6);
  // An unknown level (old save, hand-edited) restarts the cycle at full.
  return VOLUME_STEPS[(index + 1) % VOLUME_STEPS.length]!;
}

export function volumeLabel(volume: number): string {
  return volume <= 0 ? 'MUTED' : `${Math.round(volume * 100)}%`;
}

/** Draws the chip: speaker, volume waves (or a slash when muted). */
export function drawSoundButton(screen: Screen, volume: number, toast: string | null): void {
  const { x, y, w, h } = SOUND_BUTTON;
  const ctx = screen.ctx;

  screen.rect(x, y, w, h, '#0d1740');
  screen.stroke(x, y, w, h, '#3450ff', 1);

  const cx = x + 15;
  const cy = y + h / 2;
  const ink = volume <= 0 ? '#5f7fd0' : '#8fd2ff';

  ctx.save();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 3);
  ctx.lineTo(cx - 1, cy - 3);
  ctx.lineTo(cx + 4, cy - 7);
  ctx.lineTo(cx + 4, cy + 7);
  ctx.lineTo(cx - 1, cy + 3);
  ctx.lineTo(cx - 5, cy + 3);
  ctx.closePath();
  ctx.fill();

  const waves = volume > 0.8 ? 3 : volume > 0.45 ? 2 : volume > 0 ? 1 : 0;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < waves; i++) {
    ctx.beginPath();
    ctx.arc(cx + 5, cy, 5 + i * 4, -Math.PI / 3.2, Math.PI / 3.2);
    ctx.stroke();
  }

  if (volume <= 0) {
    ctx.strokeStyle = '#ff5a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + h - 5);
    ctx.lineTo(x + w - 5, y + 5);
    ctx.stroke();
  }
  ctx.restore();

  if (toast) {
    screen.text(toast, x - 8, y + 7, { size: 8, color: '#ffd85a', align: 'right' });
  }
}
