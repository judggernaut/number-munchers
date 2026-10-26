/**
 * Independent helpers for the content tests.
 *
 * These deliberately do NOT reuse anything from the generators: the tests
 * parse and evaluate tile text themselves so a generator bug cannot make its
 * own flags look correct.
 */

export const MAX_TILE_LENGTH = 9;
export const ASCII_ONLY = /^[\x20-\x7E]+$/;

export const isUndefinedTile = (text: string): boolean =>
  ['undef', 'undefined', 'novalue', 'DNE', '1/0', '-1/0', 'x/0', 'infinite', 'NaN', 'noanswer'].includes(text);

type Vars = Record<string, number>;

/** Recursive-descent evaluator for the compact expressions used on tiles. */
class Parser {
  private readonly tokens: string[];
  private pos = 0;

  constructor(text: string, private readonly vars: Vars, private readonly pi: number) {
    const normalized = text
      .replace(/\s+/g, '')
      .replace(/deg|rad/g, '')
      .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')
      .replace(/π/g, 'pi');
    this.tokens = normalized.match(/\d*\.\d+|\d+|[A-Za-z]+|[()+\-*/^]/g) ?? [];
  }

  parse(): number {
    const value = this.expression();
    if (this.pos !== this.tokens.length) throw new Error('trailing tokens');
    return value;
  }

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private take(): string | undefined {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expression(): number {
    let value = this.term();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.take();
      const rhs = this.term();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  private term(): number {
    let value = this.unary();
    for (;;) {
      const token = this.peek();
      if (token === '*') {
        this.take();
        value *= this.unary();
      } else if (token === '/') {
        this.take();
        value /= this.unary();
      } else if (token !== undefined && this.startsPrimary(token)) {
        value *= this.unary();
      } else {
        break;
      }
    }
    return value;
  }

  private unary(): number {
    if (this.peek() === '-') {
      this.take();
      return -this.unary();
    }
    if (this.peek() === '+') {
      this.take();
      return this.unary();
    }
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    if (this.peek() === '^') {
      this.take();
      return base ** this.unary();
    }
    return base;
  }

  private startsPrimary(token: string): boolean {
    return /^(\d|\.\d)/.test(token) || token === '(' || /^[A-Za-z]/.test(token);
  }

  private primary(): number {
    const token = this.take();
    if (token === undefined) throw new Error('unexpected end');
    if (token === '(') {
      const value = this.expression();
      if (this.take() !== ')') throw new Error('missing )');
      return value;
    }
    if (/^(\d|\.\d)/.test(token)) return Number(token);
    if (/^[A-Za-z]/.test(token)) {
      const fn = token;
      if (fn === 'sqrt') return Math.sqrt(this.functionArgument());
      if (fn === 'sin') return Math.sin(this.functionArgument(true));
      if (fn === 'cos') return Math.cos(this.functionArgument(true));
      if (fn === 'tan') return Math.tan(this.functionArgument(true));
      if (fn === 'abs') return Math.abs(this.functionArgument());
      if (fn === 'pi') return this.pi;
      if (fn === 'x' || fn === 's' || fn === 'c' || fn === 't') return this.vars[fn] ?? 0;
      throw new Error(`unknown identifier ${fn}`);
    }
    throw new Error(`unexpected token ${token}`);
  }

  private functionArgument(degrees = false): number {
    const value = this.peek() === '(' ? this.primary() : this.unary();
    return degrees ? value : value;
  }
}

export function evalArith(text: string, vars: Vars = {}, pi = Math.PI): number | null {
  try {
    const value = new Parser(text, vars, pi).parse();
    return value;
  } catch {
    return null;
  }
}

/** Evaluate a pi-form tile using the same 3.14 convention as the game. */
export function evalPiTile(text: string): number | null {
  return evalArith(text, {}, 3.14);
}

export function close(a: number, b: number, tolerance = 1e-8): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Normalise the compact identity notation used by the identity tiles. */
export function normalizeIdentity(text: string): string {
  let s = text.replace(/\s+/g, '');
  s = s
    .replace(/sin\^2\(x\)/g, 'sin(x)^2')
    .replace(/cos\^2\(x\)/g, 'cos(x)^2')
    .replace(/tan\^2\(x\)/g, 'tan(x)^2')
    .replace(/sin\^2x/g, 'sin(x)^2')
    .replace(/cos\^2x/g, 'cos(x)^2')
    .replace(/tan\^2x/g, 'tan(x)^2')
    .replace(/sin\^2/g, 'sin(x)^2')
    .replace(/cos\^2/g, 'cos(x)^2')
    .replace(/tan\^2/g, 'tan(x)^2')
    .replace(/sin2x/g, 'sin(2*x)')
    .replace(/cos2x/g, 'cos(2*x)')
    .replace(/tan2x/g, 'tan(2*x)')
    .replace(/sinx/g, 'sin(x)')
    .replace(/cosx/g, 'cos(x)')
    .replace(/tanx/g, 'tan(x)')
    .replace(/\bs\b/g, 'sin(x)')
    .replace(/\bc\b/g, 'cos(x)')
    .replace(/\bt\b/g, 'tan(x)');
  return s;
}

export function evalIdentity(text: string, x: number): number | null {
  const normalized = normalizeIdentity(text);
  return evalArith(normalized, { x, s: Math.sin(x), c: Math.cos(x), t: Math.tan(x) }, Math.PI);
}
