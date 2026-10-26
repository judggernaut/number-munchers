import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import type { Round, Topic } from '../types';
import { precalculusTopics } from './precalculus';

// ---------------------------------------------------------------------------
// Independent expression evaluator
// ---------------------------------------------------------------------------

type Env = Record<string, number>;

function tokenize(source: string): string[] {
  const text = source.replace(/\s+/g, '');
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < text.length && /[0-9.]/.test(text[j]!)) j++;
      out.push(text.slice(i, j));
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < text.length && /[a-zA-Z]/.test(text[j]!)) j++;
      while (j < text.length && /[0-9]/.test(text[j]!)) j++;
      out.push(text.slice(i, j));
      i = j;
      continue;
    }
    if ('+-*/^(),'.includes(c)) {
      out.push(c);
      i++;
      continue;
    }
    throw new Error(`Unexpected character ${c} in ${source}`);
  }
  return out;
}

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: string[],
    private readonly env: Env,
  ) {}

  parse(): number {
    const value = this.expr();
    if (this.pos !== this.tokens.length) throw new Error(`Trailing tokens: ${this.tokens.slice(this.pos).join(' ')}`);
    return value;
  }

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private take(): string {
    const token = this.tokens[this.pos];
    if (token === undefined) throw new Error('Unexpected end of expression');
    this.pos++;
    return token;
  }

  private expect(token: string): void {
    if (this.take() !== token) throw new Error(`Expected ${token}`);
  }

  private startsAtom(token: string | undefined): boolean {
    return token !== undefined && (/^[0-9.]/.test(token) || /^[a-zA-Z]/.test(token) || token === '(');
  }

  private expr(): number {
    let value = this.term();
    for (;;) {
      const op = this.peek();
      if (op !== '+' && op !== '-') return value;
      this.pos++;
      const rhs = this.term();
      value = op === '+' ? value + rhs : value - rhs;
    }
  }

  private term(): number {
    let value = this.unary();
    for (;;) {
      const op = this.peek();
      if (op === '*') {
        this.pos++;
        value *= this.unary();
      } else if (op === '/') {
        this.pos++;
        const divisor = this.unary();
        value = divisor === 0 ? NaN : value / divisor;
      } else if (this.startsAtom(op)) {
        value *= this.unary();
      } else {
        return value;
      }
    }
  }

  private unary(): number {
    const op = this.peek();
    if (op === '+') {
      this.pos++;
      return this.unary();
    }
    if (op === '-') {
      this.pos++;
      return -this.unary();
    }
    return this.power();
  }

  private power(): number {
    const base = this.atom();
    if (this.peek() !== '^') return base;
    this.pos++;
    return base ** this.unary();
  }

  private atom(): number {
    const token = this.take();
    if (/^[0-9.]/.test(token)) return Number(token);
    if (token === '(') {
      const value = this.expr();
      this.expect(')');
      return value;
    }
    if (/^[a-zA-Z]/.test(token)) {
      if (token === 'e') return Math.E;
      if (token === 'pi') return Math.PI;
      if (token === 'log2' || token === 'log' || token === 'ln' || token === 'sqrt' || token === 'abs') {
        this.expect('(');
        const arg = this.expr();
        this.expect(')');
        if (token === 'log2') return Math.log2(arg);
        if (token === 'log') return Math.log10(arg);
        if (token === 'ln') return Math.log(arg);
        if (token === 'sqrt') return Math.sqrt(arg);
        return Math.abs(arg);
      }
      const value = this.env[token];
      return value === undefined ? NaN : value;
    }
    throw new Error(`Unexpected token ${token}`);
  }
}

function evalExpr(source: string, env: Env = {}): number | undefined {
  try {
    const value = new Parser(tokenize(source), env).parse();
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

const closeTo = (a: number, b: number, tolerance = 1e-6): boolean =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

function sameAtPoints(a: string, b: string, points: readonly number[]): boolean {
  for (const x of points) {
    const av = evalExpr(a, { x });
    const bv = evalExpr(b, { x });
    if (av === undefined || bv === undefined || !closeTo(av, bv)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Generic checks
// ---------------------------------------------------------------------------

const SAMPLE_SEEDS = [1, 7, 13, 19, 25];
const SAMPLE_LEVELS = [1, 4, 8, 12, 16, 20];

function checkRound(topic: Topic, round: Round): void {
  expect(round.tiles).toHaveLength(30);
  expect(round.heading.length).toBeGreaterThan(0);
  expect(round.instruction.length).toBeGreaterThan(0);
  expect(round.correctCount).toBeGreaterThanOrEqual(8);
  expect(round.correctCount).toBeLessThanOrEqual(12);

  expect(round.tiles.filter((tile) => tile.correct).length, `${topic.id}: correct count`).toBe(
    round.correctCount,
  );

  const seen = new Set<string>();
  for (const tile of round.tiles) {
    expect(tile.text.length).toBeGreaterThan(0);
    expect(tile.text.length, `${topic.id}: tile too long: ${tile.text}`).toBeLessThanOrEqual(9);
    expect(/^[\x20-\x7E]+$/.test(tile.text), `${topic.id}: non-ASCII tile: ${tile.text}`).toBe(true);
    expect(tile.text).not.toContain(' ');
    expect(seen.has(tile.text), `${topic.id}: duplicate tile ${tile.text}`).toBe(false);
    seen.add(tile.text);
    const explanation = round.explain(tile.text);
    expect(explanation.length, `${topic.id}: empty explanation for ${tile.text}`).toBeGreaterThan(0);
    expect(explanation, `${topic.id}: explanation should name ${tile.text}`).toContain(tile.text);
  }
}

function serialise(round: Round): string {
  return JSON.stringify({
    heading: round.heading,
    instruction: round.instruction,
    correctCount: round.correctCount,
    tiles: round.tiles,
    explanations: round.tiles.map((tile) => round.explain(tile.text)),
  });
}

// ---------------------------------------------------------------------------
// Per-topic independent verification
// ---------------------------------------------------------------------------

const DNE_WORDS = new Set(['DNE', 'nolimit', 'undefined', 'undef', 'none', 'notexist', 'doesnot', 'D.N.E.', 'novalue']);
const DIVERGES_WORDS = new Set(['DNE', 'diverges', 'nosum', 'inf', 'infinity', 'unbounded', 'nolimit', 'divergent', 'grows']);

const verifiers: Record<string, (round: Round) => void> = {
  'function-transformations': (round) => {
    const match = round.heading.match(/^g\(x\)=(.+), f\(x\)=(.+)$/);
    expect(match, round.heading).not.toBeNull();
    const g = match![1]!;
    const f = match![2]!;
    const composed = g.replace(/f\(x\)/g, `(${f})`);
    for (const tile of round.tiles) {
      const ok = sameAtPoints(tile.text, composed, [0, 1, 2, 0.37, -1.7, 3.0]);
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal ${composed}`).toBe(tile.correct);
    }
  },

  limits: (round) => {
    const match = round.heading.match(/^lim x->(-?\d+(?:\.\d+)?) (.+)$/);
    expect(match, round.heading).not.toBeNull();
    const a = Number(match![1]);
    const expression = match![2]!;
    const h = 1e-4;
    const left = evalExpr(expression, { x: a - h });
    const right = evalExpr(expression, { x: a + h });
    const doesNotExist =
      left === undefined || right === undefined || Math.abs(left - right) > 1e-2;
    if (doesNotExist) {
      for (const tile of round.tiles) {
        expect(DNE_WORDS.has(tile.text), `${tile.text} should ${tile.correct ? '' : 'not '}say DNE`).toBe(
          tile.correct,
        );
      }
      return;
    }
    const value = (left + right) / 2;
    for (const tile of round.tiles) {
      const got = evalExpr(tile.text);
      const ok = got !== undefined && Math.abs(got - value) <= 1e-2 * Math.max(1, Math.abs(value));
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal limit ${value}`).toBe(tile.correct);
    }
  },

  derivatives: (round) => {
    const match = round.heading.match(/^f\(x\)=(.+)$/);
    expect(match, round.heading).not.toBeNull();
    const f = match![1]!;
    const points = [-1.7, 0.6, 1.4, 2.3];
    for (const tile of round.tiles) {
      for (const x of points) {
        const h = 1e-5;
        const plus = evalExpr(f, { x: x + h });
        const minus = evalExpr(f, { x: x - h });
        expect(plus).toBeDefined();
        expect(minus).toBeDefined();
        const expected = (plus! - minus!) / (2 * h);
        const got = evalExpr(tile.text, { x });
        const ok = got !== undefined && Math.abs(got - expected) <= 1e-3 * Math.max(1, Math.abs(expected));
        expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal f'(${x})=${expected}`).toBe(
          tile.correct,
        );
        if (!tile.correct) break;
      }
    }
  },

  series: (round) => {
    const infinite = round.heading.endsWith('...');
    const body = round.heading
      .replace(/\.\.\./g, '')
      .replace(/\+\+/g, '+')
      .replace(/^\+/, '')
      .replace(/\+$/, '');
    const terms = body.split('+').map((term) => evalExpr(term));
    for (const term of terms) expect(term, round.heading).toBeDefined();
    const nums = terms as number[];

    if (infinite) {
      const ratio = nums[1]! / nums[0]!;
      if (Math.abs(ratio) >= 1 - 1e-9) {
        for (const tile of round.tiles) {
          expect(DIVERGES_WORDS.has(tile.text), `${tile.text} should ${tile.correct ? '' : 'not '}say diverges`).toBe(
            tile.correct,
          );
        }
        return;
      }
      const sum = nums[0]! / (1 - ratio);
      for (const tile of round.tiles) {
        const got = evalExpr(tile.text);
        const ok = got !== undefined && closeTo(got, sum);
        expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal sum ${sum}`).toBe(tile.correct);
      }
      return;
    }

    const d = nums[1]! - nums[0]!;
    const last = nums[nums.length - 1]!;
    let sum: number;
    if (closeTo(nums[2]! - nums[1]!, d)) {
      const n = Math.round((last - nums[0]!) / d) + 1;
      sum = (n * (nums[0]! + last)) / 2;
    } else {
      const ratio = nums[1]! / nums[0]!;
      const n = Math.round(Math.log(last / nums[0]!) / Math.log(ratio)) + 1;
      sum = (nums[0]! * (ratio ** n - 1)) / (ratio - 1);
    }
    for (const tile of round.tiles) {
      const got = evalExpr(tile.text);
      const ok = got !== undefined && closeTo(got, sum);
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal sum ${sum}`).toBe(tile.correct);
    }
  },
};

describe('precalculus topics', () => {
  it('exports every promised topic', () => {
    expect(precalculusTopics.map((topic) => topic.id)).toEqual([
      'function-transformations',
      'limits',
      'derivatives',
      'series',
    ]);
  });

  for (const topic of precalculusTopics) {
    describe(topic.id, () => {
      it('is deterministic for a fixed seed', () => {
        const run = (): Round => topic.round(createRng(0x5eed), 10);
        expect(serialise(run())).toBe(serialise(run()));
      });

      it('produces a well-formed board and usable explanations', () => {
        for (const seed of SAMPLE_SEEDS) {
          for (const level of SAMPLE_LEVELS) {
            checkRound(topic, topic.round(createRng(seed), level));
          }
        }
      });

      it('never throws for levels 1-20 across 20 seeds', () => {
        for (let seed = 1; seed <= 20; seed++) {
          for (let level = 1; level <= 20; level++) {
            expect(() => topic.round(createRng(seed), level)).not.toThrow();
          }
        }
      });

      it('has independently verified correct flags', () => {
        const verify = verifiers[topic.id];
        expect(verify, `missing verifier for ${topic.id}`).toBeDefined();
        for (let seed = 1; seed <= 20; seed++) {
          for (let level = 1; level <= 20; level++) {
            verify!(topic.round(createRng(seed), level));
          }
        }
      });
    });
  }
});
