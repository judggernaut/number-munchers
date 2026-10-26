import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import type { Round, Topic } from '../types';
import { algebraTopics } from './algebra';

// ---------------------------------------------------------------------------
// A tiny independent expression evaluator used to check the content.
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

const POINTS = [0.37, 1.3, -1.7, 2.1, -2.3, 3.0];

function sameAtPoints(a: string, b: string, points: readonly number[] = POINTS): boolean {
  for (const x of points) {
    const av = evalExpr(a, { x });
    const bv = evalExpr(b, { x });
    if (av === undefined || bv === undefined || !closeTo(av, bv)) return false;
  }
  return true;
}

interface Relation {
  lhs: string;
  op: '=' | '>' | '<' | '>=' | '<=';
  rhs: string;
}

function relationOf(text: string): Relation {
  const match = text.match(/^(.+?)(>=|<=|=|>|<)(.+)$/);
  if (!match) throw new Error(`Not a relation: ${text}`);
  return { lhs: match[1]!, op: match[2] as Relation['op'], rhs: match[3]! };
}

function relationHolds(relation: Relation, env: Env): boolean {
  const lhs = evalExpr(relation.lhs, env);
  const rhs = evalExpr(relation.rhs, env);
  if (lhs === undefined || rhs === undefined) return false;
  if (relation.op === '=') return closeTo(lhs, rhs);
  if (relation.op === '>') return lhs > rhs + 1e-9;
  if (relation.op === '<') return lhs < rhs - 1e-9;
  if (relation.op === '>=') return lhs >= rhs - 1e-9;
  return lhs <= rhs + 1e-9;
}

interface QuadCoeffs {
  a: number;
  b: number;
  c: number;
}

function quadCoeffs(expression: string): QuadCoeffs {
  const at0 = evalExpr(expression, { x: 0 });
  const at1 = evalExpr(expression, { x: 1 });
  const atMinus1 = evalExpr(expression, { x: -1 });
  if (at0 === undefined || at1 === undefined || atMinus1 === undefined) {
    throw new Error(`Cannot read quadratic ${expression}`);
  }
  const a = (at1 + atMinus1) / 2 - at0;
  const b = (at1 - atMinus1) / 2;
  return { a, b, c: at0 };
}

// ---------------------------------------------------------------------------
// Generic round checks
// ---------------------------------------------------------------------------

const SAMPLE_SEEDS = [1, 7, 13, 19, 25];
const SAMPLE_LEVELS = [1, 4, 8, 12, 16, 20];

function checkRound(topic: Topic, round: Round): void {
  expect(round.tiles).toHaveLength(30);
  expect(round.heading.length).toBeGreaterThan(0);
  expect(round.instruction.length).toBeGreaterThan(0);
  expect(round.correctCount).toBeGreaterThanOrEqual(8);
  expect(round.correctCount).toBeLessThanOrEqual(12);

  const correct = round.tiles.filter((t) => t.correct).length;
  expect(correct, `${topic.id}: correct count`).toBe(round.correctCount);

  const seen = new Set<string>();
  for (const tile of round.tiles) {
    expect(tile.text.length, `${topic.id}: empty tile`).toBeGreaterThan(0);
    expect(tile.text.length, `${topic.id}: tile too long: ${tile.text}`).toBeLessThanOrEqual(9);
    expect(/^[\x20-\x7E]+$/.test(tile.text), `${topic.id}: non-ASCII tile: ${tile.text}`).toBe(true);
    expect(tile.text, `${topic.id}: space in tile`).not.toContain(' ');
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

const verifiers: Record<string, (round: Round) => void> = {
  'evaluate-expressions': (round) => {
    const x = Number(round.heading.match(/^x = (-?\d+)$/)![1]);
    const target = Number(round.instruction.match(/equal to (-?\d+)/)![1]);
    for (const tile of round.tiles) {
      const value = evalExpr(tile.text, { x });
      expect(value !== undefined && closeTo(value, target), `${tile.text} at x=${x} should ${tile.correct ? '' : 'not '}be ${target}`).toBe(tile.correct);
    }
  },

  'solve-linear': (round) => {
    const relation = relationOf(round.heading);
    for (const tile of round.tiles) {
      const value = evalExpr(tile.text);
      expect(value, `${tile.text} should be a number`).toBeDefined();
      const ok = relationHolds(relation, { x: value! });
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}solve ${round.heading}`).toBe(tile.correct);
    }
  },

  'linear-inequalities': (round) => {
    const relation = relationOf(round.heading);
    for (const tile of round.tiles) {
      const value = evalExpr(tile.text);
      expect(value, `${tile.text} should be a number`).toBeDefined();
      const ok = relationHolds(relation, { x: value! });
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}satisfy ${round.heading}`).toBe(tile.correct);
    }
  },

  slope: (round) => {
    const points = round.heading.match(/^\((-?\d+),(-?\d+)\) to \((-?\d+),(-?\d+)\)$/);
    let slope: number | null;
    if (points) {
      const [x1, y1, x2, y2] = points.slice(1).map(Number) as [number, number, number, number];
      slope = x1 === x2 ? null : (y2 - y1) / (x2 - x1);
    } else if (/^y=/.test(round.heading)) {
      const rhs = round.heading.slice(2);
      const at0 = evalExpr(rhs, { x: 0 });
      const at1 = evalExpr(rhs, { x: 1 });
      expect(at0).toBeDefined();
      expect(at1).toBeDefined();
      slope = at1! - at0!;
    } else {
      throw new Error(`Unrecognised slope heading: ${round.heading}`);
    }
    for (const tile of round.tiles) {
      const value = tile.text === 'undef' ? undefined : evalExpr(tile.text);
      const ok = slope === null ? value === undefined : value !== undefined && closeTo(value, slope);
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal slope ${String(slope)}`).toBe(tile.correct);
    }
  },

  systems: (round) => {
    const relations = round.heading.split(';').map(relationOf);
    for (const tile of round.tiles) {
      const match = tile.text.match(/^\((.+),(.+)\)$/);
      expect(match, `${tile.text} should be an ordered pair`).not.toBeNull();
      const x = evalExpr(match![1]!);
      const y = evalExpr(match![2]!);
      expect(x, `${tile.text} x-coordinate`).toBeDefined();
      expect(y, `${tile.text} y-coordinate`).toBeDefined();
      const ok = relations.every((relation) => relationHolds(relation, { x: x!, y: y! }));
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}solve ${round.heading}`).toBe(tile.correct);
    }
  },

  polynomials: (round) => {
    const target = round.heading;
    for (const tile of round.tiles) {
      const ok = sameAtPoints(tile.text, target);
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal ${target}`).toBe(tile.correct);
    }
  },

  factoring: (round) => {
    const polynomial = round.heading.replace(/^Factors of /, '');
    const { a, b, c } = quadCoeffs(polynomial);
    for (const tile of round.tiles) {
      const match = tile.text.match(/^(-?\d*)x([+-]\d+)?$/);
      expect(match, `${tile.text} should be a binomial`).not.toBeNull();
      const raw = match![1]!;
      const k = raw === '' || raw === '+' ? 1 : raw === '-' ? -1 : Number(raw);
      const constant = match![2] === undefined ? 0 : Number(match![2]);
      const root = -constant / k;
      const value = a * root * root + b * root + c;
      const ok = Math.abs(value) < 1e-7;
      expect(ok, `${tile.text} has root ${root}; p(root) = ${value}`).toBe(tile.correct);
    }
  },

  quadratics: (round) => {
    const polynomial = round.heading.replace(/^Roots of /, '');
    const { a, b, c } = quadCoeffs(polynomial);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      const signWords = new Set(['D<0', 'disc<0', 'neg', 'negative', 'b^2-4ac<0', 'noroots', 'noreal']);
      for (const tile of round.tiles) {
        const value = evalExpr(tile.text);
        const ok =
          signWords.has(tile.text) ||
          tile.text === `D=${discriminant}` ||
          (value !== undefined && closeTo(value, discriminant));
        expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}indicate a negative discriminant`).toBe(tile.correct);
      }
      return;
    }
    const rootA = (-b + Math.sqrt(discriminant)) / (2 * a);
    const rootB = (-b - Math.sqrt(discriminant)) / (2 * a);
    for (const tile of round.tiles) {
      const value = evalExpr(tile.text);
      const ok = value !== undefined && (closeTo(value, rootA) || closeTo(value, rootB));
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}be a root of ${polynomial}`).toBe(tile.correct);
    }
  },

  'exponent-rules': (round) => {
    for (const tile of round.tiles) {
      const ok = sameAtPoints(tile.text, round.heading);
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal ${round.heading}`).toBe(tile.correct);
    }
  },

  functions: (round) => {
    const match = round.heading.match(/^f\(x\)=(.+), x=(-?\d+)$/);
    expect(match).not.toBeNull();
    const expression = match![1]!;
    const x = Number(match![2]);
    const target = evalExpr(expression, { x });
    expect(target, `f(${x}) should be defined`).toBeDefined();
    for (const tile of round.tiles) {
      const value = evalExpr(tile.text);
      const ok = value !== undefined && closeTo(value, target!);
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal f(${x})=${target}`).toBe(tile.correct);
    }
  },

  sequences: (round) => {
    const body = round.heading.replace(/\.\.\.$/, '');
    const terms = body.split(',').map(Number);
    const arithmetic = closeTo(terms[1]! - terms[0]!, terms[2]! - terms[1]!);
    const ratio = terms[1]! / terms[0]!;
    const isMember = (value: number): boolean => {
      if (arithmetic) {
        const k = (value - terms[0]!) / (terms[1]! - terms[0]!);
        return Math.abs(k - Math.round(k)) < 1e-9 && Math.round(k) >= 0;
      }
      if (value <= 0) return false;
      let t = value / terms[0]!;
      while (t > 1 + 1e-9 && Math.abs(t / ratio - Math.round(t / ratio)) < 1e-9) t /= ratio;
      return closeTo(t, 1);
    };
    for (const tile of round.tiles) {
      const ok = isMember(Number(tile.text));
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}be a term of ${round.heading}`).toBe(tile.correct);
    }
  },

  logs: (round) => {
    const target = evalExpr(round.heading);
    expect(target, `log heading ${round.heading}`).toBeDefined();
    for (const tile of round.tiles) {
      const value = evalExpr(tile.text);
      const ok = value !== undefined && closeTo(value, target!);
      expect(ok, `${tile.text} should ${tile.correct ? '' : 'not '}equal ${round.heading}=${target}`).toBe(tile.correct);
    }
  },
};

describe('algebra topics', () => {
  it('exports every promised topic', () => {
    expect(algebraTopics.map((topic) => topic.id)).toEqual([
      'evaluate-expressions',
      'solve-linear',
      'linear-inequalities',
      'slope',
      'systems',
      'polynomials',
      'factoring',
      'quadratics',
      'exponent-rules',
      'functions',
      'sequences',
      'logs',
    ]);
  });

  for (const topic of algebraTopics) {
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
