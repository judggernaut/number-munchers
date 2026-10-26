/**
 * Dev-only harness: renders the board with synthetic tiles so the engine can be
 * eyeballed without the full curriculum. Not part of the shipped app.
 */
import { createRng } from './content/rng';
import type { Round, Topic } from './content/types';
import { Input } from './engine/input';
import { Screen } from './engine/screen';
import { loadSprites } from './engine/sprites';
import { GameSession } from './game/session';

const texts = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
  '14', '15', '16', '18', '20', '21', '22', '24', '25', '27', '30', '32',
  '33', '35', '36', '49', '64', '81',
];

function demoRound(): Round {
  // Real primality, so the harness can never display a dishonest board.
  const isPrime = (n: number): boolean => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  const tiles = texts.map((text) => ({ text, correct: isPrime(Number(text)) }));
  return {
    heading: 'Prime Numbers',
    instruction: 'Munch every prime number.',
    tiles,
    correctCount: tiles.filter((t) => t.correct).length,
    explain: (text) => `${text} is not prime.`,
  };
}

const topic: Topic = {
  id: 'sandbox',
  name: 'Sandbox',
  family: 'number',
  band: 'elementary',
  grades: 'Grades 4-8',
  blurb: 'dev harness',
  round: () => demoRound(),
};

async function boot(): Promise<void> {
  const canvas = document.getElementById('screen');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('no canvas');
  const screen = new Screen(canvas);
  const input = new Input(canvas);
  const sprites = await loadSprites();
  const rng = createRng(42);
  const round = demoRound();
  const session = new GameSession({
    sprites,
    rng,
    difficulty: 'normal',
    roundFor: () => ({ topic, round }),
  });

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(48, now - last);
    last = now;
    const dir = input.isHeld('up')
      ? { dc: 0, dr: -1 }
      : input.isHeld('down')
        ? { dc: 0, dr: 1 }
        : input.isHeld('left')
          ? { dc: -1, dr: 0 }
          : input.isHeld('right')
            ? { dc: 1, dr: 0 }
            : null;
    session.update(dt, input.drain(), dir);
    session.draw(screen, now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

void boot();
