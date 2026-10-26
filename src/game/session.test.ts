import { describe, expect, it } from 'vitest';

import { createRng } from '../content/rng';
import type { Round, Topic, Tile } from '../content/types';
import type { Sprites } from '../engine/sprites';
import { RULES, type RuleSet } from './rules';
import { GameSession } from './session';
import type { Troggle } from './troggle';

const stubSprites = {} as Sprites;

/** Build a round with an explicit layout so tests control the board exactly. */
function roundWith(explicit: Array<Partial<Tile>>): Round {
  const tiles: Tile[] = Array.from({ length: 30 }, (_, i) => {
    const override = explicit[i] ?? {};
    return {
      text: override.text ?? `x${i}`,
      correct: override.correct ?? false,
    };
  });
  return {
    heading: 'Test board',
    instruction: 'Munch the right things.',
    tiles,
    correctCount: tiles.filter((t) => t.correct).length,
    explain: (text) => `${text} is wrong.`,
  };
}

function makeTopic(round: () => Round): Topic {
  return {
    id: 'stub',
    name: 'Stub Topic',
    family: 'number',
    band: 'elementary',
    grades: 'Grades 3-5',
    blurb: 'test',
    round,
  };
}

const fastRules: RuleSet = {
  ...RULES,
  troggleTickMs: () => 100,
  spawnChance: () => 0,
  maxTroggles: () => 0,
};

function session(round: Round, overrides: Partial<RuleSet> = {}) {
  const topic = makeTopic(() => round);
  return new GameSession({
    sprites: stubSprites,
    rng: createRng(1),
    difficulty: 'normal',
    rules: { ...fastRules, ...overrides },
    roundFor: () => ({ topic, round }),
  });
}

const index = (col: number, row: number): number => row * 6 + col;

describe('session scoring and lives', () => {
  it('starts on an empty centre cell with three lives', () => {
    const game = session(roundWith([{ text: '7', correct: true }]));
    expect(game.lives).toBe(3);
    expect(game.score).toBe(0);
    expect(game.cells[index(2, 2)]!.text).toBe('');
    expect(game.cells[index(2, 2)]!.eaten).toBe(true);
  });

  it('awards 5 points for a correct munch', () => {
    const board = roundWith([{ text: '7', correct: true }]);
    const game = session(board);
    // (2,1) is directly above the muncher's start cell.
    game.cells[index(2, 1)] = { text: '7', correct: true, eaten: false };
    game.update(200, ['up'], null);
    expect(game.muncherCell).toEqual({ col: 2, row: 1 });
    game.update(16, ['munch'], null);
    expect(game.score).toBe(5);
    expect(game.lives).toBe(3);
    expect(game.cells[index(2, 1)]!.eaten).toBe(true);
  });

  it('costs a life and explains a wrong munch', () => {
    const game = session(roundWith([]));
    game.cells[index(2, 1)] = { text: 'oops', correct: false, eaten: false };
    game.update(200, ['up'], null);
    game.update(16, ['munch'], null);
    expect(game.lives).toBe(2);
    expect(game.status).toBe('wrong');
    expect(game.message).toContain('oops');
    expect(game.prompt).toContain('SPACE');

    // Space resumes play without consuming another life.
    game.update(16, ['munch'], null);
    expect(game.status).toBe('play');
    expect(game.lives).toBe(2);
  });

  it('clears the level when the last correct tile is eaten', () => {
    const game = session(roundWith([]));
    game.cells[index(2, 1)] = { text: 'ok', correct: true, eaten: false };
    game.update(200, ['up'], null);
    game.update(16, ['munch'], null);
    expect(game.status).toBe('clear');
    expect(game.score).toBe(5);

    game.update(16, ['confirm'], null);
    expect(game.level).toBe(2);
    expect(game.status).toBe('play');
  });

  it('ends the game when the last life is lost', () => {
    const board = roundWith([]);
    const game = session(board);
    const events: string[] = [];
    const watched = new GameSession({
      sprites: stubSprites,
      rng: createRng(3),
      difficulty: 'normal',
      rules: fastRules,
      roundFor: () => ({ topic: makeTopic(() => board), round: board }),
      onEvent: (event) => events.push(event.type),
      lives: 1,
    });
    watched.cells[index(2, 1)] = { text: 'nope', correct: false, eaten: false };
    watched.update(200, ['up'], null);
    watched.update(16, ['munch'], null);
    expect(watched.lives).toBe(0);
    expect(watched.status).toBe('gameover');
    expect(events).toContain('wrong');
    expect(events).toContain('gameOver');
    void game;
  });
});

describe('muncher movement', () => {
  it('moves exactly one cell per arrow press', () => {
    const game = session(roundWith([]));
    game.update(16, ['up'], null);
    expect(game.muncherCell).toEqual({ col: 2, row: 1 });
    // A slow frame must not turn one press into two moves.
    game.update(400, ['up'], null);
    expect(game.muncherCell).toEqual({ col: 2, row: 0 });
  });

  it('does not double-move when the key is still held after a press', () => {
    const game = session(roundWith([]));
    // Frame 1: keydown -> queued action while the key is also held.
    game.update(16, ['left'], { dc: -1, dr: 0 });
    expect(game.muncherCell).toEqual({ col: 1, row: 2 });
    // Frame 2..10: still held, but inside the repeat delay window.
    for (let i = 0; i < 10; i++) game.update(16, [], { dc: -1, dr: 0 });
    expect(game.muncherCell).toEqual({ col: 1, row: 2 });
  });

  it('auto-repeats only after the hold delay', () => {
    const game = session(roundWith([]));
    game.update(16, ['down'], { dc: 0, dr: 1 });
    expect(game.muncherCell).toEqual({ col: 2, row: 3 });
    // 640 ms of holding is past the 260 ms delay plus a step, so it must repeat.
    for (let i = 0; i < 40; i++) game.update(16, [], { dc: 0, dr: 1 });
    expect(game.muncherCell.row).toBeGreaterThan(3);
  });

  it('walks toward a clicked cell at a steady cadence', () => {
    const game = session(roundWith([]));
    game.pointTo({ col: 4, row: 2 });
    for (let i = 0; i < 30; i++) game.update(16, [], null);
    expect(game.muncherCell).toEqual({ col: 4, row: 2 });
  });
});

describe('session troggle pressure', () => {
  it('loses a life when a troggle walks onto the muncher', () => {
    const board = roundWith([]);
    const game = session(board, { troggleTickMs: () => 50 });
    const hunter: Troggle = {
      id: 9,
      species: 'smarty',
      col: 2,
      row: 1,
      dir: { dc: 0, dr: 1 },
      fromCol: 2,
      fromRow: 1,
      steppedAt: 0,
    };
    game.troggles = [hunter];
    game.update(60, [], null);
    expect(game.lives).toBe(2);
    expect(game.status).toBe('eaten');
    expect(game.troggles).toHaveLength(0);
    expect(game.muncherCell).toEqual({ col: 2, row: 2 });
  });

  it('never walks the muncher off the board', () => {
    const game = session(roundWith([]));
    for (let i = 0; i < 12; i++) game.update(200, ['up'], null);
    expect(game.muncherCell).toEqual({ col: 2, row: 0 });
    for (let i = 0; i < 12; i++) game.update(200, ['down'], null);
    expect(game.muncherCell).toEqual({ col: 2, row: 4 });
  });
});
