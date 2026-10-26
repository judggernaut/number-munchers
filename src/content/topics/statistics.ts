import { makeRound } from '../build';
import { type Rng, type Topic } from '../types';

const ASCII = /^[\x20-\x7E]+$/;
const fits = (text: string): boolean => text.length > 0 && text.length <= 9 && ASCII.test(text);

const dedupe = (items: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item) || !fits(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
};

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

const formatNum = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded === 0 ? 0 : rounded);
};

const formatPercent = (value: number): string => `${formatNum(value)}%`;

interface Rat {
  num: number;
  den: number;
}

const rat = (num: number, den: number): Rat => {
  if (den === 0) return { num: 0, den: 1 };
  const sign = den < 0 ? -1 : 1;
  const g = gcd(num, den);
  return { num: (sign * num) / g, den: Math.abs(den) / g };
};

const ratValue = (r: Rat): number => r.num / r.den;

const decimalText = (value: number): string | null => {
  for (let places = 1; places <= 4; places++) {
    const text = value.toFixed(places);
    if (Math.abs(Number(text) - value) < 1e-10) {
      return text.replace(/\.?0+$/, '');
    }
  }
  return null;
};

const rationalForms = (
  r: Rat,
  options: { decimal?: boolean; percent?: boolean; scaleMax?: number } = {},
): string[] => {
  const { num, den } = r;
  const out: string[] = [];
  const add = (text: string): void => {
    if (fits(text)) out.push(text);
  };
  if (den === 1) {
    add(`${num}`);
    add(`${num}.0`);
  } else {
    add(`${num}/${den}`);
  }
  const value = ratValue(r);
  if (options.decimal) {
    const text = decimalText(value);
    if (text) add(text);
  }
  if (options.percent) {
    const pct = value * 100;
    const text = formatNum(pct);
    if (Math.abs(Number(text) - pct) < 1e-9) add(`${text}%`);
  }
  if (den === 1) {
    for (let k = 2; k <= (options.scaleMax ?? 12); k++) add(`${k * num}/${k}`);
  } else {
    for (let k = 2; k <= (options.scaleMax ?? 12); k++) add(`${k * num}/${k * den}`);
  }
  return dedupe(out);
};

const readPlain = (text: string): number | null => {
  if (text.endsWith('%')) {
    const n = Number(text.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : null;
  }
  const m = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(text);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

const wrongNumberTexts = (answer: number, candidates: number[], count = 24): string[] => {
  const texts: string[] = [];
  const seen = new Set<string>();
  for (const value of candidates) {
    if (!Number.isFinite(value)) continue;
    if (Math.abs(value - answer) < 1e-9) continue;
    if (value < 0) continue;
    const text = formatNum(value);
    if (!fits(text) || seen.has(text)) continue;
    seen.add(text);
    texts.push(text);
    if (texts.length >= count) break;
  }
  return texts;
};

const offsets = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
const around = (value: number): number[] => {
  const out: number[] = [];
  for (const d of offsets) out.push(value + d, Math.max(0, value - d));
  return out;
};

/* ------------------------------------------------------------------ */
/* Mean, median, mode                                                  */
/* ------------------------------------------------------------------ */

type StatMode = 'mean' | 'median' | 'mode';

const makeData = (rng: Rng, level: number, mode: StatMode): number[] => {
  const max = Math.min(30, 9 + level * 2);
  const n = mode === 'median' ? (level >= 14 ? 7 : 5) : 5 + (level >= 10 ? 1 : 0) + (level >= 17 ? 1 : 0);
  if (mode === 'mode') {
    const modeValue = rng.int(1, max);
    const values: number[] = [modeValue, modeValue];
    const used = new Set<number>([modeValue]);
    while (values.length < n) {
      const value = rng.int(1, max);
      if (used.has(value)) continue;
      used.add(value);
      values.push(value);
    }
    return rng.shuffle(values);
  }
  return Array.from({ length: n }, () => rng.int(1, max));
};

const meanOf = (values: number[]): Rat => rat(values.reduce((a, b) => a + b, 0), values.length);

const medianOf = (values: number[]): Rat => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return rat(sorted[mid]!, 1);
  return rat(sorted[mid - 1]! + sorted[mid]!, 2);
};

const modeOf = (values: number[]): number => {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0]!;
  let bestCount = 0;
  for (const [v, count] of counts) {
    if (count > bestCount || (count === bestCount && v < best)) {
      best = v;
      bestCount = count;
    }
  }
  return best;
};

const centralTendency: Topic = {
  id: 'central-tendency',
  name: 'Mean, Median, Mode',
  family: 'statistics',
  band: 'middle',
  grades: 'Grades 6-9',
  blurb: 'Average a data set, find its middle, or spot the most common value.',
  round(rng: Rng, level: number) {
    const mode: StatMode = level < 5
      ? rng.pick(['mean', 'median'] as const)
      : rng.pick(['mean', 'median', 'mode'] as const);
    const values = makeData(rng, level, mode);
    const sorted = values.slice().sort((a, b) => a - b);
    const mean = meanOf(values);
    const median = medianOf(values);
    const modeValue = modeOf(values);

    const answerRat = mode === 'mean' ? mean : mode === 'median' ? median : rat(modeValue, 1);
    const answer = ratValue(answerRat);
    const correctForms = rationalForms(answerRat, { decimal: true, scaleMax: 14 });
    const correctPool = correctForms.slice(0, 10);
    const correctSet = new Set(correctPool);

    const meanValue = ratValue(mean);
    const medianValue = ratValue(median);
    const range = sorted[sorted.length - 1]! - sorted[0]!;
    const sum = values.reduce((a, b) => a + b, 0);
    const midrange = (sorted[0]! + sorted[sorted.length - 1]!) / 2;
    const wrongCandidates = [
      ...around(answer),
      meanValue, medianValue, modeValue, range, sum, values.length, midrange,
      meanValue + 0.5, medianValue + 0.5, modeValue + 1,
    ];
    const wrongTexts = wrongNumberTexts(answer, wrongCandidates, 28);
    const incorrectPool = rng.shuffle(wrongTexts).filter((t) => !correctSet.has(t)).slice(0, 28);

    const computation = mode === 'mean'
      ? `sum = ${values.join('+')} = ${sum}; mean = ${sum}/${values.length} = ${formatNum(answer)}`
      : mode === 'median'
        ? `sorted: ${sorted.join(',')}; median = ${formatNum(answer)}`
        : `mode = ${modeValue} (it appears ${values.filter((v) => v === modeValue).length} times)`;

    return makeRound({
      rng,
      heading: `Data: ${values.join(',')}`,
      instruction: `Munch every tile equal to the ${mode}.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const value = readPlain(text);
        return value !== null && Math.abs(value - answer) < 1e-9
          ? `${text} equals ${formatNum(answer)}; ${computation}, so it matches.`
          : `${text} is not the ${mode}; ${computation}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* Probability                                                         */
/* ------------------------------------------------------------------ */

type ProbabilityScenario = {
  heading: string;
  favorable: number;
  total: number;
  description: string;
};

const DIE_EVENTS = [
  { label: 'even', fav: 3, desc: 'the even faces 2, 4, 6' },
  { label: '>4', fav: 2, desc: 'the faces 5 and 6' },
  { label: 'prime', fav: 3, desc: 'the prime faces 2, 3, 5' },
  { label: '<3', fav: 2, desc: 'the faces 1 and 2' },
  { label: 'not 6', fav: 5, desc: 'all faces except 6' },
  { label: '3', fav: 1, desc: 'the single face 3' },
];

const DICE_EVENTS = [
  { label: 'sum 7', fav: 6, desc: '6 of the 36 ordered outcomes sum to 7' },
  { label: 'sum 12', fav: 1, desc: 'only 6+6 sums to 12' },
  { label: 'doubles', fav: 6, desc: '6 doubles out of 36 outcomes' },
  { label: 'sum>9', fav: 6, desc: '6 outcomes have a sum above 9' },
  { label: 'sum 5', fav: 4, desc: '4 outcomes sum to 5' },
];

const probabilityScenario = (rng: Rng, level: number): ProbabilityScenario => {
  const kind = level < 6
    ? rng.pick(['die', 'coin'] as const)
    : rng.pick(['die', 'coin', 'bag', 'dice'] as const);
  if (kind === 'die') {
    const event = rng.pick(DIE_EVENTS);
    return {
      heading: `Die: P(${event.label})`,
      favorable: event.fav,
      total: 6,
      description: `${event.desc} out of 6 faces`,
    };
  }
  if (kind === 'coin') {
    const events = [
      { label: '2 heads', fav: 1, desc: 'HH is 1 of 4 equally likely outcomes' },
      { label: '1 head', fav: 2, desc: 'HT and TH are 2 of 4 outcomes' },
      { label: 'at least 1 head', fav: 3, desc: '3 of 4 outcomes contain a head' },
    ];
    const event = rng.pick(events);
    return {
      heading: `2 coins: P(${event.label})`,
      favorable: event.fav,
      total: 4,
      description: event.desc,
    };
  }
  if (kind === 'bag') {
    const red = rng.int(1, 6);
    const blue = rng.int(1, 6);
    const color = rng.pick(['red', 'blue'] as const);
    const fav = color === 'red' ? red : blue;
    return {
      heading: `Bag: ${red}R,${blue}B: P(${color})`,
      favorable: fav,
      total: red + blue,
      description: `${fav} ${color} marbles out of ${red + blue}`,
    };
  }
  const event = rng.pick(DICE_EVENTS);
  return {
    heading: `2 dice: P(${event.label})`,
    favorable: event.fav,
    total: 36,
    description: event.desc,
  };
};

const probability: Topic = {
  id: 'probability',
  name: 'Probability',
  family: 'statistics',
  band: 'middle',
  grades: 'Grades 7-10',
  blurb: 'Favourable outcomes over total outcomes, as fractions or decimals.',
  round(rng: Rng, level: number) {
    const scenario = probabilityScenario(rng, level);
    const p = rat(scenario.favorable, scenario.total);
    const value = ratValue(p);
    const correctForms = rationalForms(p, { decimal: true, percent: true, scaleMax: 12 });
    const correctPool = correctForms.slice(0, 10);
    const correctSet = new Set(correctPool);

    const wrongRatios: [number, number][] = [
      [scenario.total - scenario.favorable, scenario.total],
      [scenario.favorable, scenario.total + 1],
      [scenario.favorable + 1, scenario.total],
      [scenario.favorable, Math.max(1, scenario.total - 1)],
      [Math.max(0, scenario.favorable - 1), scenario.total],
      [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5],
      [3, 5], [4, 5], [1, 6], [5, 6], [1, 8], [3, 8], [5, 8], [7, 8],
      [0, 1], [1, 1],
    ];
    const wrongTexts: string[] = [];
    for (const [n, d] of wrongRatios) {
      if (d <= 0) continue;
      if (Math.abs(n / d - value) < 1e-12) continue;
      const r = rat(n, d);
      const base = `${r.num}/${r.den}`;
      if (fits(base) && !correctSet.has(base) && !wrongTexts.includes(base)) wrongTexts.push(base);
      const dec = decimalText(n / d);
      if (dec && fits(dec) && !correctSet.has(dec) && !wrongTexts.includes(dec)) wrongTexts.push(dec);
      for (let k = 2; k <= 3; k++) {
        const text = `${r.num * k}/${r.den * k}`;
        if (fits(text) && !correctSet.has(text) && !wrongTexts.includes(text)) wrongTexts.push(text);
      }
    }
    const incorrectPool = rng.shuffle(wrongTexts).slice(0, 28);

    const targetLabel = scenario.heading.slice(scenario.heading.lastIndexOf(':') + 1).trim();
    return makeRound({
      rng,
      heading: scenario.heading,
      instruction: `Munch every tile equal to ${targetLabel}.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const tile = readPlain(text);
        return tile !== null && Math.abs(tile - value) < 1e-9
          ? `${text} equals ${scenario.favorable}/${scenario.total} = ${formatNum(value)}; favourable outcomes = ${scenario.favorable}, total = ${scenario.total}, so it matches.`
          : `${text} is not ${scenario.favorable}/${scenario.total} = ${formatNum(value)}; favourable outcomes = ${scenario.favorable}, total = ${scenario.total}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* Counting                                                            */
/* ------------------------------------------------------------------ */

const factorial = (n: number): number => {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
};

const nPr = (n: number, r: number): number => factorial(n) / factorial(n - r);
const nCr = (n: number, r: number): number => nPr(n, r) / factorial(r);

const counting: Topic = {
  id: 'counting',
  name: 'Counting & Combinations',
  family: 'statistics',
  band: 'high',
  grades: 'Grades 9-12',
  blurb: 'Permutations and combinations without listing every case.',
  round(rng: Rng, level: number) {
    const usePermutation = rng.chance(0.5);
    const n = rng.int(4, Math.min(10, 5 + level));
    const r = rng.int(2, Math.min(Math.min(4, n - 1), 2 + Math.floor(level / 4)));
    const answer = usePermutation ? nPr(n, r) : nCr(n, r);
    const expression = `${n}${usePermutation ? 'P' : 'C'}${r}`;

    const correctForms = rationalForms(rat(answer, 1), { scaleMax: 14 });
    const correctPool = correctForms.slice(0, 10);
    const correctSet = new Set(correctPool);

    const other = usePermutation ? nCr(n, r) : nPr(n, r);
    const wrongValues = [
      ...around(answer),
      other, factorial(n), n ** r, n * r, n + r, Math.abs(n - r),
      nPr(n - 1, r), nCr(n - 1, r), answer * 2, Math.floor(answer / 2),
      answer + 10, answer + 20, answer - 5,
    ];
    const wrongTexts = wrongNumberTexts(answer, wrongValues, 28);
    const incorrectPool = rng.shuffle(wrongTexts).filter((t) => !correctSet.has(t)).slice(0, 28);

    const computation = usePermutation
      ? `${n}P${r} = ${Array.from({ length: r }, (_, i) => n - i).join(' x ')} = ${answer}`
      : `${n}C${r} = (${Array.from({ length: r }, (_, i) => n - i).join(' x ')}) / ${r}! = ${answer}`;

    return makeRound({
      rng,
      heading: `${usePermutation ? 'Permutation' : 'Combination'} ${expression}`,
      instruction: `Munch every numeric tile equal to ${expression}.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const value = readPlain(text);
        return value !== null && Math.abs(value - answer) < 1e-9
          ? `${text} equals ${answer}; ${computation}, so it matches.`
          : `${text} is not ${answer}; ${computation}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* Percent change                                                      */
/* ------------------------------------------------------------------ */

const PERCENTS = [10, 20, 25, 50, 75, 100, -10, -20, -25, -50];

const percentChange: Topic = {
  id: 'percent-change',
  name: 'Percent Change',
  family: 'statistics',
  band: 'middle',
  grades: 'Grades 7-9',
  blurb: 'Find the percent increase or decrease between two values.',
  round(rng: Rng, level: number) {
    const percentages = level < 10 ? PERCENTS : [...PERCENTS, 12.5, -12.5];
    const percent = rng.pick(percentages);
    const denominator = percent === 12.5 || percent === -12.5 ? 8 : percent === 25 || percent === -25 || percent === 75 ? 4 : percent === 10 || percent === -10 ? 10 : percent === 20 || percent === -20 ? 5 : 2;
    const oldValue = denominator * rng.int(2, Math.min(20, 3 + level));
    const newValue = Math.round(oldValue * (1 + percent / 100));

    const fraction = rat(Math.round(percent * 10), 1000);
    const fractionForms = rationalForms(fraction, { scaleMax: 10 });
    const correctForms = dedupe([
      formatPercent(percent),
      formatNum(percent),
      ...fractionForms,
      formatNum(percent / 100),
      ...(Number.isInteger(percent) ? [`${formatNum(percent)}.0%`] : []),
    ]);
    const correctPool = correctForms.slice(0, 10);
    const correctSet = new Set(correctPool);

    const difference = newValue - oldValue;
    const wrongValues = [
      -percent, difference, percent + 5, percent - 5, percent + 10, percent - 10,
      percent / 2, percent * 2, percent + 100, percent - 100,
      (difference / newValue) * 100, (newValue / oldValue) * 100,
      (oldValue / newValue) * 100, percent + 0.5, percent - 0.5,
      percent + 1, percent - 1, percent + 20, percent - 20,
    ];
    const wrongTexts: string[] = [];
    for (const v of wrongValues) {
      if (Math.abs(v - percent) < 1e-9) continue;
      for (const text of [formatPercent(v), formatNum(v)]) {
        if (!fits(text) || correctSet.has(text) || wrongTexts.includes(text)) continue;
        wrongTexts.push(text);
      }
    }
    const incorrectPool = rng.shuffle(wrongTexts).slice(0, 28);

    return makeRound({
      rng,
      heading: `${oldValue} -> ${newValue}: percent change`,
      instruction: 'Munch every tile equal to the percent change.',
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const raw = text.endsWith('%')
          ? Number(text.slice(0, -1))
          : /^-?\d+(?:\.\d+)?\/-?\d+(?:\.\d+)?$/.test(text)
            ? Number(text.split('/')[0]) / Number(text.split('/')[1])
            : Number(text);
        const matches = Number.isFinite(raw)
          && (Math.abs(raw - percent) < 1e-9 || Math.abs(raw * 100 - percent) < 1e-9);
        return matches
          ? `${text} equals ${formatPercent(percent)}; (${newValue} - ${oldValue}) / ${oldValue} x 100 = ${formatPercent(percent)}, so it matches.`
          : `${text} is not ${formatPercent(percent)}; (${newValue} - ${oldValue}) / ${oldValue} x 100 = ${formatPercent(percent)}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* Range and IQR                                                       */
/* ------------------------------------------------------------------ */

type SpreadMode = 'range' | 'iqr' | 'sd';

const quantilePair = (sorted: number[]): [number, number] => {
  if (sorted.length === 5) return [sorted[1]!, sorted[3]!];
  if (sorted.length === 7) return [sorted[1]!, sorted[5]!];
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, mid);
  const upper = sorted.slice(mid + 1);
  const q1 = lower.length % 2 === 1 ? lower[Math.floor(lower.length / 2)]! : (lower[lower.length / 2 - 1]! + lower[lower.length / 2]!) / 2;
  const q3 = upper.length % 2 === 1 ? upper[Math.floor(upper.length / 2)]! : (upper[upper.length / 2 - 1]! + upper[upper.length / 2]!) / 2;
  return [q1, q3];
};

const spread: Topic = {
  id: 'spread',
  name: 'Range & IQR',
  family: 'statistics',
  band: 'high',
  grades: 'Grades 9-11',
  blurb: 'Measure how spread out a data set is with range, IQR or SD.',
  round(rng: Rng, level: number) {
    const mode: SpreadMode = level < 7
      ? rng.pick(['range', 'iqr'] as const)
      : rng.pick(['range', 'iqr', 'sd'] as const);
    const max = Math.min(30, 10 + level * 2);
    const values = Array.from({ length: 5 }, () => rng.int(1, max));
    if (new Set(values).size === 1) values[0] = Math.max(1, values[0]! - 1);
    const sorted = values.slice().sort((a, b) => a - b);
    const range = sorted[sorted.length - 1]! - sorted[0]!;
    const [q1, q3] = quantilePair(sorted);
    const iqr = q3 - q1;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);
    const sdRounded = Math.round(sd * 10) / 10;
    const answer = mode === 'range' ? range : mode === 'iqr' ? iqr : sdRounded;

    const answerRat = mode === 'sd' ? rat(Math.round(sdRounded * 10), 10) : rat(answer, 1);
    const correctForms = rationalForms(answerRat, { decimal: true, scaleMax: 12 });
    const correctPool = correctForms.slice(0, 10);
    const correctSet = new Set(correctPool);

    const wrongCandidates = [
      ...around(answer),
      range, iqr, Math.round(sdRounded), Math.round(variance * 10) / 10,
      mean, (sorted[0]! + sorted[sorted.length - 1]!) / 2,
      ...around(range), ...around(iqr),
    ];
    const wrongTexts = wrongNumberTexts(answer, wrongCandidates, 28);
    const incorrectPool = rng.shuffle(wrongTexts).filter((t) => !correctSet.has(t)).slice(0, 28);

    const computation = mode === 'range'
      ? `range = max - min = ${sorted[sorted.length - 1]} - ${sorted[0]} = ${range}`
      : mode === 'iqr'
        ? `sorted: ${sorted.join(',')}; Q1 = ${formatNum(q1)}, Q3 = ${formatNum(q3)}, IQR = ${formatNum(iqr)}`
        : `mean = ${formatNum(mean)}; variance = ${formatNum(Math.round(variance * 1000) / 1000)}; SD = sqrt(variance) = ${formatNum(sdRounded)} (1 dp)`;

    return makeRound({
      rng,
      heading: `Data: ${values.join(',')}`,
      instruction: `Munch every tile equal to the ${mode === 'range' ? 'range' : mode === 'iqr' ? 'interquartile range' : 'population standard deviation (1 dp)'}.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const value = readPlain(text);
        return value !== null && Math.abs(value - answer) < 1e-9
          ? `${text} equals ${formatNum(answer)}; ${computation}, so it matches.`
          : `${text} is not ${formatNum(answer)}; ${computation}.`;
      },
    });
  },
};

/* ------------------------------------------------------------------ */
/* Unit rates                                                          */
/* ------------------------------------------------------------------ */

type RateScenario = {
  heading: string;
  label: string;
  numerator: number;
  denominator: number;
};

const RATE_SCENARIOS: RateScenario[] = [
  { heading: 'Rate: 12 apples / $3', label: 'apples per dollar', numerator: 12, denominator: 3 },
  { heading: 'Rate: 20 miles / 4 hours', label: 'miles per hour', numerator: 20, denominator: 4 },
  { heading: 'Rate: 15 pages / 3 hours', label: 'pages per hour', numerator: 15, denominator: 3 },
  { heading: 'Rate: 24 students / 6 groups', label: 'students per group', numerator: 24, denominator: 6 },
  { heading: 'Rate: 3 pizzas / 8 people', label: 'pizzas per person', numerator: 3, denominator: 8 },
  { heading: 'Rate: 12 dollars / 8 pounds', label: 'dollars per pound', numerator: 12, denominator: 8 },
  { heading: 'Rate: 9 laps / 6 minutes', label: 'laps per minute', numerator: 9, denominator: 6 },
  { heading: 'Rate: 7 books / 2 weeks', label: 'books per week', numerator: 7, denominator: 2 },
];

const unitRates: Topic = {
  id: 'unit-rates',
  name: 'Unit Rates',
  family: 'statistics',
  band: 'middle',
  grades: 'Grades 6-8',
  blurb: 'Reduce a rate to its per-one value.',
  round(rng: Rng, level: number) {
    const available = level < 6 ? RATE_SCENARIOS.slice(0, 4) : RATE_SCENARIOS;
    const scenario = rng.pick(available);
    const rate = rat(scenario.numerator, scenario.denominator);
    const value = ratValue(rate);

    const correctForms = rationalForms(rate, { decimal: true, scaleMax: 12 });
    const correctPool = correctForms.slice(0, 10);
    const correctSet = new Set(correctPool);

    const wrongValues = [
      ...around(value),
      scenario.denominator / scenario.numerator,
      scenario.numerator + scenario.denominator,
      scenario.numerator - scenario.denominator,
      scenario.numerator * scenario.denominator,
      value + 0.5, value - 0.5, value / 2, value * 2,
    ];
    const wrongFractionTexts: string[] = [];
    for (const [n, d] of [
      [scenario.denominator, scenario.numerator],
      [scenario.numerator, scenario.denominator + 1],
      [scenario.numerator + 1, scenario.denominator],
      [scenario.numerator, Math.max(1, scenario.denominator - 1)],
    ]) {
      if (d <= 0) continue;
      const r = rat(n, d);
      for (let k = 1; k <= 3; k++) {
        const text = `${r.num * k}/${r.den * k}`;
        if (fits(text) && !correctSet.has(text) && !wrongFractionTexts.includes(text) && Math.abs(n / d - value) > 1e-12) {
          wrongFractionTexts.push(text);
        }
      }
    }
    const wrongTexts = rng
      .shuffle([...wrongFractionTexts, ...wrongNumberTexts(value, wrongValues, 28)])
      .filter((t) => !correctSet.has(t))
      .slice(0, 28);
    const incorrectPool = rng.shuffle(dedupe(wrongTexts)).slice(0, 28);

    return makeRound({
      rng,
      heading: scenario.heading,
      instruction: `Munch every tile equal to the unit rate (${scenario.label}).`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const tile = readPlain(text);
        return tile !== null && Math.abs(tile - value) < 1e-9
          ? `${text} equals ${formatNum(value)}; ${scenario.numerator} / ${scenario.denominator} = ${formatNum(value)} ${scenario.label}, so it matches.`
          : `${text} is not ${formatNum(value)}; ${scenario.numerator} / ${scenario.denominator} = ${formatNum(value)} ${scenario.label}.`;
      },
    });
  },
};

export const statisticsTopics: Topic[] = [
  centralTendency,
  probability,
  counting,
  percentChange,
  spread,
  unitRates,
];
