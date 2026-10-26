/**
 * Test-only evaluator used to *independently* verify that a topic's
 * "correct" flags match the mathematics, rather than trusting the generator
 * that produced them.
 *
 * Supports: integers/decimals, + - * / ^, parentheses, unary minus, postfix %,
 * implicit multiplication (2x, 3(4), 2pi), the constants pi and e, and the
 * functions sqrt, abs, log (base 10), ln, exp, sin, cos, tan (degrees).
 */

export class EvalError extends Error {}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: (a) => Math.sqrt(a),
  abs: (a) => Math.abs(a),
  log: (a) => Math.log10(a),
  ln: (a) => Math.log(a),
  exp: (a) => Math.exp(a),
  sin: (deg) => roundTiny(Math.sin((deg * Math.PI) / 180)),
  cos: (deg) => roundTiny(Math.cos((deg * Math.PI) / 180)),
  tan: (deg) => roundTiny(Math.tan((deg * Math.PI) / 180)),
};

const roundTiny = (n: number): number => (Math.abs(n) < 1e-12 ? 0 : n);

export function normalize(input: string): string {
  return input
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/[−–—]/g, '-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .trim();
}

export function tokenize(input: string, variables: Set<string>): Token[] {
  const src = normalize(input);
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === ' ') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      const raw = src.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new EvalError(`bad number ${raw}`);
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j]!)) j++;
      const word = src.slice(i, j).toLowerCase();
      // "3x4" uses x as multiplication; "2x+3" uses x as a variable. The
      // presence of an x variable decides which reading applies.
      if ((word === 'x') && !variables.has('x')) {
        tokens.push({ kind: 'op', value: '*' });
      } else {
        tokens.push({ kind: 'ident', value: word });
      }
      i = j;
      continue;
    }
    if ('+-*/^%'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === '[') {
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')' || ch === ']') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (src.startsWith('>=', i) || src.startsWith('<=', i)) {
      tokens.push({ kind: 'op', value: src.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if ('<>=!'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch });
      i++;
      continue;
    }
    throw new EvalError(`unexpected character "${ch}" in ${input}`);
  }
  void variables;
  return tokens;
}

interface ParserState {
  tokens: Token[];
  pos: number;
  variables: Record<string, number>;
  strict: boolean;
}

const peek = (p: ParserState): Token | undefined => p.tokens[p.pos];
const next = (p: ParserState): Token | undefined => p.tokens[p.pos++];

function parseExpression(p: ParserState): number {
  let left = parseTerm(p);
  for (;;) {
    const token = peek(p);
    if (token?.kind === 'op' && (token.value === '+' || token.value === '-')) {
      next(p);
      const right = parseTerm(p);
      left = token.value === '+' ? left + right : left - right;
      continue;
    }
    return left;
  }
}

const startsPrimary = (token: Token | undefined): boolean =>
  token?.kind === 'num' || token?.kind === 'ident' || token?.kind === 'lparen';

function parseTerm(p: ParserState): number {
  let left = parsePower(p);
  for (;;) {
    const token = peek(p);
    if (token?.kind === 'op' && (token.value === '*' || token.value === '/')) {
      next(p);
      const right = parsePower(p);
      left = token.value === '*' ? left * right : left / right;
      continue;
    }
    // Implicit multiplication: 2x, 3(4), 2pi, x y
    if (startsPrimary(token)) {
      left *= parsePower(p);
      continue;
    }
    return left;
  }
}

function parsePower(p: ParserState): number {
  const base = parseUnary(p);
  const token = peek(p);
  if (token?.kind === 'op' && token.value === '^') {
    next(p);
    const exponent = parsePower(p);
    return base ** exponent;
  }
  return base;
}

function parseUnary(p: ParserState): number {
  const token = peek(p);
  if (token?.kind === 'op' && (token.value === '-' || token.value === '+')) {
    next(p);
    const value = parseUnary(p);
    return token.value === '-' ? -value : value;
  }
  return parsePostfix(p);
}

function parsePostfix(p: ParserState): number {
  let value = parsePrimary(p);
  while (peek(p)?.kind === 'op' && (peek(p) as { value: string }).value === '%') {
    next(p);
    value /= 100;
  }
  return value;
}

function parsePrimary(p: ParserState): number {
  const token = next(p);
  if (!token) throw new EvalError('unexpected end of expression');
  if (token.kind === 'num') return token.value;
  if (token.kind === 'lparen') {
    const value = parseExpression(p);
    const close = next(p);
    if (close?.kind !== 'rparen') throw new EvalError('missing )');
    return value;
  }
  if (token.kind === 'ident') {
    const name = token.value;
    if (name === 'pi') return Math.PI;
    if (name === 'e') return Math.E;
    if (name in FUNCTIONS) {
      const open = next(p);
      if (open?.kind !== 'lparen') throw new EvalError(`${name} needs (`);
      const arg = parseExpression(p);
      const close = next(p);
      if (close?.kind !== 'rparen') throw new EvalError(`missing ) after ${name}`);
      return FUNCTIONS[name]!(arg);
    }
    if (name in p.variables) return p.variables[name]!;
    if (p.strict) throw new EvalError(`unknown symbol ${name}`);
    // Lenient mode: treat an unknown single letter as 0 so partially symbolic
    // tiles still produce a number.
    return 0;
  }
  throw new EvalError(`unexpected ${JSON.stringify(token)}`);
}

export interface EvalOptions {
  variables?: Record<string, number>;
  strict?: boolean;
}

/** Evaluate an arithmetic expression to a number. */
export function evaluate(input: string, options: EvalOptions = {}): number {
  const variables = options.variables ?? {};
  const tokens = tokenize(input, new Set(Object.keys(variables)));
  const state: ParserState = {
    tokens,
    pos: 0,
    variables,
    strict: options.strict ?? true,
  };
  const value = parseExpression(state);
  if (state.pos !== tokens.length) {
    throw new EvalError(`trailing input in ${input}`);
  }
  if (!Number.isFinite(value) && !Number.isNaN(value)) {
    throw new EvalError(`non-finite result for ${input}`);
  }
  return roundTiny(value);
}

/** True when two algebraic expressions agree at every sample point. */
export function equivalent(a: string, b: string, samples: number[] = [-3, -2, -1, 0, 1, 2, 3, 5]): boolean {
  let compared = 0;
  for (const x of samples) {
    let left: number;
    let right: number;
    try {
      left = evaluate(a, { variables: { x } });
      right = evaluate(b, { variables: { x } });
    } catch {
      continue;
    }
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    if (Math.abs(left - right) > 1e-9) return false;
    compared++;
  }
  return compared > 0;
}

/** Evaluate a comparison such as "> 12" against a tile value. */
export function compare(tileValue: number, comparison: string): boolean {
  const match = comparison.trim().match(/^(>=|<=|>|<|=)\s*(.+)$/);
  if (!match) throw new EvalError(`bad comparison ${comparison}`);
  const [, op, rhsRaw] = match;
  const rhs = evaluate(rhsRaw!);
  switch (op) {
    case '>':
      return tileValue > rhs;
    case '<':
      return tileValue < rhs;
    case '>=':
      return tileValue >= rhs;
    case '<=':
      return tileValue <= rhs;
    default:
      return Math.abs(tileValue - rhs) < 1e-9;
  }
}

/** Normalise a fraction/percent/decimal tile to a single decimal value. */
export function toValue(text: string): number {
  const cleaned = text.replace(/^\((.*)\)$/, '$1').trim();
  return evaluate(cleaned);
}
