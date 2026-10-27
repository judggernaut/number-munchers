import { makeRound } from '../build';
import { type Rng, type Topic } from '../types';

const primesUpTo = (max: number): number[] => {
  const sieve = new Uint8Array(max + 1).fill(1);
  sieve[0] = 0;
  sieve[1] = 0;
  for (let i = 2; i * i <= max; i++) {
    if (!sieve[i]) continue;
    for (let j = i * i; j <= max; j += i) sieve[j] = 0;
  }
  const out: number[] = [];
  for (let i = 2; i <= max; i++) if (sieve[i]) out.push(i);
  return out;
};

const divisors = (n: number): number[] => {
  const out: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i !== 0) continue;
    out.push(i);
    if (i !== n / i) out.push(n / i);
  }
  return out.sort((a, b) => a - b);
};

const isPrime = (n: number): boolean => n >= 2 && divisors(n).length === 2;

const fmt = (n: number): string => String(n);

/** Prime Numbers: eat the primes, avoid composites and 1. */
const primes: Topic = {
  id: 'primes',
  name: 'Primes',
  family: 'number',
  band: 'elementary',
  grades: 'Grades 4-8',
  blurb: 'Whole numbers greater than 1 with exactly two factors.',
  round(rng: Rng, level: number) {
    const max = Math.min(250, 40 + level * 10);
    const all = primesUpTo(max);
    const correctPool = all.map(fmt);

    const oddComposites: number[] = [];
    const evenComposites: number[] = [];
    for (let n = 4; n <= max; n++) {
      if (isPrime(n)) continue;
      (n % 2 === 0 ? evenComposites : oddComposites).push(n);
    }
    const incorrectPool = [
      '1',
      ...rng.shuffle(oddComposites).map(fmt),
      ...rng.shuffle(evenComposites).map(fmt),
    ];

    return makeRound({
      rng,
      heading: 'Primes',
      instruction: 'Munch every prime number.',
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 10,
      explain: (text) => {
        const n = Number(text);
        if (n === 1) return '1 has only one factor, so it is neither prime nor composite.';
        const d = divisors(n).filter((x) => x !== 1 && x !== n);
        return `${fmt(n)} = ${d[0]} x ${n / d[0]}, so it is composite.`;
      },
    });
  },
};

/** Factors: divisors of a target number. */
const factors: Topic = {
  id: 'factors',
  name: 'Factors',
  family: 'number',
  band: 'elementary',
  grades: 'Grades 4-7',
  blurb: 'Numbers that divide the target evenly, with no remainder.',
  round(rng: Rng, level: number) {
    // Numbers with at least 8 divisors, so a board can always be filled.
    const rich = [12, 18, 20, 24, 30, 36, 40, 42, 48, 54, 56, 60, 72, 84, 90, 96, 108, 120];
    const cap = 24 + level * 12;
    const eligible = rich.filter((n) => n <= cap && divisors(n).length >= 8);
    const n = eligible.length > 0 ? rng.pick(eligible) : 24;
    const divs = divisors(n).map(fmt);

    const incorrectPool: string[] = [];
    for (let v = 2; v <= n + 12; v++) {
      if (n % v !== 0) incorrectPool.push(fmt(v));
    }

    return makeRound({
      rng,
      heading: `Factors of ${fmt(n)}`,
      instruction: `Munch every factor of ${fmt(n)}.`,
      correct: divs,
      incorrect: incorrectPool,
      correctCount: Math.min(12, divs.length),
      explain: (text) => {
        const d = Number(text);
        const q = n / d;
        return Number.isInteger(q)
          ? `${fmt(d)} is a factor of ${fmt(n)}.`
          : `${fmt(n)} / ${fmt(d)} = ${(n / d).toFixed(2)} with a remainder, so ${fmt(d)} is not a factor.`;
      },
    });
  },
};

/** Multiples: skip-counting from a base number. */
const multiples: Topic = {
  id: 'multiples',
  name: 'Multiples',
  family: 'number',
  band: 'elementary',
  grades: 'Grades 4-7',
  blurb: 'Skip-count from a base number and munch every landing spot.',
  round(rng: Rng, level: number) {
    const base = rng.int(2, Math.min(12, 4 + level));
    const top = base * 24;
    const correctPool = Array.from({ length: 16 }, (_, i) => fmt(base * (i + 1)));

    const incorrectPool: string[] = [];
    for (let v = base + 1; v <= top + base; v++) {
      if (v % base !== 0) incorrectPool.push(fmt(v));
    }

    return makeRound({
      rng,
      heading: `Multiples of ${base}`,
      instruction: `Munch every multiple of ${base}.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 10,
      explain: (text) => {
        const v = Number(text);
        return `${fmt(v)} / ${base} = ${(v / base).toFixed(2)}, so ${fmt(v)} is not a multiple of ${base}.`;
      },
    });
  },
};

/** Even / Odd: the original game's warm-up category. */
const evenOdd: Topic = {
  id: 'even-odd',
  name: 'Even & Odd',
  family: 'number',
  band: 'elementary',
  grades: 'Grades 3-5',
  blurb: 'Split the board by divisibility by two.',
  round(rng: Rng, level: number) {
    const wantEven = rng.chance(0.5);
    const max = 40 + level * 14;
    const evens: string[] = [];
    const odds: string[] = [];
    for (let n = 1; n <= max; n++) (n % 2 === 0 ? evens : odds).push(fmt(n));

    return makeRound({
      rng,
      heading: wantEven ? 'Even Numbers' : 'Odd Numbers',
      instruction: `Munch every ${wantEven ? 'even' : 'odd'} number.`,
      correct: wantEven ? evens : odds,
      incorrect: wantEven ? odds : evens,
      correctCount: 11,
      explain: (text) => `${fmt(Number(text))} ends in ${text.slice(-1)}, so it is ${Number(text) % 2 === 0 ? 'even' : 'odd'}.`,
    });
  },
};

/** Perfect squares. */
const squares: Topic = {
  id: 'perfect-squares',
  name: 'Squares',
  family: 'number',
  band: 'middle',
  grades: 'Grades 6-9',
  blurb: 'Recognise squares of whole numbers, including their near misses.',
  round(rng: Rng, level: number) {
    const top = 10 + level * 2;
    const correctPool = Array.from({ length: 12 }, (_, i) => fmt((i + 1) ** 2)).slice(-12);
    const incorrectPool: string[] = [];
    for (let i = 2; i < top + 6; i++) {
      for (const d of [1, 2, 3, -1, -2]) {
        const v = i * i + d;
        if (v > 0 && !Number.isInteger(Math.sqrt(v))) incorrectPool.push(fmt(v));
      }
    }
    return makeRound({
      rng,
      heading: 'Perfect Squares',
      instruction: 'Munch every perfect square.',
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const n = Number(text);
        return `${n} is between ${Math.floor(Math.sqrt(n))}\u00b2 = ${Math.floor(Math.sqrt(n)) ** 2} and ${Math.ceil(Math.sqrt(n))}\u00b2 = ${Math.ceil(Math.sqrt(n)) ** 2}, so it is not a perfect square.`;
      },
    });
  },
};

/** Divisibility rules for a random small divisor. */
const divisibility: Topic = {
  id: 'divisibility',
  name: 'Divisibility',
  family: 'number',
  band: 'middle',
  grades: 'Grades 5-8',
  blurb: 'Use divisibility tests instead of long division.',
  round(rng: Rng, level: number) {
    const d = rng.pick([3, 4, 6, 9, 11] as const);
    const span = 14 + Math.min(8, level);
    const correct = Array.from({ length: span }, (_, k) => fmt(d * (k + 1)));

    const incorrect: string[] = [];
    for (let k = 1; k <= span; k++) {
      const base = d * k;
      for (const delta of [1, 2]) {
        const v = base + delta;
        if (v % d !== 0) incorrect.push(fmt(v));
      }
    }
    return makeRound({
      rng,
      heading: `Divisible by ${d}`,
      instruction: `Munch every number divisible by ${d}.`,
      correct,
      incorrect,
      correctCount: 11,
      explain: (text) => {
        const n = Number(text);
        const digitSum = [...text].reduce((a, c) => a + (Number.isNaN(Number(c)) ? 0 : Number(c)), 0);
        if (d === 3) return `${fmt(n)}: digit sum ${digitSum} is not a multiple of 3.`;
        if (d === 9) return `${fmt(n)}: digit sum ${digitSum} is not a multiple of 9.`;
        if (d === 4) return `${fmt(n)}: the last two digits (${text.slice(-2)}) are not divisible by 4.`;
        if (d === 11) return `${fmt(n)}: alternating digit sum is not a multiple of 11.`;
        return `${fmt(n)} / ${d} leaves a remainder of ${n % d}.`;
      },
    });
  },
};

export const numberTheoryTopics: Topic[] = [primes, factors, multiples, evenOdd, squares, divisibility];
