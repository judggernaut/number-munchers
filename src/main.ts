import './style.css';

import { Audio } from './engine/audio';
import { Input } from './engine/input';
import { Music } from './engine/music';
import { Screen, VIEW_H, VIEW_W } from './engine/screen';
import { loadSprites } from './engine/sprites';
import { App } from './ui/app';

function fitCanvas(canvas: HTMLCanvasElement): void {
  const apply = (): void => {
    const raw = Math.min(window.innerWidth / VIEW_W, (window.innerHeight - 24) / VIEW_H);
    // Integer scale at 1x and above keeps every pixel square; below 1x we let
    // it shrink fractionally so small phones still fit the whole board.
    const scale = raw >= 1 ? Math.floor(raw * 2) / 2 : Math.max(0.4, raw);
    canvas.style.width = `${Math.round(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.round(VIEW_H * scale)}px`;
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('screen');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing #screen canvas');
  }
  fitCanvas(canvas);

  const screen = new Screen(canvas);
  const input = new Input(canvas);
  const audio = new Audio();
  const sprites = await loadSprites();

  const music = new Music(0.08);
  await music.load();

  const app = new App(screen, input, audio, sprites, music);
  app.start();

  // Autoplay rules need a real gesture; the first one starts the playlist.
  const kick = (): void => {
    music.start();
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
  };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);

  canvas.addEventListener('pointerdown', () => canvas.focus());
  canvas.setAttribute('tabindex', '0');
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const node = document.getElementById('a11y-status');
  if (node) node.textContent = `Failed to start: ${message}`;
  // Draw the failure on the canvas so it is never a blank screen.
  const canvas = document.getElementById('screen');
  if (canvas instanceof HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000574';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('Number Munchers failed to start', 24, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(message.slice(0, 90), 24, 70);
    }
  }
  console.error(error);
});
