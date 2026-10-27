/**
 * Independent truth checks.
 *
 * Each verifier re-derives the answer from the round's heading using a
 * *different* implementation than the generator (trial division instead of a
 * sieve, direct modulo instead of divisor enumeration, ...). A tile whose
 * `correct` flag disagrees with the verifier is a shipped bug.
 */
import type { GraphFeatures } from '../../topics/graphs';
import type { PlotSpec, Round, ShapeName } from '../../types';
import { compare, evaluate } from './evaluate';

const int = (text: string): number => {
  const value = Number(text);
  if (!Number.isInteger(value)) throw new Error(`not an integer: "${text}"`);
  return value;
};

export const isPrimeTrial = (n: number): boolean => {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
};

export const isPerfectSquare = (n: number): boolean => {
  if (!Number.isInteger(n) || n < 0) return false;
  const root = Math.round(Math.sqrt(n));
  return root * root === n;
};

const headingNumber = (heading: string, pattern: RegExp): number => {
  const match = heading.match(pattern);
  if (!match) throw new Error(`cannot read a number from heading "${heading}"`);
  return Number(match[1]);
};

/**
 * Returns a list of human-readable disagreements. Empty means the board's
 * flags are mathematically correct.
 */
const digitAt = (value: number, place: number): number => {
  const digit = Math.floor(Math.abs(value) / 10 ** place) % 10;
  return digit;
};

export const isPerfectPower = (n: number): boolean => {
  if (!Number.isInteger(n) || n < 4) return false;
  for (let exp = 2; exp <= 12; exp++) {
    const root = Math.round(n ** (1 / exp));
    for (const candidate of [root - 1, root, root + 1]) {
      if (candidate >= 2 && candidate ** exp === n) return true;
    }
  }
  return false;
};

const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/** Read the numeric answer a heading promises, e.g. "Equals 3/4". */
const targetOf = (heading: string): number => {
  const match = heading.match(/equals\s+(.+)$/i);
  if (!match) throw new Error(`cannot read a target from heading "${heading}"`);
  return evaluate(match[1]!);
};

/** Shape facts, restated here so a generator table mistake is caught. */
const SHAPE_TRUTH: Record<ShapeName, { dimension: 2 | 3; curved: boolean; pointy: boolean; parallelBases: boolean }> = {
  circle: { dimension: 2, curved: true, pointy: false, parallelBases: false },
  square: { dimension: 2, curved: false, pointy: false, parallelBases: true },
  rectangle: { dimension: 2, curved: false, pointy: false, parallelBases: true },
  triangle: { dimension: 2, curved: false, pointy: true, parallelBases: false },
  'right-triangle': { dimension: 2, curved: false, pointy: true, parallelBases: false },
  pentagon: { dimension: 2, curved: false, pointy: false, parallelBases: false },
  hexagon: { dimension: 2, curved: false, pointy: false, parallelBases: false },
  trapezoid: { dimension: 2, curved: false, pointy: false, parallelBases: true },
  parallelogram: { dimension: 2, curved: false, pointy: false, parallelBases: true },
  cube: { dimension: 3, curved: false, pointy: false, parallelBases: true },
  prism: { dimension: 3, curved: false, pointy: false, parallelBases: true },
  'triangular-prism': { dimension: 3, curved: false, pointy: false, parallelBases: true },
  pyramid: { dimension: 3, curved: false, pointy: true, parallelBases: false },
  cylinder: { dimension: 3, curved: true, pointy: false, parallelBases: true },
  cone: { dimension: 3, curved: true, pointy: true, parallelBases: false },
  sphere: { dimension: 3, curved: true, pointy: false, parallelBases: false },
};

/**
 * Describe a plot using finite differences, deliberately different from the
 * generator's neighbour comparison.
 */
const describePlot = (spec: PlotSpec): GraphFeatures => {
  const [lo, hi] = spec.xRange;
  const n = 120;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const y = spec.f(x);
    if (y === null || !Number.isFinite(y)) continue;
    xs.push(x);
    ys.push(y);
  }
  const slopes: number[] = [];
  for (let i = 1; i < ys.length; i++) {
    const dx = xs[i]! - xs[i - 1]!;
    slopes.push(dx === 0 ? 0 : (ys[i]! - ys[i - 1]!) / dx);
  }
  const increasing = slopes.every((m) => m >= -1e-7);
  const nonnegative = ys.every((y) => y >= -1e-7);
  let minimum = false;
  let maximum = false;
  for (let i = 1; i < slopes.length - 1; i++) {
    if (slopes[i - 1]! < 0 && slopes[i]! > 0) minimum = true;
    if (slopes[i - 1]! > 0 && slopes[i]! < 0) maximum = true;
  }
  return { increasing, minimum, maximum, nonnegative };
};

const FAMILY_BY_LABEL: Record<string, string> = {
  linear: 'linear',
  quadratic: 'quadratic',
  cubic: 'cubic',
  exponential: 'exponential',
  logarithmic: 'logarithmic',
  reciprocal: 'reciprocal',
  'square root': 'sqrt',
  'absolute value': 'absolute',
  sine: 'sine',
};

export function verifyRound(topicId: string, round: Round): string[] {
  const failures: string[] = [];
  const check = (text: string, expected: boolean): void => {
    const tile = round.tiles.find((tile) => tile.text === text);
    if (!tile) return;
    if (tile.correct !== expected) {
      failures.push(`"${text}" flagged ${tile.correct ? 'correct' : 'wrong'} but is ${expected ? 'correct' : 'wrong'}`);
    }
  };

  switch (topicId) {
    case 'primes': {
      for (const tile of round.tiles) check(tile.text, isPrimeTrial(int(tile.text)));
      break;
    }
    case 'factors': {
      const n = headingNumber(round.heading, /Factors of (\d+)/);
      for (const tile of round.tiles) {
        const v = int(tile.text);
        check(tile.text, v > 0 && n % v === 0);
      }
      break;
    }
    case 'multiples': {
      const base = headingNumber(round.heading, /Multiples of (\d+)/);
      for (const tile of round.tiles) check(tile.text, int(tile.text) % base === 0);
      break;
    }
    case 'even-odd': {
      const wantEven = /even/i.test(round.heading);
      for (const tile of round.tiles) check(tile.text, int(tile.text) % 2 === 0 === wantEven);
      break;
    }
    case 'perfect-squares': {
      for (const tile of round.tiles) check(tile.text, isPerfectSquare(int(tile.text)));
      break;
    }
    case 'divisibility': {
      const d = headingNumber(round.heading, /Divisible by (\d+)/);
      for (const tile of round.tiles) check(tile.text, int(tile.text) % d === 0);
      break;
    }
    case 'equality': {
      const target = headingNumber(round.heading, /(\d+)/);
      for (const tile of round.tiles) check(tile.text, evaluate(tile.text) === target);
      break;
    }
    case 'equality':
    case 'integers':
    case 'order-of-operations':
    case 'exponents': {
      if (topicId === 'exponents' && /perfect power/i.test(round.instruction)) {
        for (const tile of round.tiles) check(tile.text, isPerfectPower(evaluate(tile.text)));
        break;
      }
      const target = targetOf(round.heading);
      for (const tile of round.tiles) check(tile.text, close(evaluate(tile.text), target));
      break;
    }
    case 'inequality': {
      const phrases: Array<[RegExp, string]> = [
        [/^More than (.+)$/, '>'],
        [/^Less than (.+)$/, '<'],
        [/^At least (.+)$/, '>='],
        [/^At most (.+)$/, '<='],
      ];
      const found = phrases.map(([re, op]) => ({ m: round.heading.match(re), op })).find((x) => x.m);
      if (!found?.m) throw new Error(`bad inequality heading "${round.heading}"`);
      const comparison = `${found.op} ${found.m[1]}`;
      for (const tile of round.tiles) {
        check(tile.text, compare(evaluate(tile.text), comparison));
      }
      break;
    }
    case 'place-value': {
      const match = round.heading.match(/The (\d) is worth (\d+)/);
      if (!match) throw new Error(`bad place-value heading "${round.heading}"`);
      const digit = Number(match[1]);
      const worth = Number(match[2]);
      // "The 9 is worth 90" => the 9 sits in the tens column.
      // "The 9 is worth 10" (legacy phrasing) => the 9 sits in the tens column.
      const column = worth % digit === 0 && worth / digit >= 1 ? worth / digit : worth;
      const exponent = Math.round(Math.log10(column));
      for (const tile of round.tiles) {
        const value = int(tile.text);
        check(tile.text, value >= 10 ** exponent && digitAt(value, exponent) === digit);
      }
      break;
    }
    case 'rounding': {
      const targetMatch = round.heading.match(/^Rounds to (\d+)$/);
      const unitMatch = round.instruction.match(/nearest (\d+)/);
      if (!targetMatch || !unitMatch) throw new Error(`bad rounding heading "${round.heading}"`);
      const unit = Number(unitMatch[1]);
      const target = Number(targetMatch[1]);
      for (const tile of round.tiles) {
        const value = int(tile.text);
        check(tile.text, Math.round(value / unit) * unit === target);
      }
      break;
    }
    case 'fractions':
    case 'decimals':
    case 'percents': {
      // "Equals 3/4", "Equals 0.75" and "Equals 40%" all reduce to one value.
      const target = targetOf(round.heading);
      for (const tile of round.tiles) check(tile.text, close(evaluate(tile.text), target));
      break;
    }
    case 'solid-or-flat': {
      const want: 2 | 3 = /3D/i.test(round.heading) ? 3 : 2;
      for (const tile of round.tiles) {
        if (tile.visual?.kind !== 'shape') throw new Error(`missing shape visual on ${tile.text}`);
        check(tile.text, tile.visual.dimension === want);
      }
      break;
    }
    case 'solid-attributes': {
      const test = (shape: ShapeName): boolean => {
        const fact = SHAPE_TRUTH[shape];
        switch (round.heading) {
          case 'Curved Surfaces':
            return fact.curved;
          case 'All Flat Faces':
            return !fact.curved;
          case 'Comes To A Point':
            return fact.pointy;
          case 'Parallel Bases':
            return fact.parallelBases;
          default:
            throw new Error(`unknown solid-attributes heading ${round.heading}`);
        }
      };
      for (const tile of round.tiles) {
        if (tile.visual?.kind !== 'shape') throw new Error(`missing shape visual on ${tile.text}`);
        check(tile.text, test(tile.visual.shape));
      }
      break;
    }
    case 'triangle-pictures': {
      const match = round.instruction.match(/every (\w+) triangle/i);
      if (!match) throw new Error(`bad triangle-pictures instruction: ${round.instruction}`);
      const expected = match[1]!.toLowerCase();
      const angleModes = ['acute', 'right', 'obtuse'];
      const truth = (angles: [number, number, number]): string => {
        const distinct = new Set(angles).size;
        const biggest = Math.max(...angles);
        if (angleModes.includes(expected)) {
          if (biggest === 90) return 'right';
          if (biggest > 90) return 'obtuse';
          return 'acute';
        }
        if (distinct === 1) return 'equilateral';
        if (distinct === 2) return 'isosceles';
        return 'scalene';
      };
      for (const tile of round.tiles) {
        if (tile.visual?.kind !== 'shape' || !tile.visual.triangle) {
          throw new Error(`missing triangle visual on ${tile.text}`);
        }
        check(tile.text, truth(tile.visual.triangle.angles) === expected);
      }
      break;
    }
    case 'function-families': {
      const match = round.instruction.match(/graph of (?:a|an) (.+) function/i);
      if (!match) throw new Error(`bad function-families instruction: ${round.instruction}`);
      const target = FAMILY_BY_LABEL[match[1]!.trim().toLowerCase()];
      if (!target) throw new Error(`unknown family label ${match[1]}`);
      for (const tile of round.tiles) {
        if (tile.visual?.kind !== 'plot') throw new Error(`missing plot visual on ${tile.text}`);
        check(tile.text, tile.visual.family === target);
      }
      break;
    }
    case 'graph-features': {
      const features = (spec: PlotSpec): GraphFeatures => describePlot(spec);
      const test = (spec: PlotSpec): boolean => {
        const f = features(spec);
        switch (round.heading) {
          case 'Always Increasing':
            return f.increasing;
          case 'Turning Points':
            return f.minimum;
          case 'Maximum Point':
            return f.maximum;
          case 'Never Negative':
            return f.nonnegative;
          default:
            throw new Error(`unknown graph-features heading ${round.heading}`);
        }
      };
      for (const tile of round.tiles) {
        if (tile.visual?.kind !== 'plot') throw new Error(`missing plot visual on ${tile.text}`);
        check(tile.text, test(tile.visual));
      }
      break;
    }
    case 'trig-ratios': {
      // Tiles are fractions; the heading names the ratio to munch.
      for (const tile of round.tiles) {
        const value = evaluate(tile.text);
        const match = round.instruction.match(/sin|cos|tan/i);
        if (!match) break;
        const expected = expectedTrigRatio(round.heading, match[0].toLowerCase());
        check(tile.text, expected !== null && Math.abs(value - expected) < 1e-9);
      }
      break;
    }
    default: {
      // Topics with no independent verifier yet are reported so they cannot be
      // silently treated as "checked".
      return [`no truth verifier for topic "${topicId}"`];
    }
  }

  return failures;
}

/** Parses a right triangle described in a heading, e.g. "3,4,5 hyp 5, opp 3". */
function expectedTrigRatio(heading: string, fn: string): number | null {
  const numbers = heading.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length < 2) return null;
  const [opposite, adjacent, hypotenuse] = numbers;
  if (fn === 'sin') return hypotenuse ? opposite! / hypotenuse : null;
  if (fn === 'cos') return hypotenuse ? adjacent! / hypotenuse : null;
  return adjacent ? opposite! / adjacent! : null;
}

/** Verifies a comparison-style round ("munch every value > 12"). */
export function verifyComparison(round: Round, comparison: string): string[] {
  const failures: string[] = [];
  for (const tile of round.tiles) {
    const expected = compare(evaluate(tile.text), comparison);
    if (tile.correct !== expected) {
      failures.push(`"${tile.text}" flagged ${tile.correct} but comparison ${comparison} says ${expected}`);
    }
  }
  return failures;
}
