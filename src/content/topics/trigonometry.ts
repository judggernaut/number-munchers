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

const fractionText = (a: number, b: number): string => `${a}/${b}`;

const readFraction = (text: string): [number, number] | null => {
  const m = /^(-?\d+)\/(\d+)$/.exec(text);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
};

const simplify = (a: number, b: number): [number, number] => {
  const g = gcd(a, b);
  return [a / g, b / g];
};

type TrigFn = 'sin' | 'cos' | 'tan';

const TRIG_TRIANGLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [9, 40, 41],
  [20, 21, 29],
];

const trigRatios: Topic = {
  id: 'trig-ratios',
  name: 'Trig Ratios',
  family: 'trigonometry',
  band: 'high',
  grades: 'Grades 9-11',
  blurb: 'Write sin, cos and tan as fractions from a right triangle.',
  round(rng: Rng, level: number) {
    const available = TRIG_TRIANGLES.filter(([, , c]) => c <= 12 + level * 4);
    const [a, b, c] = rng.pick(available.length > 0 ? available : TRIG_TRIANGLES.slice(0, 2));
    const fn: TrigFn = rng.pick(['sin', 'cos', 'tan'] as const);
    const [num, den] = fn === 'sin' ? [a, c] : fn === 'cos' ? [b, c] : [a, b];

    const correctForms: string[] = [];
    for (let k = 1; k <= 12; k++) {
      const text = fractionText(k * num, k * den);
      if (fits(text)) correctForms.push(text);
    }
    const correctPool = rng.shuffle(dedupe(correctForms)).slice(0, 10);
    const correctSet = new Set(correctPool);

    const baseWrong: [number, number][] = [
      [b, c], [a, b], [b, a], [c, a], [c, b],
      [a, a + b], [b, a + b], [a + b, c], [c, a + b],
      [a + 1, c], [a, c + 1], [b + 1, c], [b, c + 1],
      [num + 1, den], [num, den + 1], [num + 2, den],
      [1, 2], [1, 3], [2, 3], [3, 4], [2, 5], [3, 5], [4, 5],
    ];
    const wrongTexts: string[] = [];
    const wrongValues = new Map<string, number>();
    for (const [n0, d0] of baseWrong) {
      if (d0 <= 0) continue;
      for (let k = 1; k <= 3; k++) {
        if (Math.max(n0 * k, d0 * k) > 48) continue;
        const text = fractionText(n0 * k, d0 * k);
        if (!fits(text) || correctSet.has(text) || wrongTexts.includes(text)) continue;
        if (Math.abs(n0 / d0 - num / den) < 1e-12) continue;
        wrongTexts.push(text);
        wrongValues.set(text, n0 / d0);
      }
    }
    const incorrectPool = rng.shuffle(wrongTexts).slice(0, 28);

    const sideHint = fn === 'sin'
      ? `opp=${a}, hyp=${c}`
      : fn === 'cos'
        ? `adj=${b}, hyp=${c}`
        : `opp=${a}, adj=${b}`;
    return makeRound({
      rng,
      heading: `Right tri ${a}-${b}-${c}: ${fn} A`,
      instruction: `Munch every fraction equal to ${fn} A. (${sideHint})`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const fraction = readFraction(text);
        const given = `${fn} A = ${num}/${den}`;
        if (!fraction) return `${text} is not a fraction; ${given}.`;
        const [n, d] = simplify(fraction[0], fraction[1]);
        return n === num && d === den
          ? `${text} = ${n}/${d}, so it equals ${given}.`
          : `${text} = ${n}/${d}, but ${given}, so it does not match.`;
      },
    });
  },
};

type SpecialKind =
  | 'zero'
  | 'half'
  | 'sqrt2half'
  | 'sqrt3half'
  | 'one'
  | 'negOne'
  | 'sqrt3'
  | 'sqrt3third'
  | 'undef';

const SPECIAL_FORMS: Record<SpecialKind, string[]> = {
  zero: ['0', '0/2', '0/7', '0.0', '0.00', '0+0', '5-5', '0*9', 'sqrt(0)', '2*0'],
  half: ['1/2', '2/4', '3/6', '4/8', '5/10', '6/12', '0.5', '0.50', '50%', '7/14'],
  sqrt2half: [
    'sqrt(2)/2', 'sqrt2/2', 'sqrt(1/2)', '1/sqrt2', 'sqrt8/4',
    'sqrt(8)/4', 'sqrt18/6', '0.5sqrt2', '1/2*sqrt2', '2^.5/2',
  ],
  sqrt3half: [
    'sqrt(3)/2', 'sqrt3/2', 'sqrt(3/4)', 'sqrt27/6', '3sqrt3/6',
    '0.5sqrt3', '1/2*sqrt3', '3^.5/2', '3^0.5/2', 'sqrt3/2*1',
  ],
  one: ['1', '2/2', '3/3', '4/4', '5/5', '1.0', '100%', 'sqrt(1)', '7/7', '6/6'],
  negOne: ['-1', '-2/2', '-3/3', '-4/4', '-5/5', '-6/6', '-7/7', '-8/8', '-1.0', '0-1'],
  sqrt3: [
    'sqrt3', 'sqrt(3)', '3^.5', '3^0.5', 'sqrt12/2',
    'sqrt27/3', 'sqrt3/1', 'sqrt3*1', '2sqrt3/2', '6/sqrt12',
  ],
  sqrt3third: [
    'sqrt3/3', '1/sqrt3', 'sqrt(3)/3', 'sqrt(1/3)', 'sqrt12/6',
    'sqrt27/9', '3^-0.5', 'sqrt3/3*1', 'sqrt3/3.0', '1/3*sqrt3',
  ],
  undef: ['undef', 'undefined', 'novalue', 'DNE', '1/0', '-1/0', 'x/0', 'infinite', 'NaN', 'noanswer'],
};

const KIND_LABEL: Record<SpecialKind, string> = {
  zero: '0',
  half: '1/2',
  sqrt2half: 'sqrt(2)/2',
  sqrt3half: 'sqrt(3)/2',
  one: '1',
  negOne: '-1',
  sqrt3: 'sqrt(3)',
  sqrt3third: 'sqrt(3)/3',
  undef: 'undefined',
};

const SPECIAL_VALUES: Record<number, Record<TrigFn, SpecialKind>> = {
  0: { sin: 'zero', cos: 'one', tan: 'zero' },
  30: { sin: 'half', cos: 'sqrt3half', tan: 'sqrt3third' },
  45: { sin: 'sqrt2half', cos: 'sqrt2half', tan: 'one' },
  60: { sin: 'sqrt3half', cos: 'half', tan: 'sqrt3' },
  90: { sin: 'one', cos: 'zero', tan: 'undef' },
  180: { sin: 'zero', cos: 'negOne', tan: 'zero' },
  270: { sin: 'negOne', cos: 'zero', tan: 'undef' },
};

const specialAngles: Topic = {
  id: 'special-angles',
  name: 'Special Angles',
  family: 'trigonometry',
  band: 'high',
  grades: 'Grades 10-12',
  blurb: 'Exact sine, cosine and tangent values at benchmark angles.',
  round(rng: Rng, level: number) {
    const angles = level < 8 ? [0, 30, 45, 60, 90] : [0, 30, 45, 60, 90, 180, 270];
    const angle = rng.pick(angles);
    const fn: TrigFn = rng.pick(['sin', 'cos', 'tan'] as const);
    const kind = SPECIAL_VALUES[angle]![fn];

    const correctForms = dedupe(SPECIAL_FORMS[kind]);
    const correctMap = new Map(correctForms.map((text) => [text, kind]));
    const correctPool = rng.shuffle(correctForms).slice(0, 10);
    const correctSet = new Set(correctPool);

    const otherKinds = (Object.keys(SPECIAL_FORMS) as SpecialKind[]).filter((k) => k !== kind);
    const wrongTexts: string[] = [];
    const wrongKinds = new Map<string, SpecialKind>();
    for (const k of otherKinds) {
      for (const text of SPECIAL_FORMS[k]) {
        if (!fits(text) || correctSet.has(text) || wrongTexts.includes(text)) continue;
        wrongTexts.push(text);
        wrongKinds.set(text, k);
      }
    }
    for (const text of ['1/3', '2/3', 'sqrt2', '-1/2', '0.866', '0.707', '45', '60', '90', '180']) {
      if (!fits(text) || correctSet.has(text) || wrongTexts.includes(text)) continue;
      wrongTexts.push(text);
    }
    const wrongMap = new Map<string, SpecialKind>(wrongKinds);
    const incorrectPool = rng.shuffle(wrongTexts).slice(0, 28);

    const display = kind === 'undef' ? 'undefined' : KIND_LABEL[kind];
    return makeRound({
      rng,
      heading: `${fn} ${angle} deg`,
      instruction: `Munch every tile equal to the exact value of ${fn} ${angle} deg.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const isCorrect = correctMap.has(text);
        if (kind === 'undef') {
          return isCorrect
            ? `${text} means undefined; ${fn} ${angle} deg is undefined because the ratio has denominator 0.`
            : `${text} is not undefined; ${fn} ${angle} deg is undefined because the ratio has denominator 0.`;
        }
        const wrongKind = wrongMap.get(text);
        if (isCorrect) {
          return `${text} equals ${display}; ${fn} ${angle} deg = ${display}.`;
        }
        if (wrongKind) {
          return `${text} equals ${KIND_LABEL[wrongKind]}, not ${display}; ${fn} ${angle} deg = ${display}.`;
        }
        return `${text} is not ${display}; ${fn} ${angle} deg = ${display}.`;
      },
    });
  },
};

type IdentityMode = 'pythag' | 'cos2x' | 'sin2x' | 'tanx' | 'cosSq';

const IDENTITY_DATA: Record<IdentityMode, {
  heading: string;
  simplified: string;
  correct: string[];
  wrong: string[];
}> = {
  pythag: {
    heading: 'sin^2(x)+cos^2(x)',
    simplified: '1',
    correct: ['1', '1.0', '2-1', '10/10', 'sqrt(1)', '0+1', '1*1', 's^2+c^2', 'c^2+s^2', 's*s+c*c'],
    wrong: [
      '0', '2', '-1', '0.5', '3', 's^2', 'c^2', '1-s^2', '1-c^2',
      's^2-c^2', 'c^2-s^2', '2s^2', '2c^2', 's+c', 's*c', '1+s^2',
      '1+c^2', '2s*c', 'sin2x', 'cos2x', 'tanx', 's', 'c', '1/2',
    ],
  },
  cos2x: {
    heading: 'cos(2x)',
    simplified: 'cos^2(x)-sin^2(x)',
    correct: [
      'cos2x', 'cos(2x)', 'c^2-s^2', 'c*c-s*s', '1-2s^2',
      '1-2s*s', '2c^2-1', '2c*c-1', 'c*c-s^2', '1-2sin^2',
    ],
    wrong: [
      'sin2x', '2s*c', 's^2-c^2', '1-2c^2', '2s^2-1', 's^2', 'c^2',
      '1', '0', '2c^2', '1-c^2', '1-s^2', 'c^2+s^2', '2s^2',
      'sin2x+1', 'cos^2', 'sin^2', 's*c', 's+c', '1+2s^2', '2-c^2',
      'c^2-1', '1-2s', '2s', '2c',
    ],
  },
  sin2x: {
    heading: 'sin(2x)',
    simplified: '2*sin(x)*cos(x)',
    correct: [
      'sin2x', 'sin(2x)', '2s*c', '2c*s', 's*c+c*s',
      'c*s+s*c', '2(s*c)', '(s*c)*2', '2s*c+0',
    ],
    wrong: [
      'cos2x', 's^2+c^2', '2s', '2c', 's+c', 's*c', '2s^2', '2c^2',
      'c^2-s^2', '1-2s^2', '2c^2-1', 'sin^2', 'cos^2', 's/c', 'c/s',
      '1', '0', '2+s*c', 's^2', 'c^2', 'sinx', 'cosx',
    ],
  },
  tanx: {
    heading: 'tan(x)',
    simplified: 'sin(x)/cos(x)',
    correct: [
      'tanx', 'tan(x)', 's/c', 'sinx/cosx', 'sinx/c',
      's/cosx', 's*(1/c)', '1/(c/s)', 's/c*1',
    ],
    wrong: [
      'c/s', '1/tanx', '1/t', 's*c', '1/s', '1/c', 's', 'c',
      't+1', 't-1', 's^2/c', 'c^2/s', '1-s^2', '1-c^2', 'sin2x',
      'cos2x', '2t', 't^2', 's+c', 'c/s+0', '1/(s/c)', '2s*c',
    ],
  },
  cosSq: {
    heading: '1-sin^2(x)',
    simplified: 'cos^2(x)',
    correct: [
      'cos^2(x)', 'cos^2x', 'cos^2', 'c^2', 'c*c',
      'c^2+0', 'c^2*1', '1-s^2', '1-s*s', '1-sin^2',
    ],
    wrong: [
      's^2', '1-c^2', '1+s^2', '2c^2', 'c', 's', '1/c^2',
      'sin^2', 'cos^2+1', '1-c^2+0', 's*s', '2-c^2', 'c^2-1',
      '1-s', 'c^2+1', 's^2+0', '1-c*c', '2s^2', '2c', '1/c',
      '1/2',
    ],
  },
};

const trigIdentities: Topic = {
  id: 'trig-identities',
  name: 'Trig Identities',
  family: 'trigonometry',
  band: 'high',
  grades: 'Grades 10-12',
  blurb: 'Recognise equivalent trigonometric expressions.',
  round(rng: Rng, level: number) {
    const modes: IdentityMode[] = level < 6
      ? ['pythag', 'cosSq', 'tanx']
      : ['pythag', 'cos2x', 'sin2x', 'tanx', 'cosSq'];
    const mode = rng.pick(modes);
    const data = IDENTITY_DATA[mode];

    const correctForms = dedupe(data.correct);
    const correctPool = rng.shuffle(correctForms).slice(0, 10);
    const correctSet = new Set(correctPool);
    const wrongForms = dedupe(data.wrong).filter((text) => !correctSet.has(text));
    const incorrectPool = rng.shuffle(wrongForms).slice(0, 28);

    return makeRound({
      rng,
      heading: `Identity ${data.heading}`,
      instruction: `Munch every expression equal to ${data.heading}. Use s=sin(x), c=cos(x).`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const correct = correctSet.has(text);
        return correct
          ? `${text} is equivalent to ${data.simplified}; the identity ${data.heading} = ${data.simplified}.`
          : `${text} is not equivalent to ${data.simplified}; the identity ${data.heading} = ${data.simplified}.`;
      },
    });
  },
};

type AngleEntry = { deg: number; num: number; den: number; radText: string };

const ANGLE_CATALOG: AngleEntry[] = [
  { deg: 0, num: 0, den: 1, radText: '0' },
  { deg: 30, num: 1, den: 6, radText: 'pi/6' },
  { deg: 45, num: 1, den: 4, radText: 'pi/4' },
  { deg: 60, num: 1, den: 3, radText: 'pi/3' },
  { deg: 90, num: 1, den: 2, radText: 'pi/2' },
  { deg: 120, num: 2, den: 3, radText: '2pi/3' },
  { deg: 135, num: 3, den: 4, radText: '3pi/4' },
  { deg: 150, num: 5, den: 6, radText: '5pi/6' },
  { deg: 180, num: 1, den: 1, radText: 'pi' },
  { deg: 210, num: 7, den: 6, radText: '7pi/6' },
  { deg: 225, num: 5, den: 4, radText: '5pi/4' },
  { deg: 240, num: 4, den: 3, radText: '4pi/3' },
  { deg: 270, num: 3, den: 2, radText: '3pi/2' },
  { deg: 300, num: 5, den: 3, radText: '5pi/3' },
  { deg: 315, num: 7, den: 4, radText: '7pi/4' },
  { deg: 330, num: 11, den: 6, radText: '11pi/6' },
  { deg: 360, num: 2, den: 1, radText: '2pi' },
];

const radianForms = (entry: AngleEntry): string[] => {
  const out: string[] = [];
  const { num, den } = entry;
  if (num === 0) {
    for (const text of ['0', '0deg', '0.0', '0pi', '0pi/3', '0*pi', '0/1', '360-360', '0.00', '0rad']) {
      if (fits(text)) out.push(text);
    }
    return out;
  }
  for (let k = 1; k <= 12; k++) {
    const n = k * num;
    const d = k * den;
    const text = d === 1 ? `${n}pi` : n === 1 ? `pi/${d}` : `${n}pi/${d}`;
    if (fits(text)) out.push(text);
  }
  for (const text of [
    `pi*${num}/${den}`,
    `${num}/${den}pi`,
    `${num}*pi/${den}`,
  ]) {
    if (fits(text) && num !== 0) out.push(text);
  }
  if (den === 1) {
    for (const text of [`${num}*pi`, `${num}pi`, `pi*${num}`]) {
      if (fits(text)) out.push(text);
    }
  }
  for (const text of [`${entry.deg}`, `${entry.deg}deg`, `${entry.deg}.0`]) {
    if (fits(text)) out.push(text);
  }
  return dedupe(out);
};

const radiansDegrees: Topic = {
  id: 'radians-degrees',
  name: 'Radians & Degrees',
  family: 'trigonometry',
  band: 'high',
  grades: 'Grades 10-12',
  blurb: 'Convert benchmark angles between degrees and radians.',
  round(rng: Rng, level: number) {
    const available = ANGLE_CATALOG.filter((_item, index) => {
      if (level < 6) return index <= 8;
      if (level < 12) return index <= 12;
      return true;
    });
    const entry = rng.pick(available);
    const useDegrees = rng.chance(0.5);

    const forms = radianForms(entry);
    const degreesByText = new Map<string, number>();
    for (const text of forms) degreesByText.set(text, entry.deg);
    const correctPool = rng.shuffle(forms).slice(0, 10);
    const correctSet = new Set(correctPool);

    const entryIndex = ANGLE_CATALOG.indexOf(entry);
    const neighbourIndices = [entryIndex - 1, entryIndex + 1, entryIndex + 2, entryIndex - 2]
      .filter((i) => i >= 0 && i < ANGLE_CATALOG.length);
    const wrongTexts: string[] = [];
    for (const index of neighbourIndices) {
      const other = ANGLE_CATALOG[index]!;
      for (const text of radianForms(other)) {
        if (!fits(text) || correctSet.has(text) || wrongTexts.includes(text)) continue;
        wrongTexts.push(text);
        degreesByText.set(text, other.deg);
      }
    }
    for (const text of ['pi', '2pi', '180', '180deg', '360', '360deg', '90', '90deg', '60', '60deg']) {
      if (!fits(text) || correctSet.has(text) || wrongTexts.includes(text)) continue;
      const value = text.includes('pi') ? 180 * (text === 'pi' ? 1 : 2) : Number.parseInt(text, 10);
      if (value !== entry.deg) {
        wrongTexts.push(text);
        degreesByText.set(text, value);
      }
    }
    const incorrectPool = rng.shuffle(wrongTexts).slice(0, 28);

    const display = useDegrees ? `${entry.deg} deg` : `${entry.radText} rad`;
    return makeRound({
      rng,
      heading: `Angle: ${display}`,
      instruction: `Munch every tile equal to ${display}.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const value = degreesByText.get(text);
        if (value === entry.deg) {
          return `${text} equals ${entry.deg} deg; ${entry.deg}/180 = ${entry.num}/${entry.den}, so the radian measure is ${entry.radText}.`;
        }
        if (value !== undefined) {
          return `${text} equals ${value} deg, not ${entry.deg} deg; ${entry.deg} deg = ${entry.radText}.`;
        }
        return `${text} is not equal to ${entry.deg} deg (${entry.radText}).`;
      },
    });
  },
};

export const trigonometryTopics: Topic[] = [
  trigRatios,
  specialAngles,
  trigIdentities,
  radiansDegrees,
];
