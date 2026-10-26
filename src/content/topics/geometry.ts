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

/** Distinct integer tiles that all evaluate to `value`. */
const intForms = (value: number): { text: string; value: number }[] => {
  const out: { text: string; value: number }[] = [];
  const add = (text: string): void => {
    if (fits(text)) out.push({ text, value });
  };
  if (value === 0) {
    for (const text of ['0', '0/2', '0/7', '0.0', '0.00', '0+0', '5-5', '0*9', 'sqrt(0)', '2*0']) {
      add(text);
    }
    return out;
  }
  add(`${value}`);
  add(`${value}.0`);
  add(`${value}+0`);
  add(`${value + 10}-10`);
  add(`${value + 20}-20`);
  for (let a = 2; a * a <= value; a++) {
    if (value % a === 0) {
      add(`${a}*${value / a}`);
      break;
    }
  }
  add(`${value}*1`);
  for (const k of [2, 3, 4, 5, 6, 7, 8]) add(`${k * value}/${k}`);
  add(`sqrt(${value * value})`);
  return out;
};

const formMap = (items: { text: string; value?: number; coef?: number }[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const item of items) {
    const value = item.value ?? item.coef;
    if (value !== undefined) map.set(item.text, value);
  }
  return map;
};

const plainWrongTexts = (target: number, candidates: number[], count = 26, maxValue = Number.POSITIVE_INFINITY): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: number): void => {
    if (out.length >= count || !Number.isFinite(value) || value <= 0 || value > maxValue) return;
    const rounded = Math.round(value);
    if (Math.abs(rounded - target) < 1e-9) return;
    const text = String(rounded);
    if (!fits(text) || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };
  for (const value of candidates) push(value);
  for (let value = 1; value <= Math.min(maxValue, target + 25) && out.length < count; value++) push(value);
  return out;
};

/** Parse a simple `a,b` pair (used by circle-theorem rounds). */
const pairText = (a: number, b: number): string => `${a},${b}`;
const readPair = (text: string): [number, number] | null => {
  const m = /^(\d+),(\d+)$/.exec(text);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
};

type AngleMode = 'complementary' | 'supplementary' | 'vertical';

const angles: Topic = {
  id: 'angles',
  name: 'Angle Relationships',
  family: 'geometry',
  band: 'middle',
  grades: 'Grades 6-8',
  blurb: 'Find the complement, supplement or vertical partner of an angle.',
  round(rng: Rng, level: number) {
    const mode: AngleMode = level >= 12
      ? rng.pick(['complementary', 'supplementary', 'vertical'] as const)
      : rng.pick(['complementary', 'supplementary'] as const);
    const given = mode === 'complementary'
      ? rng.int(10, Math.min(80, 28 + level * 3))
      : mode === 'supplementary'
        ? rng.int(20, Math.min(160, 45 + level * 6))
        : rng.int(10, Math.min(170, 45 + level * 7));
    const partner = mode === 'complementary'
      ? 90 - given
      : mode === 'supplementary'
        ? 180 - given
        : given;

    const correctCandidates = intForms(partner);
    const correctMap = formMap(correctCandidates);
    const correctPool = [...correctMap.keys()].slice(0, 10);
    const correctSet = new Set(correctPool);

    const wrongValues: number[] = [];
    const add = (value: number): void => {
      if (Number.isInteger(value) && value > 0 && value <= 180) wrongValues.push(value);
    };
    for (const delta of [1, 2, 3, 5, 7, 10, 15, 20, 25, 30]) {
      add(partner + delta);
      add(partner - delta);
      add(given + delta);
      add(given - delta);
    }
    add(given);
    add(90 - given);
    add(180 - given);
    for (const base of [30, 45, 60, 90, 120, 135]) add(base);
    const incorrectPool = rng
      .shuffle(plainWrongTexts(partner, wrongValues, 40, 180))
      .filter((text) => !correctSet.has(text))
      .slice(0, 28);
    const wrongMap = formMap(incorrectPool.map((text) => ({ text, value: Number(text) })));

    const rule = mode === 'complementary'
      ? `complement = 90 - ${given} = ${partner}`
      : mode === 'supplementary'
        ? `supplement = 180 - ${given} = ${partner}`
        : `vertical angles are equal, so the partner is ${given}`;

    return makeRound({
      rng,
      heading: `${mode === 'complementary' ? 'Complementary' : mode === 'supplementary' ? 'Supplementary' : 'Vertical'} to ${given} deg`,
      instruction: mode === 'vertical'
        ? `Munch every measure equal to the vertical angle to ${given} deg.`
        : `Munch every measure ${mode} to ${given} deg.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const value = correctMap.get(text) ?? wrongMap.get(text);
        if (value === undefined) return `${text} is not a valid angle measure; ${rule}.`;
        return value === partner
          ? `${text} = ${partner}; ${rule}, so it matches.`
          : `${text} = ${value}, but ${rule}, so it does not match.`;
      },
    });
  },
};

type TriMode = 'acute' | 'right' | 'obtuse' | 'scalene' | 'isosceles' | 'equilateral';

const tripleText = (a: number, b: number, c: number): string => `${a},${b},${c}`;
const readTriple = (text: string): [number, number, number] | null => {
  const m = /^(\d+),(\d+),(\d+)$/.exec(text);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

const sortedDesc = (a: number, b: number, c: number): [number, number, number] => {
  return [a, b, c].sort((x, y) => y - x) as [number, number, number];
};

const classifyAngles = (a: number, b: number, c: number): 'acute' | 'right' | 'obtuse' | 'invalid' => {
  if (a + b + c !== 180) return 'invalid';
  const max = Math.max(a, b, c);
  if (max > 90) return 'obtuse';
  if (max === 90) return 'right';
  return 'acute';
};

const classifySides = (a: number, b: number, c: number): 'scalene' | 'isosceles' | 'equilateral' | 'invalid' => {
  const [x, y, z] = [a, b, c].sort((p, q) => p - q) as [number, number, number];
  if (x + y <= z) return 'invalid';
  if (x === z) return 'equilateral';
  if (x === y || y === z) return 'isosceles';
  return 'scalene';
};

const TRI_LABELS: Record<TriMode, string> = {
  acute: 'acute',
  right: 'right',
  obtuse: 'obtuse',
  scalene: 'scalene',
  isosceles: 'isosceles',
  equilateral: 'equilateral',
};

const triangleTypes: Topic = {
  id: 'triangle-types',
  name: 'Triangle Classification',
  family: 'geometry',
  band: 'middle',
  grades: 'Grades 6-8',
  blurb: 'Classify triangles by their angles or by their side lengths.',
  round(rng: Rng, level: number) {
    const angleMode = rng.chance(0.58);
    const mode: TriMode = angleMode
      ? rng.pick(['acute', 'right', 'obtuse'] as const)
      : rng.pick(['scalene', 'isosceles', 'equilateral'] as const);

    const correctCandidates: string[] = [];
    if (angleMode) {
      if (mode === 'right') {
        for (let b = 10; b <= 80; b++) {
          correctCandidates.push(tripleText(90, b, 90 - b));
        }
      } else if (mode === 'acute') {
        const cap = Math.min(89, 70 + level);
        for (let a = 10; a <= cap; a++) {
          for (let b = 10; b <= a; b++) {
            const c = 180 - a - b;
            if (c >= 10 && c <= b && a <= cap) correctCandidates.push(tripleText(a, b, c));
          }
        }
      } else {
        const cap = Math.min(170, 100 + level * 3);
        for (let a = 95; a <= cap; a++) {
          for (let b = 5; b <= 85; b++) {
            const c = 180 - a - b;
            if (c >= 5 && c <= b) correctCandidates.push(tripleText(a, b, c));
          }
        }
      }
    } else {
      const maxSide = mode === 'equilateral' ? Math.min(20, 13 + level) : Math.min(20, 7 + level);
      for (let a = 2; a <= maxSide; a++) {
        for (let b = 1; b <= maxSide; b++) {
          for (let c = 1; c <= maxSide; c++) {
            const sides = sortedDesc(a, b, c);
            if (classifySides(sides[0], sides[1], sides[2]) !== mode) continue;
            correctCandidates.push(tripleText(sides[0], sides[1], sides[2]));
          }
        }
      }
    }
    const correctPool = rng.shuffle(dedupe(correctCandidates)).slice(0, 12);
    const correctSet = new Set(correctPool);

    const wrongCandidates: string[] = [];
    if (angleMode) {
      const maxAngle = Math.min(178, 100 + level * 4);
      for (let a = 40; a <= Math.min(89, maxAngle); a += 3) {
        for (let b = 10; b <= a; b += 3) {
          const c = 180 - a - b;
          if (c >= 1) wrongCandidates.push(tripleText(a, b, c));
          const near = 180 - a - b + 10;
          if (near >= 1) wrongCandidates.push(tripleText(a, b, near));
        }
      }
      for (let a = 91; a <= Math.min(160, maxAngle); a += 3) {
        for (let b = 5; b <= 80; b += 5) {
          const c = 180 - a - b;
          if (c >= 1 && c <= b) wrongCandidates.push(tripleText(a, b, c));
        }
      }
    } else {
      const maxSide = Math.min(20, 8 + level);
      for (let a = 2; a <= maxSide; a++) {
        for (let b = 1; b <= maxSide; b++) {
          for (let c = 1; c <= maxSide; c++) {
            const sides = sortedDesc(a, b, c);
            const kind = classifySides(sides[0], sides[1], sides[2]);
            if (kind === 'invalid' || kind !== mode) {
              wrongCandidates.push(tripleText(sides[0], sides[1], sides[2]));
            }
            if (c >= a + b) wrongCandidates.push(tripleText(c, a, b));
          }
        }
      }
    }
    const incorrectPool = rng
      .shuffle(wrongCandidates)
      .filter((text) => {
        if (correctSet.has(text)) return false;
        const triple = readTriple(text);
        if (!triple) return false;
        if (angleMode) {
          return classifyAngles(triple[0], triple[1], triple[2]) !== mode;
        }
        return classifySides(triple[0], triple[1], triple[2]) !== mode;
      })
      .slice(0, 26);

    const heading = `${TRI_LABELS[mode][0]!.toUpperCase()}${TRI_LABELS[mode].slice(1)} Triangles`;
    const article = mode === 'right' || mode === 'scalene' ? 'a' : 'an';
    const instruction = angleMode
      ? `Munch every angle set (in deg) that forms ${article} ${mode} triangle.`
      : `Munch every side set that forms ${article} ${mode} triangle.`;

    return makeRound({
      rng,
      heading,
      instruction,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 10,
      explain: (text) => {
        const triple = readTriple(text);
        if (!triple) return `${text} is not a triangle description.`;
        if (angleMode) {
          const [a, b, c] = triple;
          const sum = a + b + c;
          const max = Math.max(a, b, c);
          if (sum !== 180) return `${text}: ${a} + ${b} + ${c} = ${sum}, not 180, so these angles do not form a triangle.`;
          if (mode === 'acute') {
            return max < 90
              ? `${text}: all angles are below 90 deg, so this triangle is acute.`
              : `${text}: the largest angle is ${max} deg, so this triangle is ${max > 90 ? 'obtuse' : 'right'}, not acute.`;
          }
          if (mode === 'right') {
            return max === 90
              ? `${text}: one angle is 90 deg, so this triangle is right.`
              : `${text}: the largest angle is ${max} deg, not 90, so this triangle is not right.`;
          }
          return max > 90
            ? `${text}: the largest angle is ${max} deg (> 90), so this triangle is obtuse.`
            : `${text}: the largest angle is ${max} deg, so this triangle is ${max === 90 ? 'right' : 'acute'}, not obtuse.`;
        }
        const [a, b, c] = triple;
        const [x, y, z] = [a, b, c].sort((p, q) => p - q) as [number, number, number];
        if (x + y <= z) return `${text}: ${x} + ${y} = ${x + y} is not greater than ${z}, so these sides cannot form a triangle.`;
        if (mode === 'equilateral') {
          return x === z
            ? `${text}: all three sides are equal, so this triangle is equilateral.`
            : `${text}: the sides are not all equal, so this triangle is not equilateral.`;
        }
        if (mode === 'isosceles') {
          return x === y || y === z
            ? `${text}: two sides are equal, so this triangle is isosceles.`
            : `${text}: no two sides are equal, so this triangle is scalene, not isosceles.`;
        }
        return x !== y && y !== z
          ? `${text}: all three sides are different, so this triangle is scalene.`
          : `${text}: two sides are equal, so this triangle is isosceles, not scalene.`;
      },
    });
  },
};

const PYTHAGOREAN_CATALOG: [number, number, number][] = [
  [3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29],
  [9, 40, 41], [12, 35, 37], [11, 60, 61], [28, 45, 53], [33, 56, 65],
  [16, 63, 65], [48, 55, 73], [36, 77, 85], [39, 80, 89], [13, 84, 85],
];

const pythagorean: Topic = {
  id: 'pythagorean',
  name: 'Pythagorean Theorem',
  family: 'geometry',
  band: 'middle',
  grades: 'Grades 8-10',
  blurb: 'Find the missing leg or hypotenuse of a right triangle.',
  round(rng: Rng, level: number) {
    const maxC = Math.min(90, 25 + level * 5);
    const options = PYTHAGOREAN_CATALOG.filter(([, , c]) => c <= maxC);
    const [a, b, c] = rng.pick(options.length > 0 ? options : PYTHAGOREAN_CATALOG.slice(0, 3));
    const findHypotenuse = rng.chance(0.6);
    const missing = findHypotenuse ? c : b;
    const heading = findHypotenuse
      ? `Legs ${a} and ${b}: missing hyp`
      : `Leg ${a}, hyp ${c}: missing leg`;
    const correctCandidates = intForms(missing);
    const correctMap = formMap(correctCandidates);
    const correctPool = [...correctMap.keys()].slice(0, 10);
    const correctSet = new Set(correctPool);

    const errorValues = findHypotenuse
      ? [
          a + b, c - a, c + a, a * b, a * a + b * b, c * c,
          c + 1, c - 1, c + 2, c - 2, c * 2, Math.floor(c / 2),
        ]
      : [
          c - a, c + a, c * a, c * c - a * a, a * a + c * c,
          b + 1, b - 1, b + 2, b - 2, b * 2, Math.floor(b / 2),
          a + b,
        ];
    const wrongValues: number[] = [];
    for (const delta of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15]) {
      wrongValues.push(missing + delta, missing - delta);
    }
    wrongValues.push(...errorValues);
    const incorrectPool = rng
      .shuffle(plainWrongTexts(missing, wrongValues, 40))
      .filter((text) => !correctSet.has(text))
      .slice(0, 28);
    const wrongMap = formMap(incorrectPool.map((text) => ({ text, value: Number(text) })));

    const computation = findHypotenuse
      ? `${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${a * a + b * b}; sqrt(${a * a + b * b}) = ${c}`
      : `${c}^2 - ${a}^2 = ${c * c} - ${a * a} = ${c * c - a * a}; sqrt(${c * c - a * a}) = ${b}`;

    return makeRound({
      rng,
      heading,
      instruction: 'Munch every tile equal to the missing side length.',
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const value = correctMap.get(text) ?? wrongMap.get(text);
        if (value === undefined) return `${text} is not a side length; ${computation}.`;
        return value === missing
          ? `${text} = ${missing}; ${computation}, so it matches.`
          : `${text} = ${value}, but ${computation}, so it does not match.`;
      },
    });
  },
};

type AreaMode = 'rect-area' | 'rect-perimeter' | 'tri-area';

const areaPerimeter: Topic = {
  id: 'area-perimeter',
  name: 'Area & Perimeter',
  family: 'geometry',
  band: 'middle',
  grades: 'Grades 6-9',
  blurb: 'Use rectangle and triangle formulas, and catch the usual mix-ups.',
  round(rng: Rng, level: number) {
    const mode: AreaMode = level < 8
      ? rng.pick(['rect-area', 'rect-perimeter'] as const)
      : rng.pick(['rect-area', 'rect-perimeter', 'tri-area'] as const);
    const cap = Math.min(12, 3 + level);

    let heading = '';
    let instruction = '';
    let target = 0;
    let formula = '';
    let errorValues: number[] = [];

    if (mode === 'tri-area') {
      const b = rng.int(2, cap);
      let h = rng.int(2, cap);
      if ((b * h) % 2 !== 0) h += 1;
      target = (b * h) / 2;
      heading = `Triangle b=${b},h=${h}: area`;
      instruction = 'Munch every tile equal to the area.';
      formula = `${b} x ${h} / 2 = ${target}`;
      errorValues = [b * h, b + h, 2 * (b + h), b * h + 2, b * h - 2, target * 2];
    } else {
      const w = rng.int(2, cap);
      const h = rng.int(2, cap);
      if (mode === 'rect-area') {
        target = w * h;
        heading = `Rectangle ${w}x${h}: area`;
        instruction = 'Munch every tile equal to the area.';
        formula = `${w} x ${h} = ${target}`;
        errorValues = [2 * (w + h), w + h, target * 2, target + w, target - w, target + h, target - h];
      } else {
        target = 2 * (w + h);
        heading = `Rectangle ${w}x${h}: perimeter`;
        instruction = 'Munch every tile equal to the perimeter.';
        formula = `2 x (${w} + ${h}) = ${target}`;
        errorValues = [w * h, w + h, 2 * w * h, target + 2, target - 2, target + 4, target - 4];
      }
    }

    const correctCandidates = intForms(target);
    const correctMap = formMap(correctCandidates);
    const correctPool = [...correctMap.keys()].slice(0, 10);
    const correctSet = new Set(correctPool);

    const wrongValues: number[] = [];
    for (const delta of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
      wrongValues.push(target + delta, target - delta);
    }
    wrongValues.push(...errorValues);
    const incorrectPool = rng
      .shuffle(plainWrongTexts(target, wrongValues, 40))
      .filter((text) => !correctSet.has(text))
      .slice(0, 28);
    const wrongMap = formMap(incorrectPool.map((text) => ({ text, value: Number(text) })));

    return makeRound({
      rng,
      heading,
      instruction,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const value = correctMap.get(text) ?? wrongMap.get(text);
        if (value === undefined) return `${text} is not a number; ${formula}.`;
        return value === target
          ? `${text} = ${target}; ${formula}, so it matches.`
          : `${text} = ${value}, but ${formula}, so it does not match.`;
      },
    });
  },
};

type CircleMode = 'circumference' | 'area';

const piForms = (
  coef: number,
  radius: number,
  mode: CircleMode,
): { text: string; coef: number }[] => {
  const out: { text: string; coef: number }[] = [];
  const add = (text: string, valueCoef = coef): void => {
    if (fits(text)) out.push({ text, coef: valueCoef });
  };
  add(`${coef}pi`);
  add(`pi*${coef}`);
  add(`${coef}*3.14`);
  add(`3.14*${coef}`);
  add((coef * 3.14).toFixed(2));
  add(`${coef}*pi`);
  add(`${coef}pi/1`);
  add(`${coef}pi*1`);
  add(`${2 * coef}pi/2`);
  add(`${3 * coef}pi/3`);
  add(`${4 * coef}pi/4`);
  add(`${5 * coef}pi/5`);
  add(`${6 * coef}pi/6`);
  if (coef % 2 === 0) add(`${coef / 2}pi*2`);
  if (mode === 'circumference') {
    add(`2pi*${radius}`, 2 * radius);
    add(`${radius}*2pi`, 2 * radius);
  } else {
    add(`${radius}^2pi`, radius * radius);
    add(`pi*${radius}^2`, radius * radius);
    add(`${radius}*${radius}pi`, radius * radius);
  }
  return out;
};

const circles: Topic = {
  id: 'circles',
  name: 'Circles',
  family: 'geometry',
  band: 'middle',
  grades: 'Grades 7-10',
  blurb: 'Circumference and area, in terms of pi and as decimals.',
  round(rng: Rng, level: number) {
    const radius = rng.int(2, Math.min(12, 4 + level));
    const mode: CircleMode = rng.chance(0.5) ? 'circumference' : 'area';
    const useDiameter = rng.chance(0.35);
    const coef = mode === 'circumference' ? 2 * radius : radius * radius;

    const correctCandidates = piForms(coef, radius, mode).filter((item) => Math.abs(item.coef - coef) < 1e-9);
    const correctMap = formMap(correctCandidates);
    const correctPool = [...correctMap.keys()].slice(0, 10);
    const correctSet = new Set(correctPool);

    const wrongCoefs = [
      coef + 1, coef - 1, coef + 2, coef - 2, coef * 2,
      Math.max(1, Math.floor(coef / 2)), coef + 5, coef - 5,
      radius, 2 * radius, radius * radius, coef + 10, coef * 3,
    ];
    const wrongCandidates: { text: string; coef: number }[] = [];
    const wrongTexts: string[] = [];
    for (const c of wrongCoefs) {
      if (c <= 0 || c === coef) continue;
      for (const item of piForms(c, radius, mode)) {
        if (Math.abs(item.coef - coef) < 1e-9) continue;
        if (correctSet.has(item.text) || wrongTexts.includes(item.text)) continue;
        wrongTexts.push(item.text);
        wrongCandidates.push(item);
      }
    }
    for (const text of [`${radius}`, `${2 * radius}`, `${radius * radius}`, `${coef}`]) {
      if (!correctSet.has(text) && !wrongTexts.includes(text) && fits(text)) {
        wrongTexts.push(text);
        wrongCandidates.push({ text, coef: Number.NaN });
      }
    }
    const wrongMap = formMap(wrongCandidates);
    const incorrectPool = wrongTexts.slice(0, 26);

    const measure = mode === 'circumference' ? 'circumference' : 'area';
    const size = useDiameter ? `d=${2 * radius}` : `r=${radius}`;
    const exact = mode === 'circumference' ? `${coef}pi` : `${coef}pi`;
    const numeric = (coef * 3.14).toFixed(2);

    return makeRound({
      rng,
      heading: `Circle ${size}: ${measure}`,
      instruction: `Munch every tile equal to the ${measure}. Use pi = 3.14.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const formula = mode === 'circumference'
          ? `C = 2*pi*r = 2*pi*${radius} = ${exact} = ${numeric}`
          : `A = pi*r^2 = pi*${radius}^2 = ${exact} = ${numeric}`;
        const tileCoef = correctMap.get(text) ?? wrongMap.get(text);
        if (tileCoef !== undefined && Number.isFinite(tileCoef) && Math.abs(tileCoef - coef) < 1e-9) {
          return `${text} equals ${exact}, and ${formula}, so it matches.`;
        }
        if (tileCoef !== undefined && Number.isFinite(tileCoef) && tileCoef > 0) {
          return `${text} equals ${tileCoef}pi, but ${formula}, so it does not match.`;
        }
        return `${text} is not equal to ${exact}; ${formula}, so it does not match.`;
      },
    });
  },
};

type VolumeMode =
  | 'box-volume'
  | 'box-sa'
  | 'cylinder-volume'
  | 'cylinder-sa'
  | 'cone-volume'
  | 'sphere-volume'
  | 'sphere-sa';

const volume: Topic = {
  id: 'volume',
  name: 'Volume & Surface Area',
  family: 'geometry',
  band: 'high',
  grades: 'Grades 8-11',
  blurb: 'Prisms, cylinders, cones and spheres, in pi form.',
  round(rng: Rng, level: number) {
    const modes: VolumeMode[] = level < 6
      ? ['box-volume', 'box-sa', 'cylinder-volume']
      : ['box-volume', 'box-sa', 'cylinder-volume', 'cylinder-sa', 'cone-volume', 'sphere-volume', 'sphere-sa'];
    const mode = rng.pick(modes);
    const dim = (): number => rng.int(2, Math.min(8, 3 + level));

    let heading = '';
    let instruction = '';
    let formula = '';
    let answer: number;
    let isPi = false;
    let radius = 0;
    let height = 0;

    if (mode === 'box-volume' || mode === 'box-sa') {
      const l = dim();
      const w = dim();
      const h = dim();
      heading = `Box ${l}x${w}x${h}: ${mode === 'box-volume' ? 'volume' : 'surface area'}`;
      if (mode === 'box-volume') {
        answer = l * w * h;
        formula = `V = ${l} x ${w} x ${h} = ${answer}`;
        instruction = 'Munch every tile equal to the volume.';
      } else {
        answer = 2 * (l * w + l * h + w * h);
        formula = `SA = 2(${l}*${w} + ${l}*${h} + ${w}*${h}) = ${answer}`;
        instruction = 'Munch every tile equal to the surface area.';
      }
    } else if (mode === 'cylinder-volume' || mode === 'cylinder-sa') {
      radius = rng.int(2, Math.min(9, 3 + level));
      height = rng.int(2, Math.min(9, 3 + level));
      isPi = true;
      if (mode === 'cylinder-volume') {
        answer = radius * radius * height;
        formula = `V = pi*r^2*h = pi*${radius}^2*${height} = ${answer}pi`;
        heading = `Cylinder r=${radius},h=${height}: volume`;
        instruction = 'Munch every tile equal to the volume.';
      } else {
        answer = 2 * radius * (radius + height);
        formula = `SA = 2*pi*r*(r+h) = 2*pi*${radius}*(${radius}+${height}) = ${answer}pi`;
        heading = `Cylinder r=${radius},h=${height}: surface area`;
        instruction = 'Munch every tile equal to the surface area.';
      }
    } else if (mode === 'cone-volume') {
      radius = rng.int(2, Math.min(9, 3 + level));
      let h = rng.int(2, Math.min(9, 3 + level));
      while ((radius * radius * h) % 3 !== 0 && h < 9) h++;
      height = h;
      answer = (radius * radius * height) / 3;
      isPi = true;
      formula = `V = pi*r^2*h/3 = pi*${radius}^2*${height}/3 = ${answer}pi`;
      heading = `Cone r=${radius},h=${height}: volume`;
      instruction = 'Munch every tile equal to the volume.';
    } else if (mode === 'sphere-volume') {
      radius = rng.pick(level < 12 ? [3] : ([3, 6, 9] as const));
      answer = (4 * radius * radius * radius) / 3;
      isPi = true;
      formula = `V = 4/3*pi*r^3 = 4/3*pi*${radius}^3 = ${answer}pi`;
      heading = `Sphere r=${radius}: volume`;
      instruction = 'Munch every tile equal to the volume.';
    } else {
      radius = rng.int(2, Math.min(9, 3 + level));
      answer = 4 * radius * radius;
      isPi = true;
      formula = `SA = 4*pi*r^2 = 4*pi*${radius}^2 = ${answer}pi`;
      heading = `Sphere r=${radius}: surface area`;
      instruction = 'Munch every tile equal to the surface area.';
    }

    const correctCandidates = isPi
      ? piForms(answer, Math.max(2, radius), 'area').filter((item) => Math.abs(item.coef - answer) < 1e-9)
      : intForms(answer);
    const correctMap = formMap(correctCandidates);
    const correctPool = [...correctMap.keys()].slice(0, 10);
    const correctSet = new Set(correctPool);

    const wrongCandidates: { text: string; value?: number; coef?: number }[] = [];
    const wrongTexts: string[] = [];
    if (isPi) {
      const wrongCoefs = [
        answer + 1, answer - 1, answer * 2, Math.floor(answer / 2),
        answer + radius, answer - radius, radius * height, radius * radius,
        answer + 10, 4 * radius * radius,
      ];
      for (const c of wrongCoefs) {
        if (c <= 0 || c === answer) continue;
        for (const item of piForms(c, Math.max(2, radius), 'area')) {
          if (Math.abs(item.coef - answer) < 1e-9) continue;
          if (correctSet.has(item.text) || wrongTexts.includes(item.text)) continue;
          wrongTexts.push(item.text);
          wrongCandidates.push(item);
        }
      }
    } else {
      const wrongValues = [
        answer + 1, answer - 1, answer + 2, answer - 2, answer * 2,
        Math.floor(answer / 2), answer + 10, answer - 10, answer + 12,
        answer + 20, answer - 20, answer + 30,
      ];
      for (const v of wrongValues) {
        if (v <= 0 || v === answer) continue;
        for (const item of intForms(v)) {
          if (correctSet.has(item.text) || wrongTexts.includes(item.text)) continue;
          wrongTexts.push(item.text);
          wrongCandidates.push(item);
        }
      }
    }
    const wrongMap = formMap(wrongCandidates);
    const incorrectPool = wrongTexts.slice(0, 28);

    return makeRound({
      rng,
      heading,
      instruction,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const tileValue = correctMap.get(text) ?? wrongMap.get(text);
        if (isPi) {
          if (tileValue !== undefined && Math.abs(tileValue - answer) < 1e-9) {
            return `${text} equals ${answer}pi, and ${formula}, so it matches.`;
          }
          if (tileValue !== undefined && Number.isFinite(tileValue) && tileValue > 0) {
            return `${text} equals ${tileValue}pi, but ${formula}, so it does not match.`;
          }
          return `${text} is not equal to ${answer}pi; ${formula}.`;
        }
        if (tileValue !== undefined && tileValue === answer) {
          return `${text} equals ${answer}, and ${formula}, so it matches.`;
        }
        if (tileValue !== undefined) {
          return `${text} equals ${tileValue}, but ${formula}, so it does not match.`;
        }
        return `${text} is not equal to ${answer}; ${formula}.`;
      },
    });
  },
};

type CoordMode = 'quadrant' | 'distance' | 'midpoint';

const pointText = (x: number, y: number): string => `(${x},${y})`;
const readPoint = (text: string): [number, number] | null => {
  const m = /^\((-?\d+),(-?\d+)\)$/.exec(text);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
};

const midpointText = (x1: number, y1: number, x2: number, y2: number): string =>
  `${x1},${y1};${x2},${y2}`;

const readMidpointPair = (text: string): [[number, number], [number, number]] | null => {
  const m = /^(-?\d+),(-?\d+);(-?\d+),(-?\d+)$/.exec(text);
  if (!m) return null;
  return [
    [Number(m[1]), Number(m[2])],
    [Number(m[3]), Number(m[4])],
  ];
};

const coordinateGeometry: Topic = {
  id: 'coordinate-geometry',
  name: 'Coordinate Geometry',
  family: 'geometry',
  band: 'high',
  grades: 'Grades 8-11',
  blurb: 'Quadrants, distances and midpoints on the coordinate plane.',
  round(rng: Rng, level: number) {
    const mode: CoordMode = level < 6
      ? rng.pick(['quadrant', 'distance'] as const)
      : rng.pick(['quadrant', 'distance', 'midpoint'] as const);
    const limit = Math.min(14, 4 + level);

    let heading = '';
    let instruction = '';
    let correctCandidates: string[] = [];
    let wrongCandidates: string[] = [];

    if (mode === 'quadrant') {
      const q = rng.int(1, 4);
      const roman = ['I', 'II', 'III', 'IV'][q - 1]!;
      const sx = q === 2 || q === 3 ? -1 : 1;
      const sy = q === 3 || q === 4 ? -1 : 1;
      for (let x = 1; x <= limit; x++) {
        for (let y = 1; y <= limit; y++) {
          correctCandidates.push(pointText(sx * x, sy * y));
        }
      }
      for (let x = -limit; x <= limit; x++) {
        for (let y = -limit; y <= limit; y++) {
          if (x === 0 || y === 0) {
            wrongCandidates.push(pointText(x, y));
          } else if (Math.sign(x) !== sx || Math.sign(y) !== sy) {
            wrongCandidates.push(pointText(x, y));
          }
        }
      }
      heading = `Quadrant ${roman}`;
      instruction = `Munch every point in quadrant ${roman}.`;
    } else if (mode === 'distance') {
      const radius = level < 9 ? 5 : level < 15 ? rng.pick([5, 10] as const) : rng.pick([5, 10, 13] as const);
      const cx = rng.int(-1, 1);
      const cy = rng.int(-1, 1);
      const baseOffsets = radius === 5
        ? [[3, 4], [4, 3], [5, 0], [0, 5]]
        : radius === 10
          ? [[6, 8], [8, 6], [10, 0], [0, 10]]
          : [[5, 12], [12, 5], [13, 0], [0, 13]];
      for (const [dx0, dy0] of baseOffsets) {
        for (const dx of dx0 === 0 ? [0] : [dx0, -dx0]) {
          for (const dy of dy0 === 0 ? [0] : [dy0, -dy0]) {
            const text = pointText(cx + dx, cy + dy);
            if (fits(text)) correctCandidates.push(text);
          }
        }
      }
      for (let x = -limit; x <= limit; x++) {
        for (let y = -limit; y <= limit; y++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          if (d2 !== radius * radius) wrongCandidates.push(pointText(x, y));
        }
      }
      heading = `Distance ${radius} from (${cx},${cy})`;
      instruction = `Munch every point exactly ${radius} units from (${cx},${cy}).`;
    } else {
      const mx = rng.int(1, Math.min(7, 3 + level));
      const my = rng.int(1, Math.min(7, 3 + level));
      const offsets: [number, number][] = [
        [1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 1], [1, 2],
        [3, 0], [0, 3], [2, 2], [3, 1], [1, 3], [4, 0], [0, 4],
      ];
      for (const [dx, dy] of offsets) {
        const text = midpointText(mx + dx, my + dy, mx - dx, my - dy);
        if (fits(text)) correctCandidates.push(text);
      }
      for (let attempt = 0; attempt < 400 && wrongCandidates.length < 80; attempt++) {
        const x1 = rng.int(-limit, limit);
        const y1 = rng.int(-limit, limit);
        const x2 = rng.int(-limit, limit);
        const y2 = rng.int(-limit, limit);
        if (x1 + x2 === 2 * mx && y1 + y2 === 2 * my) continue;
        const text = midpointText(x1, y1, x2, y2);
        if (fits(text)) wrongCandidates.push(text);
      }
      heading = `Midpoint (${mx},${my})`;
      instruction = `Munch every endpoint pair whose midpoint is (${mx},${my}).`;
    }

    const correctPool = rng.shuffle(dedupe(correctCandidates)).slice(0, 12);
    const correctSet = new Set(correctPool);
    const incorrectPool = rng
      .shuffle(wrongCandidates)
      .filter((text) => !correctSet.has(text) && fits(text))
      .slice(0, 28);

    return makeRound({
      rng,
      heading,
      instruction,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        if (mode === 'quadrant') {
          const point = readPoint(text);
          if (!point) return `${text} is not a coordinate point.`;
          const [x, y] = point;
          if (x === 0 || y === 0) {
            return `${text}: one coordinate is 0, so the point lies on an axis, not in a quadrant.`;
          }
          const actual = x > 0 ? (y > 0 ? 'I' : 'IV') : (y > 0 ? 'II' : 'III');
          return actual === heading.slice(-1) || heading.endsWith(actual)
            ? `${text}: x is ${x > 0 ? 'positive' : 'negative'} and y is ${y > 0 ? 'positive' : 'negative'}, so it is in quadrant ${actual}.`
            : `${text}: x is ${x > 0 ? 'positive' : 'negative'} and y is ${y > 0 ? 'positive' : 'negative'}, so it is in quadrant ${actual}, not ${heading.slice(-1)}.`;
        }
        if (mode === 'distance') {
          const point = readPoint(text);
          if (!point) return `${text} is not a coordinate point.`;
          const m = /from \((-?\d+),(-?\d+)\)/.exec(heading);
          if (!m) return `${text} cannot be checked against the heading.`;
          const cx = Number(m[1]);
          const cy = Number(m[2]);
          const d2 = (point[0] - cx) ** 2 + (point[1] - cy) ** 2;
          const expected = Number(/Distance (\d+)/.exec(heading)?.[1] ?? 0);
          return d2 === expected * expected
            ? `${text}: distance^2 = (${point[0]}-${cx})^2 + (${point[1]}-${cy})^2 = ${d2}, so the distance is ${expected}.`
            : `${text}: distance^2 = (${point[0]}-${cx})^2 + (${point[1]}-${cy})^2 = ${d2}, so the distance is not ${expected}.`;
        }
        const pair = readMidpointPair(text);
        if (!pair) return `${text} is not an endpoint pair.`;
        const m = /Midpoint \((-?\d+),(-?\d+)\)/.exec(heading);
        if (!m) return `${text} cannot be checked against the heading.`;
        const mx = Number(m[1]);
        const my = Number(m[2]);
        const x = (pair[0][0] + pair[1][0]) / 2;
        const y = (pair[0][1] + pair[1][1]) / 2;
        return x === mx && y === my
          ? `${text}: midpoint = ((${pair[0][0]}+${pair[1][0]})/2, (${pair[0][1]}+${pair[1][1]})/2) = (${mx},${my}).`
          : `${text}: midpoint = ((${pair[0][0]}+${pair[1][0]})/2, (${pair[0][1]}+${pair[1][1]})/2) = (${x},${y}), not (${mx},${my}).`;
      },
    });
  },
};

type PolygonMode = 'sides' | 'sum' | 'diagonals';

const POLYGONS: { name: string; n: number }[] = [
  { name: 'Triangle', n: 3 },
  { name: 'Quadrilateral', n: 4 },
  { name: 'Pentagon', n: 5 },
  { name: 'Hexagon', n: 6 },
  { name: 'Heptagon', n: 7 },
  { name: 'Octagon', n: 8 },
  { name: 'Nonagon', n: 9 },
  { name: 'Decagon', n: 10 },
  { name: '12-gon', n: 12 },
  { name: '15-gon', n: 15 },
  { name: '20-gon', n: 20 },
];

const polygons: Topic = {
  id: 'polygons',
  name: 'Polygons',
  family: 'geometry',
  band: 'middle',
  grades: 'Grades 5-8',
  blurb: 'Side counts, interior angle sums and diagonals.',
  round(rng: Rng, level: number) {
    const mode: PolygonMode = level < 5
      ? rng.pick(['sides', 'sum'] as const)
      : rng.pick(['sides', 'sum', 'diagonals'] as const);
    const available = POLYGONS.filter((p) => p.n <= 6 + level);
    const poly = rng.pick(available.length > 0 ? available : POLYGONS.slice(0, 3));
    const value = mode === 'sides'
      ? poly.n
      : mode === 'sum'
        ? (poly.n - 2) * 180
        : (poly.n * (poly.n - 3)) / 2;

    const correctCandidates = intForms(value);
    const correctMap = formMap(correctCandidates);
    const correctPool = [...correctMap.keys()].slice(0, 10);
    const correctSet = new Set(correctPool);

    const wrongValues: number[] = [];
    for (const other of POLYGONS) {
      const v = mode === 'sides'
        ? other.n
        : mode === 'sum'
          ? (other.n - 2) * 180
          : (other.n * (other.n - 3)) / 2;
      if (v !== value) wrongValues.push(v);
    }
    for (let d = 1; d <= 24; d++) {
      if (value - d > 0) wrongValues.push(value - d);
      wrongValues.push(value + d);
    }
    const wrongCandidates: { text: string; value: number }[] = [];
    const wrongTexts: string[] = [];
    for (const v of wrongValues) {
      if (v === value) continue;
      for (const item of intForms(v)) {
        if (correctSet.has(item.text) || wrongTexts.includes(item.text)) continue;
        wrongTexts.push(item.text);
        wrongCandidates.push(item);
      }
    }
    const wrongMap = formMap(wrongCandidates);
    const incorrectPool = wrongTexts.slice(0, 28);

    const property = mode === 'sides' ? 'number of sides' : mode === 'sum' ? 'interior angle sum' : 'number of diagonals';
    const formula = mode === 'sides'
      ? `${poly.name} has ${poly.n} sides`
      : mode === 'sum'
        ? `(${poly.n} - 2) x 180 = ${value} deg`
        : `${poly.n} x (${poly.n} - 3) / 2 = ${value}`;

    return makeRound({
      rng,
      heading: `${poly.name}: ${mode === 'sides' ? 'sides' : mode === 'sum' ? 'interior sum' : 'diagonals'}`,
      instruction: `Munch every tile equal to the ${property}.`,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        const tileValue = correctMap.get(text) ?? wrongMap.get(text);
        if (tileValue === value) {
          return `${text} equals ${value}; ${formula}, so it matches.`;
        }
        if (tileValue !== undefined) {
          return `${text} equals ${tileValue}, but ${formula}, so it does not match.`;
        }
        return `${text} is not equal to ${value}; ${formula}.`;
      },
    });
  },
};

type SimilarMode = 'scale' | 'ratio' | 'missing';

const ratioText = (a: number, b: number): string => `${a}:${b}`;
const readRatio = (text: string): [number, number] | null => {
  const m = /^(\d+):(\d+)$/.exec(text);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
};

const similarity: Topic = {
  id: 'similarity',
  name: 'Similar Figures',
  family: 'geometry',
  band: 'high',
  grades: 'Grades 8-11',
  blurb: 'Scale factors, equivalent ratios and missing sides.',
  round(rng: Rng, level: number) {
    const mode: SimilarMode = level < 6
      ? rng.pick(['scale', 'ratio'] as const)
      : rng.pick(['scale', 'ratio', 'missing'] as const);

    let heading = '';
    let instruction = '';
    let correctCandidates: string[] = [];
    let correctMap: Map<string, number> = new Map();
    let wrongCandidates: string[] = [];
    let wrongMap: Map<string, number> = new Map();
    let answer = 0;
    let formula = '';

    if (mode === 'scale') {
      const k = rng.int(2, Math.min(6, 2 + level));
      for (let a = 1; a <= 15; a++) {
        const text = ratioText(a, a * k);
        if (fits(text)) correctCandidates.push(text);
      }
      correctMap = new Map(correctCandidates.map((t) => [t, k]));
      const wrongTexts: string[] = [];
      for (let a = 1; a <= 20; a++) {
        for (const factor of [k - 1, k + 1, k + 2, 1]) {
          if (factor <= 0 || factor === k) continue;
          const text = ratioText(a, a * factor);
          if (fits(text) && !correctCandidates.includes(text) && !wrongTexts.includes(text)) wrongTexts.push(text);
        }
        for (const text of [ratioText(a * k, a), ratioText(a, a + k), ratioText(a + k, a)]) {
          if (fits(text) && !correctCandidates.includes(text) && !wrongTexts.includes(text)) wrongTexts.push(text);
        }
      }
      wrongCandidates = wrongTexts.slice(0, 28);
      answer = k;
      heading = `Scale factor ${k}`;
      instruction = `Munch every side pair with scale factor ${k}.`;
      formula = `scale factor = second side / first side = ${k}`;
    } else if (mode === 'ratio') {
      const p = rng.int(1, Math.min(6, 2 + level));
      let q = rng.int(p + 1, Math.min(9, 3 + level));
      while (gcd(p, q) !== 1) q++;
      if (gcd(p, q) !== 1) q = p + 1;
      for (let k = 1; k <= 12; k++) {
        const text = ratioText(p * k, q * k);
        if (fits(text)) correctCandidates.push(text);
      }
      correctMap = new Map(correctCandidates.map((t) => [t, p / q]));
      const wrongTexts: string[] = [];
      for (let a = 1; a <= 40; a++) {
        for (let b = 1; b <= 40; b++) {
          if (a * q === b * p) continue;
          const text = ratioText(a, b);
          if (fits(text) && !correctCandidates.includes(text) && !wrongTexts.includes(text)) wrongTexts.push(text);
        }
      }
      wrongCandidates = wrongTexts.slice(0, 28);
      heading = `Ratio ${p}:${q}`;
      instruction = `Munch every ratio equivalent to ${p}:${q}.`;
      formula = `${p}/${q} is the target ratio`;
    } else {
      const p = rng.int(1, Math.min(7, 2 + level));
      let q = rng.int(p + 1, Math.min(9, 3 + level));
      while (gcd(p, q) !== 1) q++;
      if (gcd(p, q) !== 1) q = p + 1;
      const m = rng.int(2, Math.min(9, 2 + level));
      if (rng.chance(0.5)) {
        heading = `Proportion ${p}:${q} = x:${q * m}`;
        answer = p * m;
        formula = `${p}/${q} = x/${q * m} -> ${q}x = ${p * q * m} -> x = ${answer}`;
      } else {
        heading = `Proportion ${p}:${q} = ${p * m}:x`;
        answer = q * m;
        formula = `${p}/${q} = ${p * m}/x -> ${p}x = ${p * q * m} -> x = ${answer}`;
      }
      correctCandidates = intForms(answer).map((item) => item.text);
      correctMap = new Map(intForms(answer).map((item) => [item.text, item.value]));
      instruction = 'Munch every value equal to x.';
      const wrongTexts: string[] = [];
      const wrongValues = [
        answer + 1, answer - 1, answer + 2, answer - 2, answer * 2,
        Math.floor(answer / 2), p + q, p * q, q * m, p * m,
        answer + 5, answer + 10, answer - 5,
      ];
      for (const v of wrongValues) {
        if (v <= 0 || v === answer) continue;
        for (const item of intForms(v)) {
          if (correctCandidates.includes(item.text) || wrongTexts.includes(item.text)) continue;
          wrongTexts.push(item.text);
        }
      }
      wrongCandidates = wrongTexts.slice(0, 28);
      wrongMap = new Map(wrongCandidates.map((t) => [t, Number.NaN]));
    }

    const correctPool = [...correctMap.keys()].slice(0, 10);
    const correctSet = new Set(correctPool);
    const incorrectPool = rng
      .shuffle(wrongCandidates)
      .filter((text) => !correctSet.has(text) && fits(text))
      .slice(0, 28);

    return makeRound({
      rng,
      heading,
      instruction,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain: (text) => {
        if (mode === 'scale') {
          const ratio = readRatio(text);
          if (!ratio) return `${text} is not a side pair.`;
          return ratio[1] === ratio[0] * answer
            ? `${text}: ${ratio[1]} / ${ratio[0]} = ${answer}, so the scale factor is ${answer}.`
            : `${text}: ${ratio[1]} / ${ratio[0]} is not ${answer}, so the scale factor is wrong.`;
        }
        if (mode === 'ratio') {
          const ratio = readRatio(text);
          if (!ratio) return `${text} is not a ratio.`;
          const target = heading.slice(6);
          const [p, q] = readRatio(target) ?? [1, 1];
          const left = ratio[0] * q;
          const right = ratio[1] * p;
          return left === right
            ? `${text}: ${ratio[0]} x ${q} = ${left} and ${ratio[1]} x ${p} = ${right}, so the ratios are equivalent.`
            : `${text}: cross products are ${left} and ${right}, so it is not equivalent to ${p}:${q}.`;
        }
        const value = correctMap.get(text) ?? wrongMap.get(text);
        return value === answer
          ? `${text} equals ${answer}; ${formula}, so it matches.`
          : `${text} is not ${answer}; ${formula}.`;
      },
    });
  },
};

type CircleTheoremMode = 'inscribed' | 'cyclic' | 'arc' | 'tangent';

const circleTheorems: Topic = {
  id: 'circle-theorems',
  name: 'Circle Theorems',
  family: 'geometry',
  band: 'high',
  grades: 'Grades 9-12',
  blurb: 'Inscribed angles, cyclic quadrilaterals, arcs and tangents.',
  round(rng: Rng, level: number) {
    const modes: CircleTheoremMode[] = level < 6
      ? ['inscribed', 'arc']
      : ['inscribed', 'cyclic', 'arc', 'tangent'];
    const mode = rng.pick(modes);
    const max = Math.min(170, 50 + level * 6);

    let heading = '';
    let instruction = '';
    let correctCandidates: string[] = [];
    let wrongCandidates: string[] = [];
    let correctMap: Map<string, number> = new Map();
    let wrongMap: Map<string, number> = new Map();
    if (mode === 'inscribed') {
      for (let a = 5; a <= Math.min(85, max); a++) {
        correctCandidates.push(pairText(a, 2 * a));
      }
      for (let a = 5; a <= Math.min(85, max); a++) {
        for (const delta of [1, 2, 5, 10, 15, 20]) {
          const b = 2 * a + delta;
          if (b <= 175) wrongCandidates.push(pairText(a, b));
        }
        if (a <= 85) wrongCandidates.push(pairText(a, a));
        wrongCandidates.push(pairText(a, a + 3));
      }
      heading = 'Inscribed & Central Angles';
      instruction = 'Munch every pair (inscribed, central) where central = 2 x inscribed.';
    } else if (mode === 'cyclic') {
      for (let a = 10; a <= 90; a += 2) {
        correctCandidates.push(pairText(a, 180 - a));
      }
      for (let a = 10; a <= 170; a += 3) {
        for (const delta of [1, 2, 5, 10, 15, 20, 30]) {
          const b = 180 - a + delta;
          if (b > 0 && b <= 175) wrongCandidates.push(pairText(a, b));
        }
      }
      heading = 'Cyclic Quadrilateral';
      instruction = 'Munch every pair of opposite angles that add to 180 deg.';
    } else if (mode === 'arc') {
      for (let a = 10; a <= Math.min(170, max); a++) {
        correctCandidates.push(pairText(a, a));
      }
      for (let a = 10; a <= 160; a += 2) {
        for (const delta of [1, 2, 5, 10, 15, 20, 30]) {
          const b = a + delta;
          if (b <= 175) wrongCandidates.push(pairText(a, b));
        }
      }
      heading = 'Central Angle & Arc';
      instruction = 'Munch every pair where the central angle equals the intercepted arc measure.';
    } else {
      const forms = intForms(90);
      correctMap = formMap(forms);
      correctCandidates = [...correctMap.keys()];
      for (const v of [180, 45, 60, 30, 89, 91, 270, 120, 100, 80, 135, 360, 0, 1]) {
        for (const item of intForms(v)) {
          if (correctMap.has(item.text)) continue;
          wrongCandidates.push(item.text);
          wrongMap.set(item.text, item.value);
        }
      }
      heading = 'Tangent & Radius';
      instruction = 'Munch every tile equal to the angle between a tangent and a radius.';
    }

    if (mode === 'tangent') {
      // The correct map is already built for the 90-degree answer.
    } else {
      correctMap = new Map(correctCandidates.map((t) => [t, 0]));
      wrongMap = new Map(wrongCandidates.map((t) => [t, 0]));
    }

    const correctPool = rng.shuffle(dedupe(correctCandidates)).slice(0, 12);
    const correctSet = new Set(correctPool);
    const incorrectPool = rng
      .shuffle(wrongCandidates)
      .filter((text) => !correctSet.has(text) && fits(text))
      .slice(0, 28);

    const explain = (text: string): string => {
      if (mode === 'tangent') {
        const value = correctMap.get(text) ?? wrongMap.get(text);
        return value === 90
          ? `${text} equals 90 deg; a tangent is perpendicular to the radius at the point of tangency.`
          : `${text} is not 90 deg; a tangent meets a radius at exactly 90 deg.`;
      }
      const pair = readPair(text);
      if (!pair) return `${text} is not an angle pair.`;
      const [a, b] = pair;
      if (mode === 'inscribed') {
        return b === 2 * a
          ? `${text}: 2 x ${a} = ${b}, so the central angle is twice the inscribed angle.`
          : `${text}: 2 x ${a} = ${2 * a}, not ${b}, so the pair is not correct.`;
      }
      if (mode === 'cyclic') {
        return a + b === 180
          ? `${text}: ${a} + ${b} = 180, so these are opposite angles of a cyclic quadrilateral.`
          : `${text}: ${a} + ${b} = ${a + b}, not 180.`;
      }
      return a === b
        ? `${text}: the central angle ${a} deg intercepts an arc of ${b} deg, so they match.`
        : `${text}: the central angle ${a} deg intercepts an arc of ${a} deg, not ${b} deg.`;
    };

    return makeRound({
      rng,
      heading,
      instruction,
      correct: correctPool,
      incorrect: incorrectPool,
      correctCount: 9,
      explain,
    });
  },
};

export const geometryTopics: Topic[] = [
  angles,
  triangleTypes,
  pythagorean,
  areaPerimeter,
  circles,
  volume,
  coordinateGeometry,
  polygons,
  similarity,
  circleTheorems,
];
