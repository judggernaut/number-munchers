import { distinctInts, makeRound } from '../build';
import { type Rng, type Topic } from '../types';

/**
 * Arithmetic topics for Number Munchers.
 *
 * Every generator is a pure function of its `Rng` and level. Boards are built
 * through `makeRound`, which samples without replacement, drops duplicate
 * text and keeps distractors from colliding with correct answers.
 *
 * Tiles are deliberately short: 7 characters for number topics and 9 for
 * expression topics, matching the 64x64 px cells in the board.
 */

type Op = '+' | '-' | 'x' | '/';

const NUM_MAX = 7;
const EXPR_MAX = 9;

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value));

const uniq = (items: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
};

/** Integral values print plainly; no thousands separators fit in a cell. */
const fmtNum = (value: number): string => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
};

/** Plain decimal form, trailing zeroes trimmed: 0.75, 0.125, 37.5. */
const fmtDecimal = (value: number): string => {
  const text = value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return text === '-0' ? '0' : text;
};

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0 ? 1 : x;
};

interface Frac {
  n: number;
  d: number;
}

const frac = (n: number, d: number): Frac => {
  if (d === 0) return { n: 0, d: 1 };
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: Math.abs(d) / g };
};

const sameFrac = (a: Frac, b: Frac): boolean => a.n * b.d === b.n * a.d;

const fracAdd = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d + b.n * a.d, a.d * b.d);

const fracScale = (a: Frac, k: number): Frac => frac(a.n * k, a.d);

const fracKey = (a: Frac): string => {
  const r = frac(a.n, a.d);
  return `${r.n}/${r.d}`;
};

const decimalText = (value: Frac): string => fmtDecimal(value.n / value.d);

const percentText = (value: Frac): string => {
  const pct = fracScale(value, 100);
  return `${fmtDecimal(pct.n / pct.d)}%`;
};

interface Candidate {
  text: string;
  value: Frac;
}

/**
 * Parse a rendered number, fraction or percent into an exact fraction.
 * Used by explanations, never for deciding whether a generated tile is right.
 */
const parseRat = (text: string): Frac | null => {
  const t = text.trim();
  if (!t) return null;
  if (t.includes('/')) {
    const parts = t.split('/');
    if (parts.length !== 2) return null;
    const n = Number(parts[0]);
    const d = Number(parts[1]);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return frac(n, d);
  }
  let s = t;
  let scale = 1;
  if (s.endsWith('%')) {
    scale = 100;
    s = s.slice(0, -1);
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;
  const dot = body.indexOf('.');
  const digits = dot === -1 ? body : `${body.slice(0, dot)}${body.slice(dot + 1)}`;
  const decimals = dot === -1 ? 0 : body.length - dot - 1;
  const value = Number(digits) * (negative ? -1 : 1);
  return frac(value, 10 ** decimals * scale);
};

/**
 * Evaluate a short ASCII math expression: + - x / ^, parentheses, sqrt(...)
 * and a postfix percent sign. Returns null for anything it cannot parse.
 * The generator never relies on this for correctness, only for explanations.
 */
function evaluate(text: string): number | null {
  const src = text;
  let i = 0;

  const skip = (): void => {
    while (src[i] === ' ') i++;
  };

  const parseNumber = (): number => {
    skip();
    const start = i;
    while (i < src.length && src[i] >= '0' && src[i] <= '9') i++;
    if (src[i] === '.') {
      i++;
      while (i < src.length && src[i] >= '0' && src[i] <= '9') i++;
    }
    if (i === start) throw new Error('number expected');
    const value = Number(src.slice(start, i));
    if (!Number.isFinite(value)) throw new Error('bad number');
    return value;
  };

  const parseExpr = (): number => {
    let value = parseTerm();
    for (;;) {
      skip();
      const ch = src[i];
      if (ch === '+') {
        i++;
        value += parseTerm();
      } else if (ch === '-') {
        i++;
        value -= parseTerm();
      } else {
        break;
      }
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    for (;;) {
      skip();
      const ch = src[i];
      if (ch === 'x' || ch === 'X' || ch === '*') {
        i++;
        value *= parseUnary();
      } else if (ch === '/') {
        i++;
        const divisor = parseUnary();
        if (divisor === 0) throw new Error('division by zero');
        value /= divisor;
      } else {
        break;
      }
    }
    return value;
  };

  const parseUnary = (): number => {
    skip();
    if (src[i] === '-') {
      i++;
      return -parseUnary();
    }
    if (src[i] === '+') {
      i++;
      return parseUnary();
    }
    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePrimary();
    skip();
    if (src[i] === '^') {
      i++;
      return base ** parseUnary();
    }
    return base;
  };

  const parsePrimary = (): number => {
    skip();
    let value: number;
    if (src.startsWith('sqrt', i)) {
      i += 4;
      skip();
      if (src[i] !== '(') throw new Error('( expected');
      i++;
      value = Math.sqrt(parseExpr());
      skip();
      if (src[i] !== ')') throw new Error(') expected');
      i++;
    } else if (src[i] === '(') {
      i++;
      value = parseExpr();
      skip();
      if (src[i] !== ')') throw new Error(') expected');
      i++;
    } else {
      value = parseNumber();
    }
    while (src[i] === '%') {
      i++;
      value /= 100;
    }
    return value;
  };

  try {
    const value = parseExpr();
    skip();
    if (i !== src.length || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

const isComposite = (n: number): boolean => {
  if (n < 4) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return true;
  return false;
};

const placeExponent = (place: number): number => {
  let exp = 0;
  let p = 1;
  while (p < place) {
    p *= 10;
    exp++;
  }
  return exp;
};

const PLACE_NAMES = [
  'ones',
  'tens',
  'hundreds',
  'thousands',
  'ten-thousands',
  'hundred-thousands',
] as const;

const placeName = (place: number): string =>
  PLACE_NAMES[placeExponent(place)] ?? 'ones';

/** Fractions near `value` that are close, proper, short and not equivalent. */
const adjacentFractions = (value: Frac, limit: number): Candidate[] => {
  const target = value.n / value.d;
  const seen = new Set<string>();
  const out: Candidate[] = [];

  const want = (text: string, candidate: Frac): void => {
    if (out.length >= limit) return;
    if (text.length > NUM_MAX) return;
    if (sameFrac(candidate, value)) return;
    if (Math.abs(candidate.n / candidate.d - target) > 0.27) return;
    const key = fracKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, value: candidate });
  };

  for (let k = 1; k <= 7; k++) {
    const p = value.n * k;
    const q = value.d * k;
    for (const delta of [-2, -1, 1, 2]) {
      const forms: Array<[number, number]> = [
        [p + delta, q],
        [p, q + delta],
        [p + delta, q + delta],
      ];
      for (const [pp, qq] of forms) {
        if (pp <= 0 || qq <= 1 || pp >= qq) continue;
        want(`${pp}/${qq}`, frac(pp, qq));
      }
    }
  }

  // Classic "add the same amount to top and bottom" misconception.
  const cross = value.n + value.d;
  if (cross < value.d * 2) {
    want(`${cross}/${value.d * 2}`, frac(cross, value.d * 2));
  }

  return out;
};

/** Build an equality-board distractor expression whose value is off by a little. */
const nearMissExpressions = (rng: Rng, value: number): string[] => {
  const out: string[] = [];
  if (value < 2) return out;

  for (let k = 0; k < 3; k++) {
    const a = rng.int(1, value - 1);
    out.push(`${a}+${value - a}`);
  }
  for (let k = 0; k < 3; k++) {
    const b = rng.int(1, 30);
    out.push(`${value + b}-${b}`);
  }
  for (let a = 2; a * a <= value; a++) {
    if (value % a !== 0) continue;
    const b = value / a;
    out.push(`${a}x${b}`);
    if (a !== b) out.push(`${b}x${a}`);
    break;
  }
  for (const d of [2, 3, 4, 5]) out.push(`${value * d}/${d}`);
  return out;
};

/* ------------------------------------------------------------------ */
/* 1. Equality                                                        */
/* ------------------------------------------------------------------ */

const equality: Topic = {
  id: 'equality',
  name: 'Equality',
  family: 'arithmetic',
  band: 'elementary',
  grades: 'Grades 3-6',
  blurb: 'Munch the expressions that land exactly on the target number.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const opCount = clamp(2 + Math.floor((lv - 1) / 5), 2, 4);
    let ops = rng.shuffle(['+', '-', 'x', '/'] as Op[]).slice(0, opCount);

    const targetMin = 12 + lv * 2;
    const targetMax = 24 + lv * 18;
    let target = rng.int(targetMin, targetMax);
    if (ops.includes('x')) {
      // Multiplication needs a composite target, otherwise that operation
      // cannot produce a correct expression at all.
      while (!isComposite(target)) target++;
    }

    const correct: string[] = [];
    if (ops.includes('+')) {
      for (const a of distinctInts(rng, 8, 2, target - 2)) {
        correct.push(`${a}+${target - a}`);
      }
    }
    if (ops.includes('-')) {
      for (const b of distinctInts(rng, 8, 1, 30 + lv * 3)) {
        correct.push(`${target + b}-${b}`);
      }
    }
    if (ops.includes('x')) {
      for (let a = 2; a * a <= target; a++) {
        if (target % a !== 0) continue;
        const b = target / a;
        correct.push(`${a}x${b}`);
        if (a !== b) correct.push(`${b}x${a}`);
      }
    }
    if (ops.includes('/')) {
      for (const d of distinctInts(rng, 8, 2, 12)) {
        correct.push(`${target * d}/${d}`);
      }
    }

    const correctPool = uniq(correct).filter((t) => t.length <= EXPR_MAX);
    const correctCount = clamp(correctPool.length, 8, 10);

    const incorrect: string[] = [];
    for (const delta of [-2, -1, 1, 2]) {
      incorrect.push(...nearMissExpressions(rng, target + delta));
    }

    const incorrectPool = uniq(incorrect).filter(
      (text) => text.length <= EXPR_MAX && evaluate(text) !== target,
    );

    return makeRound({
      rng,
      heading: `Equals ${target}`,
      instruction: `Munch every expression that equals ${target}.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount,
      explain: (text) => {
        const value = evaluate(text);
        if (value === null) return `${text} is not an expression equal to ${target}.`;
        if (value === target) return `${text} = ${target}, so it equals the target.`;
        return `${text} = ${fmtNum(value)}, which misses ${target} by ${fmtNum(Math.abs(value - target))}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 2. Inequality                                                      */
/* ------------------------------------------------------------------ */

const inequality: Topic = {
  id: 'inequality',
  name: 'Inequality',
  family: 'arithmetic',
  band: 'elementary',
  grades: 'Grades 5-8',
  blurb: 'Compare numbers and expressions against a strict boundary.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const op: '<' | '>' = rng.chance(0.5) ? '<' : '>';
    // At least 24, so the "wrong" side of the comparison always has enough
    // distinct positive integers to fill the board.
    const threshold = rng.int(Math.max(24, 10 + lv * 2), 30 + lv * 14);
    const below = op === '<';
    const useExpressions = lv >= 4;

    const tile = (value: number): string => {
      if (!useExpressions || value < 2 || rng.chance(0.45)) return String(value);
      if (rng.chance(0.5)) {
        const a = rng.int(1, value - 1);
        const text = `${a}+${value - a}`;
        if (text.length <= EXPR_MAX) return text;
      }
      const b = rng.int(1, 20);
      const text = `${value + b}-${b}`;
      return text.length <= EXPR_MAX ? text : String(value);
    };

    const correctValues: number[] = [];
    for (let k = 1; k <= 18; k++) {
      const value = below ? threshold - k : threshold + k;
      if (value > 0) correctValues.push(value);
    }
    for (let k = 0; k < 6; k++) {
      const value = below
        ? rng.int(1, Math.max(1, threshold - 1))
        : rng.int(threshold + 1, threshold * 2 + 20);
      correctValues.push(value);
    }

    const wrongValues: number[] = [threshold];
    for (let k = 1; k <= 20; k++) {
      const value = below ? threshold + k : threshold - k;
      if (value > 0) wrongValues.push(value);
    }

    const correct = uniq(correctValues.filter((v) => v > 0).map(tile));
    const incorrect = uniq(wrongValues.filter((v) => v > 0).map(tile)).filter(
      (text) => {
        const value = evaluate(text);
        return value !== null && (below ? value >= threshold : value <= threshold);
      },
    );

    return makeRound({
      rng,
      heading: `Inequality: ${op} ${threshold}`,
      instruction: `Munch every value ${op} ${threshold}.`,
      correct,
      incorrect,
      correctCount: 10,
      explain: (text) => {
        const value = evaluate(text);
        if (value === null) return `${text} cannot be compared with ${threshold}.`;
        if (value === threshold) {
          return `${text} = ${threshold}; the comparison is strict (${op}), so ${threshold} itself does not count.`;
        }
        const satisfied = below ? value < threshold : value > threshold;
        if (satisfied) {
          return `${text} = ${fmtNum(value)}, which is ${below ? 'less' : 'greater'} than ${threshold}.`;
        }
        return `${text} = ${fmtNum(value)}, which is ${below ? 'greater' : 'less'} than ${threshold}, so it does not satisfy ${op} ${threshold}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 3. Place value                                                     */
/* ------------------------------------------------------------------ */

const placeValue: Topic = {
  id: 'place-value',
  name: 'Place Value',
  family: 'arithmetic',
  band: 'elementary',
  grades: 'Grades 3-5',
  blurb: 'Find the numbers where a chosen digit sits in a chosen place.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const places = [1, 10, 100];
    if (lv >= 5) places.push(1000);
    if (lv >= 10) places.push(10000);
    if (lv >= 16) places.push(100000);
    const place = rng.pick(places);
    const digit = rng.int(2, 9);
    const maxDigits = clamp(3 + Math.floor(lv / 5), 3, 6);
    // Three digits minimum: with a 1- or 2-digit board there are fewer than
    // ten numbers that can put a chosen digit in a chosen place.
    const minDigits = Math.max(3, placeExponent(place) + 1);
    const digits = rng.int(minDigits, Math.max(minDigits, maxDigits));

    const randomOtherDigit = (leading: boolean): number => {
      // Map a small range onto the digits that are not `digit`.
      const raw = leading ? rng.int(1, 8) : rng.int(0, 8);
      return digit <= 8 && raw >= digit ? raw + 1 : raw;
    };

    const withDigitAt = (atPlace: number, count: number): number => {
      const exp = placeExponent(atPlace);
      let text = '';
      for (let e = count - 1; e >= 0; e--) {
        if (e === exp) {
          text += String(digit);
        } else {
          text += String(randomOtherDigit(e === count - 1));
        }
      }
      return Number(text);
    };

    const withoutDigit = (count: number): number => {
      let text = '';
      for (let e = count - 1; e >= 0; e--) text += String(randomOtherDigit(e === count - 1));
      return Number(text);
    };

    const correctSet = new Set<number>();
    for (let guard = 0; guard < 240 && correctSet.size < 18; guard++) {
      correctSet.add(withDigitAt(place, digits));
    }

    const wrongSet = new Set<number>();
    const otherPlaces = places.filter((p) => p !== place && placeExponent(p) < digits);
    for (let guard = 0; guard < 200 && wrongSet.size < 12; guard++) {
      const at = rng.pick(otherPlaces.length > 0 ? otherPlaces : [1]);
      const count = rng.int(Math.max(3, placeExponent(at) + 1), Math.max(3, digits));
      wrongSet.add(withDigitAt(at, count));
    }
    for (let guard = 0; guard < 160 && wrongSet.size < 22; guard++) {
      wrongSet.add(withoutDigit(rng.int(Math.max(2, minDigits), Math.max(2, digits))));
    }

    const correct = [...correctSet].map(String);
    const incorrect = [...wrongSet].map(String);

    return makeRound({
      rng,
      heading: `The ${digit} is worth ${digit * place}`,
      instruction: `Munch every number where the ${digit} is worth ${digit * place}.`,
      correct,
      incorrect,
      correctCount: 10,
      explain: (text) => {
        const clean = text.replace(/[^0-9]/g, '');
        const number = Number(clean);
        const s = String(number);
        const found: number[] = [];
        for (let i = 0; i < s.length; i++) {
          if (Number(s[s.length - 1 - i]) === digit) found.push(10 ** i);
        }
        if (found.includes(place)) {
          return `In ${number} the ${digit} is in the ${placeName(place)} place, so it is worth ${digit} x ${place} = ${digit * place}.`;
        }
        if (found.length === 0) {
          return `${number} does not contain the digit ${digit}, so there is no ${digit} worth ${digit * place}.`;
        }
        const actual = found
          .map((p) => `${digit} x ${p} = ${digit * p}`)
          .join(' and ');
        return `In ${number} the ${digit} is worth ${actual}, not ${digit * place}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 4. Rounding                                                        */
/* ------------------------------------------------------------------ */

const roundTo = (value: number, unit: number): number =>
  Math.floor((value + unit / 2) / unit) * unit;

const rounding: Topic = {
  id: 'rounding',
  name: 'Rounding',
  family: 'arithmetic',
  band: 'elementary',
  grades: 'Grades 3-6',
  blurb: 'Munch numbers that land on the target after rounding.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const units = [10];
    if (lv >= 2) units.push(100);
    if (lv >= 4) units.push(1000);
    if (lv >= 10) units.push(10000);
    const unit = rng.pick(units);
    // Ten-unit rounds start at 100 rather than 10: a board around 20 has too
    // few genuinely near round-to-10 neighbours, which made the distractors
    // look random. Around 100+, every distractor sits beside a boundary.
    const minMultiple = unit === 10 ? 10 : 2;
    const target = unit * rng.int(minMultiple, minMultiple + 4 + lv);
    const half = unit / 2;

    // Stay away from the exact half-way case: rounding conventions differ.
    const pad = unit === 10 ? 1 : 5;
    const limit = half - pad;
    const offsets = distinctInts(rng, 20, -limit, limit);
    const correct = uniq(
      offsets.map((o) => String(target + o)).filter((text) => Number(text) > 0),
    );

    const wrongSet = new Set<number>();
    // Just past the rounding boundary, on both sides. Forty candidates per
    // side leaves room for makeRound's strict, no-recycling sampling.
    for (let step = 1; step <= 20; step++) {
      const delta = half + step;
      if (target + delta > 0) wrongSet.add(target + delta);
      if (target - delta > 0) wrongSet.add(target - delta);
    }
    for (const value of [...wrongSet]) {
      if (roundTo(value, unit) === target) wrongSet.delete(value);
    }
    const incorrect = [...wrongSet].map(String);

    return makeRound({
      rng,
      heading: `Round to the nearest ${unit} = ${target}`,
      instruction: `Munch every number that rounds to ${target} at the nearest ${unit}.`,
      correct,
      incorrect,
      correctCount: clamp(correct.length, 8, 10),
      explain: (text) => {
        const value = Number(text);
        if (!Number.isFinite(value)) return `${text} cannot be rounded to ${target}.`;
        const lower = Math.floor(value / unit) * unit;
        const upper = lower + unit;
        const down = value - lower;
        const up = upper - value;
        const nearest = down < up ? lower : upper;
        if (nearest === target) {
          return `${value} is ${down} above ${lower} and ${up} below ${upper}; the nearer multiple of ${unit} is ${target}.`;
        }
        return `${value} is ${down} above ${lower} and ${up} below ${upper}; the nearer multiple of ${unit} is ${nearest}, not ${target}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 5. Equivalent fractions                                            */
/* ------------------------------------------------------------------ */

const fractions: Topic = {
  id: 'fractions',
  name: 'Equivalent Fractions',
  family: 'arithmetic',
  band: 'middle',
  grades: 'Grades 5-8',
  blurb: 'Different fractions, same amount: munch the equivalents.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const maxDen = clamp(4 + Math.floor(lv / 2), 4, 12);
    const den = rng.int(2, maxDen);
    const value = frac(rng.int(1, den - 1), den);

    const correct: string[] = [];
    const kMax = 10 + Math.floor(lv / 2);
    for (let k = 1; k <= kMax; k++) {
      const text = `${k * value.n}/${k * value.d}`;
      if (text.length <= NUM_MAX) correct.push(text);
    }
    const correctPool = uniq(correct);
    const correctCount = clamp(correctPool.length, 8, 10);

    const wrong: string[] = adjacentFractions(value, 28).map((c) => c.text);
    const seen = new Set<string>();
    const incorrect: string[] = [];
    for (const text of rng.shuffle(wrong)) {
      const [p, q] = text.split('/');
      const f = frac(Number(p), Number(q));
      const key = fracKey(f);
      if (sameFrac(f, value) || seen.has(key)) continue;
      seen.add(key);
      incorrect.push(text);
    }
    // Fallback material if the near-miss list was too short for a board.
    if (incorrect.length < 22) {
      for (let q = 2; q <= 20 && incorrect.length < 26; q++) {
        for (let p = 1; p < q && incorrect.length < 26; p++) {
          const f = frac(p, q);
          if (sameFrac(f, value)) continue;
          const key = fracKey(f);
          if (seen.has(key)) continue;
          if (Math.abs(f.n / f.d - value.n / value.d) > 0.3) continue;
          const text = `${p}/${q}`;
          if (text.length > NUM_MAX) continue;
          seen.add(key);
          incorrect.push(text);
        }
      }
    }

    return makeRound({
      rng,
      heading: `Equals ${value.n}/${value.d}`,
      instruction: `Munch every fraction equal to ${value.n}/${value.d}.`,
      correct: correctPool,
      incorrect,
      correctCount,
      explain: (text) => {
        const parts = text.split('/');
        const p = Number(parts[0]);
        const q = Number(parts[1]);
        if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) {
          return `${text} is not a usable fraction.`;
        }
        if (p * value.d === q * value.n) {
          return `${text}: ${p} x ${value.d} = ${q} x ${value.n} = ${p * value.d}, so it equals ${value.n}/${value.d}.`;
        }
        return `${text} = ${fmtNum(p / q)}, not ${fmtNum(value.n / value.d)}. Cross products: ${p} x ${value.d} = ${p * value.d}, but ${q} x ${value.n} = ${q * value.n}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 6. Fractions and decimals                                          */
/* ------------------------------------------------------------------ */

const decimals: Topic = {
  id: 'decimals',
  name: 'Fractions & Decimals',
  family: 'arithmetic',
  band: 'middle',
  grades: 'Grades 5-8',
  blurb: 'Match fractions, decimals and percents for the same value.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const denominators =
      lv < 4
        ? [2, 4, 5, 10]
        : lv < 9
          ? [2, 4, 5, 8, 10, 20]
          : [2, 4, 5, 8, 10, 20, 25, 50, 100];
    const den = rng.pick(denominators);
    const value = frac(rng.int(1, den - 1), den);

    const correct: string[] = [];
    const addCorrect = (text: string): void => {
      if (text.length <= NUM_MAX) correct.push(text);
    };
    addCorrect(`${value.n}/${value.d}`);
    addCorrect(decimalText(value));
    addCorrect(percentText(value));
    const hundredths = fracScale(value, 100);
    if (hundredths.d === 1) addCorrect(`${hundredths.n}/100`);
    for (let k = 2; k <= 12; k++) {
      addCorrect(`${k * value.n}/${k * value.d}`);
    }
    const correctPool = uniq(correct);

    const fractionCands = adjacentFractions(value, 10);
    const decimalCands: Candidate[] = [];
    const shifts = [
      frac(1, 10),
      frac(-1, 10),
      frac(1, 100),
      frac(-1, 100),
      frac(1, 5),
      frac(-1, 5),
      frac(1, 4),
      frac(-1, 4),
      frac(1, 20),
      frac(-1, 20),
    ];
    for (const shift of shifts) {
      const f = fracAdd(value, shift);
      if (f.n > 0) decimalCands.push({ text: decimalText(f), value: f });
    }
    const timesTen = fracScale(value, 10);
    if (timesTen.n / timesTen.d < 10) {
      decimalCands.push({ text: decimalText(timesTen), value: timesTen });
    }
    const tenth = frac(value.n, value.d * 10);
    decimalCands.push({ text: decimalText(tenth), value: tenth });

    const percentCands: Candidate[] = [];
    const pctValue = fracScale(value, 100);
    for (const delta of [-10, -5, -1, 1, 5, 10]) {
      const pct = fracAdd(pctValue, frac(delta, 1));
      if (pct.n > 0) {
        percentCands.push({
          text: `${fmtDecimal(pct.n / pct.d)}%`,
          value: frac(pct.n, pct.d * 100),
        });
      }
    }
    percentCands.push({
      text: `${decimalText(value)}%`,
      value: frac(value.n, value.d * 100),
    });
    percentCands.push({
      text: `${fmtDecimal(timesTen.n / timesTen.d)}%`,
      value: frac(timesTen.n, timesTen.d * 100),
    });

    const plainCands: Candidate[] = [
      { text: fmtDecimal(pctValue.n / pctValue.d), value: pctValue },
    ];

    const groups = [
      rng.shuffle(fractionCands),
      rng.shuffle(decimalCands),
      rng.shuffle(percentCands),
      rng.shuffle(plainCands),
    ];
    const seenValues = new Set<string>();
    const seenTexts = new Set<string>();
    const incorrect: string[] = [];
    for (let round = 0; round < 12 && incorrect.length < 24; round++) {
      for (const group of groups) {
        const candidate = group[round];
        if (!candidate) continue;
        if (candidate.text.length > NUM_MAX) continue;
        const key = fracKey(candidate.value);
        if (sameFrac(candidate.value, value) || seenValues.has(key)) continue;
        if (seenTexts.has(candidate.text)) continue;
        seenValues.add(key);
        seenTexts.add(candidate.text);
        incorrect.push(candidate.text);
      }
    }
    // Nearby hundredths guarantee a full, plausible distractor pool even for
    // small denominators such as 1/5.
    for (let k = 1; k <= 200 && incorrect.length < 22; k++) {
      for (const f of [frac(k, 100), frac(k, 1000), frac(k, 10)]) {
        if (incorrect.length >= 22) break;
        const text = decimalText(f);
        if (text.length > NUM_MAX) continue;
        if (sameFrac(f, value)) continue;
        if (Math.abs(f.n / f.d - value.n / value.d) > 0.5) continue;
        const key = fracKey(f);
        if (seenValues.has(key) || seenTexts.has(text)) continue;
        seenValues.add(key);
        seenTexts.add(text);
        incorrect.push(text);
      }
    }

    return makeRound({
      rng,
      heading: `Equals ${decimalText(value)}`,
      instruction: `Munch every tile equal to ${decimalText(value)}.`,
      correct: correctPool,
      incorrect,
      correctCount: 10,
      explain: (text) => {
        const got = parseRat(text);
        if (!got) return `${text} cannot be read as a fraction, decimal or percent.`;
        if (sameFrac(got, value)) {
          if (text.endsWith('%')) return `${text} = ${decimalText(value)}, which is the target.`;
          if (text.includes('/')) {
            return `${text} = ${fmtNum(got.n / got.d)}, which is the target ${decimalText(value)}.`;
          }
          return `${text} is exactly the target.`;
        }
        return `${text} = ${fmtNum(got.n / got.d)}, but ${value.n}/${value.d} = ${decimalText(value)}; it is off by ${fmtNum(Math.abs(got.n / got.d - value.n / value.d))}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 7. Percents                                                        */
/* ------------------------------------------------------------------ */

const percents: Topic = {
  id: 'percents',
  name: 'Percents',
  family: 'arithmetic',
  band: 'middle',
  grades: 'Grades 6-8',
  blurb: 'Find every fraction, decimal and percent worth the same amount.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const pct =
      lv <= 3
        ? rng.pick([10, 20, 25, 50, 75])
        : lv <= 7
          ? rng.int(1, 20) * 5
          : rng.int(5, 95);
    const value = frac(pct, 100);

    const correct: string[] = [];
    const addCorrect = (text: string): void => {
      if (text.length <= NUM_MAX) correct.push(text);
    };
    addCorrect(`${pct}%`);
    addCorrect(decimalText(value));
    addCorrect(`${value.n}/${value.d}`);
    addCorrect(`${pct}/100`);
    for (let k = 2; k <= 12; k++) {
      addCorrect(`${k * value.n}/${k * value.d}`);
    }
    const correctPool = uniq(correct);

    const pctCands: Candidate[] = [];
    for (let q = 1; q <= 99; q++) {
      if (q === pct) continue;
      if (Math.abs(q / 100 - value.n / value.d) > 0.26) continue;
      pctCands.push({ text: `${q}%`, value: frac(q, 100) });
    }

    const fractionCands = adjacentFractions(value, 10);

    const decimalCands: Candidate[] = [];
    const addDecimal = (text: string, f: Frac): void => {
      if (Math.abs(f.n / f.d - value.n / value.d) <= 0.45) {
        decimalCands.push({ text, value: f });
      }
    };
    addDecimal(decimalText(frac(value.n, value.d * 10)), frac(value.n, value.d * 10));
    addDecimal(decimalText(frac(value.n * 10, value.d)), frac(value.n * 10, value.d));
    addDecimal(`${fmtDecimal(pct / 10)}%`, frac(pct, 1000));
    addDecimal(`${fmtDecimal(pct * 10)}%`, frac(pct * 10, 100));
    addDecimal(`${pct}/1000`, frac(pct, 1000));
    addDecimal(`${pct}/10`, frac(pct, 10));
    addDecimal(`${pct * 10}/100`, frac(pct * 10, 100));

    const plainCands: Candidate[] = [
      { text: `${pct}`, value: frac(pct, 1) },
    ];

    const groups = [
      rng.shuffle(pctCands),
      rng.shuffle(fractionCands),
      rng.shuffle(decimalCands),
      rng.shuffle(plainCands),
    ];
    const seenValues = new Set<string>();
    const seenTexts = new Set<string>();
    const incorrect: string[] = [];
    for (let round = 0; round < 20 && incorrect.length < 24; round++) {
      for (const group of groups) {
        const candidate = group[round];
        if (!candidate) continue;
        if (candidate.text.length > NUM_MAX) continue;
        const key = fracKey(candidate.value);
        if (sameFrac(candidate.value, value) || seenValues.has(key)) continue;
        if (seenTexts.has(candidate.text)) continue;
        seenValues.add(key);
        seenTexts.add(candidate.text);
        incorrect.push(candidate.text);
      }
    }

    return makeRound({
      rng,
      heading: `Equals ${pct}%`,
      instruction: `Munch every expression equal to ${pct}%.`,
      correct: correctPool,
      incorrect,
      correctCount: 10,
      explain: (text) => {
        const got = parseRat(text);
        if (!got) return `${text} cannot be read as a fraction, decimal or percent.`;
        const gotValue = got.n / got.d;
        const asPct = (got.n * 100) / got.d;
        if (sameFrac(got, value)) {
          if (text.endsWith('%')) return `${text} = ${decimalText(value)}; that is ${pct}%, so it matches.`;
          if (text.includes('/')) return `${text} = ${fmtNum(gotValue)} = ${pct}%, so it matches.`;
          return `${text} is ${pct}%, so it matches.`;
        }
        let conversion: string;
        if (text.endsWith('%')) {
          conversion = `${text} = ${fmtNum(gotValue)}`;
        } else if (text.includes('/')) {
          conversion = `${text} = ${fmtNum(gotValue)} = ${fmtNum(asPct)}%`;
        } else {
          conversion = `${text} = ${fmtNum(asPct)}%`;
        }
        return `${conversion}, but ${pct}% = ${decimalText(value)}. They are not equal.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 8. Integers                                                        */
/* ------------------------------------------------------------------ */

const integers: Topic = {
  id: 'integers',
  name: 'Integers',
  family: 'arithmetic',
  band: 'middle',
  grades: 'Grades 6-8',
  blurb: 'Signed arithmetic: keep track of the minus signs.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const maxAbs = clamp(6 + lv * 2, 8, 60);
    const magnitudes: number[] = [];
    for (let m = 4; m <= maxAbs; m++) if (isComposite(m)) magnitudes.push(m);
    const magnitude = rng.pick(magnitudes);
    const target = rng.chance(0.7) ? -magnitude : magnitude;

    const expressionsFor = (value: number): string[] => {
      const out: string[] = [];
      const add = (text: string): void => {
        if (text.length <= EXPR_MAX && !text.includes('--')) out.push(text);
      };

      for (const a of distinctInts(rng, 8, -maxAbs - 5, maxAbs + 5)) {
        if (a === 0) continue;
        const b = value - a;
        if (b === 0) continue;
        // Render a negative second operand as subtraction: 13 + -17 = 13-17.
        if (b < 0) add(`${a}-${-b}`);
        else add(`${a}+${b}`);
      }
      for (let b = 1; b <= 12; b++) add(`${value + b}-${b}`);
      for (let a = -maxAbs; a <= maxAbs; a++) {
        if (a === 0 || value % a !== 0) continue;
        const b = value / a;
        if (b !== 0) add(`${a}x${b}`);
      }
      for (let d = 2; d <= 9; d++) {
        add(`${value * d}/${d}`);
        add(`${-value * d}/${-d}`);
      }
      return uniq(out);
    };

    const correct = expressionsFor(target);
    const correctCount = clamp(correct.length, 8, 10);

    const incorrectRaw: string[] = [];
    for (const delta of [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]) {
      incorrectRaw.push(...rng.shuffle(expressionsFor(target + delta)).slice(0, 3));
    }
    incorrectRaw.push(...rng.shuffle(expressionsFor(-target)).slice(0, 6));
    for (let b = 1; b <= 9; b++) {
      const a = target + b;
      if (a !== 0) incorrectRaw.push(`${b}-${a}`);
    }
    const incorrect = uniq(
      incorrectRaw.filter((text) => {
        if (text.length > EXPR_MAX || text.includes('--')) return false;
        const value = evaluate(text);
        return value !== null && value !== target;
      }),
    );

    return makeRound({
      rng,
      heading: `Equals ${target}`,
      instruction: `Munch every expression equal to ${target}.`,
      correct,
      incorrect,
      correctCount,
      explain: (text) => {
        const value = evaluate(text);
        if (value === null) return `${text} is not a signed arithmetic expression.`;
        if (value === target) return `${text} = ${target}, so it equals the target.`;
        return `${text} = ${fmtNum(value)}, not ${target}; it is ${fmtNum(Math.abs(value - target))} away. Watch the signs when subtracting or multiplying.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 9. Order of operations                                             */
/* ------------------------------------------------------------------ */

const orderCandidatesFor = (target: number): string[] => {
  const out: string[] = [];
  const add = (text: string): void => {
    if (text.length > EXPR_MAX) return;
    const value = evaluate(text);
    if (value !== null && Math.abs(value - target) < 1e-9) out.push(text);
  };

  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      const c = target - a - b;
      if (c >= 1 && c <= 20) add(`${a}+${b}+${c}`);
    }
  }
  for (let a = 1; a <= 9; a++) {
    for (let c = 1; c <= 9; c++) {
      const b = target - a + c;
      if (b >= 1 && b <= 20) add(`${a}+${b}-${c}`);
    }
  }
  for (let b = 1; b <= 9; b++) {
    for (let c = 1; c <= 9; c++) {
      const a = target + b - c;
      if (a >= 1 && a <= 30) add(`${a}-${b}+${c}`);
    }
  }
  for (let b = 2; b <= 9; b++) {
    for (let c = 2; c <= 9; c++) {
      const a = target - b * c;
      if (a >= 1 && a <= 30) add(`${a}+${b}x${c}`);
    }
  }
  for (let b = 2; b <= 9; b++) {
    for (let c = 2; c <= 9; c++) {
      const a = target - b * c;
      if (a >= 1 && a <= 30) add(`${b}x${c}+${a}`);
    }
  }
  for (let b = 2; b <= 9; b++) {
    for (let c = 2; c <= 9; c++) {
      const product = target + c;
      if (product % b !== 0) continue;
      const a = product / b;
      if (a >= 1 && a <= 30) add(`${a}x${b}-${c}`);
    }
  }
  for (let c = 2; c <= 9; c++) {
    if (target % c !== 0) continue;
    const s = target / c;
    for (let a = 1; a < s; a++) {
      const b = s - a;
      if (b >= 1 && b <= 20) add(`(${a}+${b})x${c}`);
    }
  }
  for (let c = 2; c <= 9; c++) {
    if (target % c !== 0) continue;
    const s = target / c;
    for (let b = 1; b <= 9; b++) {
      const a = s + b;
      if (a <= 30) add(`(${a}-${b})x${c}`);
    }
  }
  for (let a = 2; a <= 9; a++) {
    if (target % a !== 0) continue;
    const s = target / a;
    for (let b = 1; b < s; b++) {
      const c = s - b;
      if (c >= 1 && c <= 20) add(`${a}x(${b}+${c})`);
    }
  }
  for (let a = 2; a <= 6; a++) {
    for (let b = 2; b <= 6; b++) {
      const rest = target - a * b;
      if (rest < 4) continue;
      for (let c = 2; c <= 6; c++) {
        if (rest % c !== 0) continue;
        const d = rest / c;
        if (d >= 2 && d <= 9) add(`${a}x${b}+${c}x${d}`);
      }
    }
  }
  for (let b = 2; b <= 6; b++) {
    for (let c = 2; c <= 6; c++) {
      for (let a = 1; a <= 9; a++) {
        const d = a + b * c - target;
        if (d >= 1 && d <= 20) add(`${a}+${b}x${c}-${d}`);
      }
    }
  }

  return uniq(out);
};

const orderOfOperations: Topic = {
  id: 'order-of-operations',
  name: 'Order of Operations',
  family: 'arithmetic',
  band: 'middle',
  grades: 'Grades 6-9',
  blurb: 'Munch multi-step expressions that evaluate to the target.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const maxTarget = 20 + lv * 3;
    let target = rng.int(8, maxTarget);
    let correct = orderCandidatesFor(target);
    for (let tries = 0; correct.length < 10 && tries < 40; tries++) {
      target++;
      correct = orderCandidatesFor(target);
    }
    // Guaranteed short forms so a sparse target can never starve the board.
    for (let a = 1; a <= 20 && correct.length < 10; a++) {
      const b = target - a + 1;
      if (b >= 1) correct.push(`${a}+${b}-1`);
    }
    correct = uniq(correct);
    const correctCount = clamp(correct.length, 8, 10);

    const incorrect: string[] = [];
    for (const delta of [-3, -2, -1, 1, 2, 3]) {
      const near = orderCandidatesFor(target + delta);
      incorrect.push(...rng.shuffle(near).slice(0, 5));
    }

    // Precedence traps: expressions that equal the target only if you work
    // strictly left to right.
    for (let c = 2; c <= 9; c++) {
      if (target % c !== 0) continue;
      const s = target / c;
      for (let a = 1; a < s; a++) {
        const b = s - a;
        const text = `${a}+${b}x${c}`;
        if (text.length <= EXPR_MAX && evaluate(text) !== target) incorrect.push(text);
      }
      for (let b = 1; b <= 9; b++) {
        const a = s + b;
        const text = `${a}-${b}x${c}`;
        if (text.length <= EXPR_MAX && evaluate(text) !== target) incorrect.push(text);
      }
    }
    // Division traps: these equal the target only if the addition is done
    // before the division, i.e. (a + b) / c instead of a + b / c.
    for (let c = 2; c <= 6; c++) {
      for (let k = 1; k <= 4; k++) {
        const b = c * k;
        const a = target * c - b;
        if (a < 1) continue;
        const text = `${a}+${b}/${c}`;
        if (text.length <= EXPR_MAX && evaluate(text) !== target) incorrect.push(text);
      }
    }

    const incorrectPool = uniq(
      incorrect.filter((text) => {
        if (text.length > EXPR_MAX) return false;
        const value = evaluate(text);
        return value !== null && value !== target;
      }),
    );

    return makeRound({
      rng,
      heading: `Equals ${target}`,
      instruction: `Munch every expression that equals ${target}.`,
      correct,
      incorrect: incorrectPool,
      correctCount,
      explain: (text) => {
        const value = evaluate(text);
        if (value === null) return `${text} is not a valid expression.`;
        if (value === target) return `${text} = ${target}, the target.`;
        const mul = text.match(/(\d+)[x/](\d+)/);
        let detail = '';
        if (mul) {
          const sub = evaluate(mul[0]);
          if (sub !== null) detail = ` (${mul[0]} = ${fmtNum(sub)} is done before + and -)`;
        }
        return `${text} = ${fmtNum(value)}${detail}, which is ${fmtNum(Math.abs(value - target))} away from ${target}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* 10. Exponents and roots                                            */
/* ------------------------------------------------------------------ */

const powerDecomposition = (n: number): { base: number; exp: number } | null => {
  if (!Number.isInteger(n) || n < 4) return null;
  for (let exp = 2; exp <= 12; exp++) {
    const approx = Math.round(n ** (1 / exp));
    for (const base of [approx - 1, approx, approx + 1]) {
      if (base >= 2 && base ** exp === n) return { base, exp };
    }
  }
  return null;
};

const isPerfectPower = (n: number): boolean => powerDecomposition(n) !== null;

/**
 * Map integer values to short exponent/root expressions that produce them.
 * Built fresh per round from pure arithmetic; no randomness and no state.
 */
const buildExponentMap = (level: number): Map<number, string[]> => {
  const cap = Math.min(1200, 60 + level * 30);
  const map = new Map<number, string[]>();
  const add = (value: number, text: string): void => {
    if (!Number.isInteger(value) || value <= 0 || value > cap) return;
    if (text.length > EXPR_MAX) return;
    const list = map.get(value);
    if (!list) {
      map.set(value, [text]);
    } else if (!list.includes(text)) {
      list.push(text);
    }
  };

  const powerForms: Array<{ value: number; text: string }> = [];
  for (let base = 2; base <= 12; base++) {
    let value = base * base;
    for (let exp = 2; exp <= 10 && value <= cap; exp++) {
      const text = `${base}^${exp}`;
      add(value, text);
      powerForms.push({ value, text });
      value *= base;
    }
  }

  for (let root = 2; root <= 31; root++) add(root, `sqrt(${root * root})`);

  for (let base = 2; base <= 12; base++) {
    let p = base * base;
    for (let exp = 2; exp <= 8 && p <= cap; exp++) {
      for (let c = 2; c <= 12; c++) {
        add(p * c, `${base}^${exp}x${c}`);
        if (p % c === 0) add(p / c, `${base}^${exp}/${c}`);
      }
      p *= base;
    }
  }

  for (let base = 2; base <= 12; base++) {
    let p = base * base;
    for (let exp = 2; exp <= 8 && p <= cap; exp++) {
      for (let d = 1; d <= 9; d++) {
        add(p + d, `${base}^${exp}+${d}`);
        if (p > d) add(p - d, `${base}^${exp}-${d}`);
      }
      p *= base;
    }
  }

  for (const a of powerForms) {
    for (const b of powerForms) {
      add(a.value + b.value, `${a.text}+${b.text}`);
      if (a.value > b.value) add(a.value - b.value, `${a.text}-${b.text}`);
      add(a.value * b.value, `${a.text}x${b.text}`);
    }
  }

  return map;
};

const exponents: Topic = {
  id: 'exponents',
  name: 'Exponents & Roots',
  family: 'arithmetic',
  band: 'middle',
  grades: 'Grades 7-9',
  blurb: 'Powers, roots and perfect powers in short ASCII form.',
  round(rng: Rng, level: number) {
    const lv = clamp(level, 1, 30);
    const cap = Math.min(1200, 60 + lv * 30);
    const map = buildExponentMap(lv);
    const perfectMode = lv >= 3 && rng.chance(0.45);

    if (!perfectMode) {
      const low = 8;
      const high = Math.min(cap, 24 + lv * 18);
      const eligible: number[] = [];
      for (const [value, list] of map) {
        if (value >= low && value <= high && list.length >= 9) eligible.push(value);
      }
      let target = eligible.length > 0 ? rng.pick(eligible) : low;
      let correct = uniq(map.get(target) ?? []);
      if (correct.length < 8) {
        // Extremely defensive fallback: use the richest value in the map.
        let best = target;
        let bestList = correct;
        for (const [value, list] of map) {
          if (list.length > bestList.length) {
            best = value;
            bestList = list;
          }
        }
        target = best;
        correct = uniq(bestList);
      }
      const correctCount = clamp(correct.length, 8, 10);

      const incorrect: string[] = [];
      const distances = [...map.keys()]
        .filter((value) => value !== target)
        .sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
      for (const value of distances) {
        if (incorrect.length >= 26) break;
        if (Math.abs(value - target) > 40) break;
        for (const text of rng.shuffle(map.get(value) ?? [])) {
          if (text.length > EXPR_MAX) continue;
          if (correct.includes(text)) continue;
          incorrect.push(text);
          if (incorrect.length >= 26) break;
        }
      }

      return makeRound({
        rng,
        heading: `Equals ${target}`,
        instruction: `Munch every expression that equals ${target}.`,
        correct,
        incorrect,
        correctCount,
        explain: (text) => {
          const value = evaluate(text);
          if (value === null) return `${text} is not a valid power or root expression.`;
          if (value === target) return `${text} = ${target}, so it hits the target.`;
          return `${text} = ${fmtNum(value)}, not ${target}; it is ${fmtNum(Math.abs(value - target))} away.`;
        },
      });
    }

    const perfect: number[] = [];
    for (let n = 4; n <= cap; n++) if (isPerfectPower(n)) perfect.push(n);

    const correct: string[] = [];
    for (const n of perfect) {
      for (const text of map.get(n) ?? []) correct.push(text);
      correct.push(String(n));
    }
    const correctPool = uniq(correct).filter((text) => text.length <= EXPR_MAX);
    const correctCount = 10;

    const banned = new Set(perfect);
    const incorrect: string[] = [];
    for (const n of perfect) {
      for (const delta of [1, 2, 3, 5]) {
        for (const candidate of [n - delta, n + delta]) {
          if (candidate < 4 || candidate > cap || banned.has(candidate)) continue;
          incorrect.push(String(candidate));
          for (const text of map.get(candidate) ?? []) {
            if (text.length <= EXPR_MAX) incorrect.push(text);
          }
        }
      }
    }
    const incorrectPool = uniq(incorrect).filter(
      (text) => !correctPool.includes(text) && text.length <= EXPR_MAX,
    );

    return makeRound({
      rng,
      heading: 'Perfect Powers',
      instruction: 'Munch every tile whose value is a perfect power (a whole number greater than 1 raised to a power of 2 or more).',
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount,
      explain: (text) => {
        const value = evaluate(text);
        if (value === null) return `${text} is not a valid power or root expression.`;
        const decomposition = powerDecomposition(value);
        if (decomposition) {
          const power = `${decomposition.base}^${decomposition.exp}`;
          return text === String(value)
            ? `${text} = ${power}, a perfect power.`
            : `${text} = ${fmtNum(value)} = ${power}, a perfect power.`;
        }
        const root = Math.floor(Math.sqrt(value));
        const cube = Math.floor(Math.cbrt(value));
        return `${text} = ${fmtNum(value)}: ${root}x${root} = ${root * root} and ${root + 1}x${root + 1} = ${(root + 1) ** 2}, while ${cube}x${cube}x${cube} = ${cube ** 3} and ${cube + 1}^3 = ${(cube + 1) ** 3}, so no whole number power equals ${fmtNum(value)}.`;
      },
    });
  },
};

export const arithmeticTopics: Topic[] = [
  equality,
  inequality,
  placeValue,
  rounding,
  fractions,
  decimals,
  percents,
  integers,
  orderOfOperations,
  exponents,
];
