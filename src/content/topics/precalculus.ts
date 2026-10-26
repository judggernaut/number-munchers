import { makeRound } from '../build';
import { type Rng, type Topic } from '../types';

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

const fmt = (n: number): string => String(round3(n));


/** Distinct text forms of an integer value, each short enough for a tile. */
function valueForms(value: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (text: string): void => {
    if (text.length <= 9 && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  };
  add(String(value));
  add(`${value}.0`);
  add(`${value}/1`);
  for (const k of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]) add(`${value * k}/${k}`);
  return out;
}

function rationalForms(p: number, q: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (text: string): void => {
    if (text.length <= 9 && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  };
  add(`${p}/${q}`);
  add(`${-p}/${-q}`);
  for (const k of [2, 3, 4, 5, 6, 7, 8, 9]) add(`${p * k}/${q * k}`);
  const dec = p / q;
  add(String(round3(dec)));
  const one = Number(dec.toFixed(1));
  if (Math.abs(one - dec) < 1e-9) add(dec.toFixed(1));
  const two = Number(dec.toFixed(2));
  if (Math.abs(two - dec) < 1e-9) add(dec.toFixed(2));
  return out;
}

function quadExpr(c2: number, c1: number, c0: number): string {
  let text = '';
  if (c2 === 1) text = 'x^2';
  else if (c2 === -1) text = '-x^2';
  else if (c2 !== 0) text = `${c2}x^2`;
  if (c1 !== 0) {
    const mag = Math.abs(c1);
    const term = `${mag === 1 ? '' : mag}x`;
    if (text === '') text = c1 > 0 ? term : `-${term}`;
    else text += c1 > 0 ? `+${term}` : `-${term}`;
  }
  if (c0 !== 0) {
    const term = String(Math.abs(c0));
    if (text === '') text = c0 > 0 ? term : `-${term}`;
    else text += c0 > 0 ? `+${term}` : `-${term}`;
  }
  return text === '' ? '0' : text;
}

const evalCoeffs = (coeffs: readonly number[], x: number): number =>
  coeffs.reduce((sum, c, i) => sum + c * x ** i, 0);

// ---------------------------------------------------------------------------
// 13. Function Transformations
// ---------------------------------------------------------------------------

interface TransformCase {
  f: string;
  g: string;
  c2: number;
  c1: number;
  c0: number;
  correct: string[];
  wrong: Array<[number, number, number]>;
}

const shiftUp3 = [
  'x^2+3',
  '3+x^2',
  'x*x+3',
  'x^2+1+2',
  'x^2+4-1',
  'x^2+2+1',
  'x^2+3+0',
  'x^2+6/2',
  'x^2+3.0',
];
const shiftDown2 = [
  'x^2-2',
  '-2+x^2',
  'x*x-2',
  'x^2-1-1',
  'x^2+1-3',
  'x^2-3+1',
  'x^2-2+0',
  'x^2-4/2',
  'x^2-2.0',
];
const shiftUp5 = [
  'x^2+5',
  '5+x^2',
  'x*x+5',
  'x^2+2+3',
  'x^2+6-1',
  'x^2+4+1',
  'x^2+5+0',
  'x^2+10/2',
  'x^2+5.0',
];
const negForms = [
  '-x^2',
  '0-x^2',
  '-(x^2)',
  '-1*x^2',
  '-x*x',
  '-(x*x)',
  '-1x^2',
  'x^2*(-1)',
  '-x^2+0',
];
const twiceForms = [
  '2x^2',
  'x^2*2',
  'x^2+x^2',
  '2(x^2)',
  '2*x^2',
  '2x^2+0',
  '(2)x^2',
  '2.0x^2',
  '2(x*x)',
];
const thriceForms = [
  '3x^2',
  'x^2*3',
  '3(x^2)',
  '3*x^2',
  '3x^2+0',
  '(3)x^2',
  'x^2*3.0',
  'x^2*6/2',
  'x^2/1*3',
];
const linUp2 = [
  'x+2',
  '2+x',
  'x+1+1',
  'x+2+0',
  'x+3-1',
  'x+4-2',
  '(x+2)',
  'x+2.0',
  'x+(2)',
];
const linDown4 = [
  'x-4',
  '-4+x',
  'x-1-3',
  'x-4+0',
  'x-2-2',
  'x-5+1',
  '(x-4)',
  'x-4.0',
  'x+(-4)',
];
const linTimes3 = [
  '3x',
  '3*x',
  'x*3',
  'x+x+x',
  '3x+0',
  '(3)x',
  '3.0x',
  '6x/2',
  'x*6/2',
];

const transformCases: TransformCase[] = [
  {
    f: 'x^2',
    g: 'f(x)+3',
    c2: 1,
    c1: 0,
    c0: 3,
    correct: shiftUp3,
    wrong: [
      [1, 0, -3],
      [1, 6, 9],
      [1, -6, 9],
      [1, 0, 9],
      [3, 0, 0],
      [1, 3, 0],
      [1, 0, 0],
      [0, 1, 3],
    ],
  },
  {
    f: 'x^2',
    g: 'f(x)-2',
    c2: 1,
    c1: 0,
    c0: -2,
    correct: shiftDown2,
    wrong: [
      [1, 0, 2],
      [1, 4, 4],
      [1, -4, 4],
      [1, 0, -4],
      [2, 0, 0],
      [1, -2, 0],
      [1, 0, 0],
      [0, 1, -2],
    ],
  },
  {
    f: 'x^2',
    g: 'f(x)+5',
    c2: 1,
    c1: 0,
    c0: 5,
    correct: shiftUp5,
    wrong: [
      [1, 0, -5],
      [1, 10, 25],
      [1, -10, 25],
      [1, 0, 25],
      [5, 0, 0],
      [1, 5, 0],
      [1, 0, 0],
      [0, 1, 5],
    ],
  },
  {
    f: 'x^2',
    g: '-f(x)',
    c2: -1,
    c1: 0,
    c0: 0,
    correct: negForms,
    wrong: [
      [-1, 0, 1],
      [-1, 1, 0],
      [1, 0, 0],
      [-2, 0, 0],
      [-1, -1, 0],
      [0, -1, 0],
      [-1, 0, -1],
      [1, 0, 1],
    ],
  },
  {
    f: 'x^2',
    g: '2f(x)',
    c2: 2,
    c1: 0,
    c0: 0,
    correct: twiceForms,
    wrong: [
      [2, 0, 2],
      [2, 2, 0],
      [1, 0, 0],
      [3, 0, 0],
      [2, 0, -1],
      [0, 2, 0],
      [2, 0, 1],
      [1, 0, 2],
    ],
  },
  {
    f: 'x^2',
    g: '3f(x)',
    c2: 3,
    c1: 0,
    c0: 0,
    correct: thriceForms,
    wrong: [
      [3, 0, 3],
      [3, 3, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, -1],
      [0, 3, 0],
      [3, 0, 1],
      [1, 0, 3],
    ],
  },
  {
    f: 'x',
    g: 'f(x)+2',
    c2: 0,
    c1: 1,
    c0: 2,
    correct: linUp2,
    wrong: [
      [0, 1, -2],
      [0, 1, 0],
      [0, 1, 3],
      [0, 2, 2],
      [1, 0, 2],
      [0, 1, 1],
      [0, 1, 4],
      [1, 1, 2],
    ],
  },
  {
    f: 'x',
    g: 'f(x)-4',
    c2: 0,
    c1: 1,
    c0: -4,
    correct: linDown4,
    wrong: [
      [0, 1, 4],
      [0, 1, 0],
      [0, 1, -3],
      [0, 2, -4],
      [1, 0, -4],
      [0, 1, -5],
      [0, 1, -1],
      [1, 1, -4],
    ],
  },
  {
    f: 'x',
    g: '3f(x)',
    c2: 0,
    c1: 3,
    c0: 0,
    correct: linTimes3,
    wrong: [
      [0, 3, 3],
      [0, 1, 0],
      [0, 2, 0],
      [0, 4, 0],
      [1, 3, 0],
      [0, 3, 1],
      [0, 3, -1],
      [1, 0, 0],
    ],
  },
  {
    f: 'x^2+1',
    g: 'f(x)-3',
    c2: 1,
    c1: 0,
    c0: -2,
    correct: shiftDown2,
    wrong: [
      [1, 0, 2],
      [1, 4, 4],
      [1, -4, 4],
      [1, 0, -4],
      [2, 0, 0],
      [1, -2, 0],
      [1, 0, 0],
      [0, 1, -2],
    ],
  },
];

const functionTransformations: Topic = {
  id: 'function-transformations',
  name: 'Transformations',
  family: 'precalculus',
  band: 'high',
  grades: 'Grades 10-12',
  blurb: 'Recognise shifts, reflections and stretches written different ways.',
  round(rng: Rng, level: number) {
    const pool =
      level < 6
        ? transformCases.slice(0, 3)
        : level < 12
          ? transformCases.slice(0, 6)
          : transformCases;
    const target = rng.pick(pool);
    const targetText = quadExpr(target.c2, target.c1, target.c0);
    const values = new Map<string, { ok: boolean; c2: number; c1: number; c0: number }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    for (const text of target.correct) {
      if (text.length > 9 || values.has(text)) continue;
      values.set(text, { ok: true, c2: target.c2, c1: target.c1, c0: target.c0 });
      correct.push(text);
    }

    const addWrong = (c2: number, c1: number, c0: number): void => {
      if (c2 === target.c2 && c1 === target.c1 && c0 === target.c0) return;
      const text = quadExpr(c2, c1, c0);
      if (text.length > 9 || values.has(text)) return;
      values.set(text, { ok: false, c2, c1, c0 });
      incorrect.push(text);
    };

    for (const [c2, c1, c0] of target.wrong) addWrong(c2, c1, c0);
    for (const d of [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]) {
      addWrong(target.c2, target.c1, target.c0 + d);
    }
    for (const d of [-3, -2, -1, 1, 2, 3]) {
      addWrong(target.c2, target.c1 + d, target.c0);
    }
    for (const c2 of [0, 1, 2, 3, 4]) addWrong(c2, target.c1, target.c0);

    return makeRound({
      rng,
      heading: `g(x)=${target.g}, f(x)=${target.f}`,
      instruction: 'Munch every expression equal to g(x).',
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not equal to g(x).`;
        if (info.ok) return `${text} simplifies to ${targetText}, so it is equal to g(x).`;
        const at0 = info.c0;
        const at1 = info.c2 + info.c1 + info.c0;
        const g0 = target.c0;
        const g1 = target.c2 + target.c1 + target.c0;
        if (at0 !== g0) return `${text} gives ${at0} at x=0, but g(0) = ${g0} because g(x) = ${targetText}.`;
        return `${text} gives ${at1} at x=1, but g(1) = ${g1} because g(x) = ${targetText}.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 14. Limits
// ---------------------------------------------------------------------------

interface LimitCase {
  a: string;
  expr: string;
  value: number | null;
  hard: boolean;
}

const limitCases: LimitCase[] = [
  { a: '2', expr: '(x^2-4)/(x-2)', value: 4, hard: false },
  { a: '3', expr: '(x^2-9)/(x-3)', value: 6, hard: false },
  { a: '2', expr: '(x^2+x-6)/(x-2)', value: 5, hard: false },
  { a: '1', expr: '(x^2-1)/(x-1)', value: 2, hard: false },
  { a: '2', expr: '(x^2-4x+4)/(x-2)', value: 0, hard: true },
  { a: '2', expr: '(2x^2-8)/(x-2)', value: 8, hard: true },
  { a: '0', expr: '(x^2-3x)/x', value: -3, hard: true },
  { a: '0', expr: '1/x', value: null, hard: true },
  { a: '0', expr: 'abs(x)/x', value: null, hard: true },
  { a: '0', expr: '(x+1)/x', value: null, hard: true },
  { a: '2', expr: '1/(x-2)', value: null, hard: true },
];

const limits: Topic = {
  id: 'limits',
  name: 'Limits',
  family: 'precalculus',
  band: 'high',
  grades: 'Grades 11-12',
  blurb: 'Approach the point from both sides and munch the limiting value.',
  round(rng: Rng, level: number) {
    const pool = level < 7 ? limitCases.filter((c) => !c.hard) : limitCases;
    const target = rng.pick(pool);
    const values = new Map<string, { kind: 'value' | 'text'; value: number; ok: boolean }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const add = (text: string, kind: 'value' | 'text', value: number, ok: boolean): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, { kind, value, ok });
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    if (target.value === null) {
      for (const text of ['DNE', 'nolimit', 'undefined', 'undef', 'none', 'notexist', 'doesnot', 'D.N.E.', 'novalue']) {
        add(text, 'text', 0, true);
      }
      for (const text of ['0', '1', '-1', '2', '-2', '3', '-3', '4', '-4', '5', '6', '8', '10', '100', 'inf', '-inf', '0.0', '1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '8.0', '10.0']) {
        add(text, 'text', 0, false);
      }
    } else {
      for (const form of valueForms(target.value).slice(0, 9)) add(form, 'value', target.value, true);
      for (const text of ['DNE', 'undef', 'nolimit', '0/0', 'inf', 'noanswer']) add(text, 'text', 0, false);
      const wrongValues = [
        target.value + 1,
        target.value - 1,
        target.value + 2,
        target.value - 2,
        target.value + 3,
        target.value - 3,
        target.value + 4,
        target.value - 4,
        target.value * 2,
        -target.value,
        target.value / 2,
        0,
        1,
        -1,
        2,
        -2,
        3,
        -3,
        4,
        5,
        6,
      ];
      for (const v of wrongValues) {
        if (v !== target.value) add(String(round3(v)), 'value', v, false);
      }
      for (let d = 1; d <= 20; d++) {
        add(String(round3(target.value + d)), 'value', target.value + d, false);
        add(String(round3(target.value - d)), 'value', target.value - d, false);
      }
    }

    return makeRound({
      rng,
      heading: `lim x->${target.a} ${target.expr}`,
      instruction:
        target.value === null
          ? 'The limit does not exist. Munch every tile that says so.'
          : 'Munch every tile equal to the limit.',
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not a value of this limit.`;
        if (target.value === null) {
          if (info.ok) {
            return `${text} is right: the left and right approaches to x=${target.a} disagree, so ${target.expr} has no two-sided limit.`;
          }
          if (info.kind === 'value' || /^-?\d/.test(text)) {
            return `${text} is a finite value, but approaching x=${target.a} from the two sides gives different results, so the limit is DNE.`;
          }
          return `${text} is not the answer; the two-sided limit of ${target.expr} does not exist.`;
        }
        if (info.ok) {
          return `${text} = ${target.value}, the two-sided limit of ${target.expr} as x approaches ${target.a}.`;
        }
        if (info.kind === 'text') {
          return `${text} is wrong: the limit exists and equals ${target.value}; the two-sided approaches agree.`;
        }
        return `${text} = ${fmt(info.value)}, not ${target.value}. At x=${target.a} the expression is 0/0, so simplify before substituting.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 15. Derivatives
// ---------------------------------------------------------------------------

interface DerivCase {
  f: string;
  dtext: string;
  coeffs: number[];
  correct: string[];
}

const derivativeCases: DerivCase[] = [
  {
    f: 'x^2',
    dtext: '2x',
    coeffs: [0, 2],
    correct: ['2x', '2*x', 'x*2', 'x+x', '2x+0', '2x+0.0', '4x/2', '(2)x', '2(x)'],
  },
  {
    f: 'x^3',
    dtext: '3x^2',
    coeffs: [0, 0, 3],
    correct: ['3x^2', '3*x^2', 'x^2*3', '3x^2+0', '(3)x^2', '3.0x^2', 'x^2*3.0', 'x^2*6/2', 'x^2*3/1'],
  },
  {
    f: 'x^3+2x',
    dtext: '3x^2+2',
    coeffs: [2, 0, 3],
    correct: [
      '3x^2+2',
      '2+3x^2',
      '3x*x+2',
      '2+3x*x',
      '3x^2+1+1',
      '3x^2+4/2',
      '3x^2+2+0',
      '3x^2+2-0',
      '3x^2+2.0',
    ],
  },
  {
    f: '3x^2+1',
    dtext: '6x',
    coeffs: [0, 6],
    correct: ['6x', '6*x', 'x*6', '3x+3x', '6x+0', '6x+0.0', '12x/2', '(6)x', '2*3x'],
  },
  {
    f: 'x^2+5x',
    dtext: '2x+5',
    coeffs: [5, 2],
    correct: [
      '2x+5',
      '5+2x',
      '2*x+5',
      '5+2*x',
      '2x+5+0',
      '2x+4+1',
      '2x+6-1',
      '2x+10/2',
      '2x+5.0',
    ],
  },
  {
    f: '(2x+1)^2',
    dtext: '8x+4',
    coeffs: [4, 8],
    correct: ['8x+4', '4+8x', '8*x+4', '8x+2+2', '8x+5-1', '8x+8/2', '8x+4+0', '8x+4-0', '8x+4.0'],
  },
  {
    f: '(2x+3)^2',
    dtext: '8x+12',
    coeffs: [12, 8],
    correct: ['8x+12', '12+8x', '8*x+12', '8x+6+6', '8x+24/2', '8x+12.0', '4(2x+3)', '8x+13-1', '8x+12+0'],
  },
  {
    f: 'x^3-x',
    dtext: '3x^2-1',
    coeffs: [-1, 0, 3],
    correct: [
      '3x^2-1',
      '-1+3x^2',
      '3x*x-1',
      '-1+3x*x',
      '3x^2-2+1',
      '3x^2+1-2',
      '3x^2-1+0',
      '3x^2-2/2',
      '3x^2-1.0',
    ],
  },
  {
    f: '2x^2-3x',
    dtext: '4x-3',
    coeffs: [-3, 4],
    correct: ['4x-3', '-3+4x', '4*x-3', '4x-4+1', '4x-5+2', '4x-3+0', '4x-3.0', '8x-3-4x', '4x-6/2'],
  },
  {
    f: '(x+1)^2',
    dtext: '2x+2',
    coeffs: [2, 2],
    correct: ['2x+2', '2+2x', '2x+1+1', '2x+3-1', '2x+4/2', '2x+2+0', '2x+2-0', '2x+2.0', '2(x+1)'],
  },
];

const derivatives: Topic = {
  id: 'derivatives',
  name: 'Derivatives',
  family: 'precalculus',
  band: 'high',
  grades: 'Grades 11-12',
  blurb: 'Differentiate with the power rule, sums and simple chain rule.',
  round(rng: Rng, level: number) {
    const pool =
      level < 5
        ? derivativeCases.slice(0, 3)
        : level < 10
          ? derivativeCases.slice(0, 6)
          : derivativeCases;
    const target = rng.pick(pool);
    const targetText = target.dtext;
    const values = new Map<string, { ok: boolean; coeffs: number[] }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    for (const text of target.correct) {
      if (text.length > 9 || values.has(text)) continue;
      values.set(text, { ok: true, coeffs: target.coeffs });
      correct.push(text);
    }

    const addWrong = (text: string, coeffs: number[]): void => {
      if (text.length > 9 || values.has(text)) return;
      const same =
        coeffs.length === target.coeffs.length && coeffs.every((c, i) => c === target.coeffs[i]);
      if (same) return;
      values.set(text, { ok: false, coeffs });
      incorrect.push(text);
    };

    const c0 = target.coeffs[0] ?? 0;
    const c1 = target.coeffs[1] ?? 0;
    const c2 = target.coeffs[2] ?? 0;
    addWrong('x^2', [0, 0, 1]);
    addWrong('x^3', [0, 0, 0, 1]);
    addWrong('3x', [0, 3]);
    addWrong('6x+2', [2, 6]);
    addWrong('3x+2', [2, 3]);
    addWrong('4x+8', [8, 4]);
    addWrong('2x', [0, 2]);
    addWrong('2', [2]);
    addWrong('0', [0]);
    addWrong('1', [1]);
    addWrong('x', [0, 1]);
    addWrong('3x^2+2x', [0, 2, 3]);
    addWrong('4x^3', [0, 0, 0, 4]);

    for (const d of [-4, -3, -2, -1, 1, 2, 3, 4]) {
      addWrong(quadExpr(0, c1, c0 + d), [c0 + d, c1]);
      addWrong(quadExpr(0, c1 + d, c0), [c0, c1 + d]);
      if (target.coeffs.length >= 3) {
        addWrong(quadExpr(c2, c1, c0 + d), [c0 + d, c1, c2]);
        addWrong(quadExpr(c2, c1 + d, c0), [c0, c1 + d, c2]);
        addWrong(quadExpr(c2 + d, c1, c0), [c0, c1, c2 + d]);
      }
    }

    return makeRound({
      rng,
      heading: `f(x)=${target.f}`,
      instruction: "Munch every expression equal to f'(x).",
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not equal to f'(x).`;
        if (info.ok) return `${text} matches f'(x) = ${targetText} for f(x) = ${target.f}.`;
        for (const x of [0, 1, 2, 3]) {
          const got = evalCoeffs(info.coeffs, x);
          const want = evalCoeffs(target.coeffs, x);
          if (got !== want) {
            return `${text} gives ${fmt(got)} at x=${x}, but f'(x) = ${targetText} gives ${fmt(want)} there.`;
          }
        }
        return `${text} is not f'(x); differentiating ${target.f} term by term gives ${targetText}.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 16. Series & Summation
// ---------------------------------------------------------------------------

interface ArithmeticSeries {
  kind: 'arith';
  heading: string;
  a: number;
  d: number;
  last: number;
  sum: number;
}

interface GeometricSeries {
  kind: 'geom';
  heading: string;
  a: number;
  r: number;
  n: number;
  sum: number;
}

interface InfiniteSeries {
  kind: 'infinite';
  heading: string;
  p: number;
  q: number;
}

interface DivergentSeries {
  kind: 'divergent';
  heading: string;
  r: number;
}

type SeriesCase = ArithmeticSeries | GeometricSeries | InfiniteSeries | DivergentSeries;

const seriesCases: SeriesCase[] = [
  { kind: 'arith', heading: '2+5+8+...+29', a: 2, d: 3, last: 29, sum: 155 },
  { kind: 'arith', heading: '3+7+11+...+43', a: 3, d: 4, last: 43, sum: 253 },
  { kind: 'arith', heading: '1+4+7+...+28', a: 1, d: 3, last: 28, sum: 145 },
  { kind: 'arith', heading: '20+17+14+...+2', a: 20, d: -3, last: 2, sum: 77 },
  { kind: 'arith', heading: '5+9+13+...+41', a: 5, d: 4, last: 41, sum: 230 },
  { kind: 'geom', heading: '3+6+12+...+192', a: 3, r: 2, n: 7, sum: 381 },
  { kind: 'geom', heading: '2+6+18+...+486', a: 2, r: 3, n: 6, sum: 728 },
  { kind: 'geom', heading: '1+2+4+...+128', a: 1, r: 2, n: 8, sum: 255 },
  { kind: 'geom', heading: '4+12+36+...+972', a: 4, r: 3, n: 6, sum: 1456 },
  { kind: 'infinite', heading: '1+1/2+1/4+...', p: 2, q: 1 },
  { kind: 'infinite', heading: '1+1/3+1/9+...', p: 3, q: 2 },
  { kind: 'infinite', heading: '2+1+1/2+...', p: 4, q: 1 },
  { kind: 'infinite', heading: '3+1+1/3+...', p: 9, q: 2 },
  { kind: 'infinite', heading: '1/2+1/4+1/8+...', p: 1, q: 1 },
  { kind: 'divergent', heading: '1+2+4+8+...', r: 2 },
  { kind: 'divergent', heading: '1+3+9+27+...', r: 3 },
  { kind: 'divergent', heading: '2+4+8+16+...', r: 2 },
  { kind: 'divergent', heading: '5+10+20+40+...', r: 2 },
];

const series: Topic = {
  id: 'series',
  name: 'Series & Summation',
  family: 'precalculus',
  band: 'high',
  grades: 'Grades 11-12',
  blurb: 'Add arithmetic and geometric series, or say when they diverge.',
  round(rng: Rng, level: number) {
    const easy = seriesCases.filter((c) => c.kind === 'arith' || c.kind === 'geom');
    const pool = level < 7 ? easy : seriesCases;
    const target = rng.pick(pool);
    const values = new Map<string, { kind: 'value' | 'text'; value: number; ok: boolean }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const add = (text: string, kind: 'value' | 'text', value: number, ok: boolean): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, { kind, value, ok });
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    let sumText = '';
    if (target.kind === 'divergent') {
      for (const text of ['DNE', 'diverges', 'nosum', 'inf', 'infinity', 'unbounded', 'nolimit', 'divergent', 'grows']) {
        add(text, 'text', 0, true);
      }
      for (const text of ['converges', 'finite', 'hassum', 'sum=2', 'limit', 'partial', '0', '1', '2', '3', '4', '5', '8', '10', '16', '20', '32', '40', '64', '80', '100', '-1', '-2']) {
        add(text, 'text', 0, false);
      }
    } else {
      if (target.kind === 'infinite') {
        sumText = target.q === 1 ? String(target.p) : `${target.p}/${target.q}`;
        const forms = target.q === 1 ? valueForms(target.p) : rationalForms(target.p, target.q);
        if (target.q !== 1) sumText = `${target.p}/${target.q}`;
        for (const form of forms.slice(0, 9)) {
          const value = target.p / target.q;
          add(form, 'value', value, true);
        }
        const sum = target.p / target.q;
        const wrongValues = [
          sum + 1,
          sum - 1,
          sum + 2,
          sum - 2,
          sum + 3,
          sum - 3,
          sum + 4,
          sum - 4,
          sum * 2,
          -sum,
          sum / 2,
          0,
          1,
          2,
          3,
          4,
          5,
          sum + 0.5,
        ];
        for (const v of wrongValues) {
          if (Math.abs(v - sum) < 1e-9) continue;
          add(String(round3(v)), 'value', v, false);
        }
        for (let d = 1; d <= 20; d++) {
          add(String(round3(sum + d)), 'value', sum + d, false);
          add(String(round3(sum - d)), 'value', sum - d, false);
        }
        for (const text of ['DNE', 'diverges', 'nosum', 'converges']) add(text, 'text', 0, false);
      } else {
        const sum = target.sum;
        sumText = String(sum);
        for (const form of valueForms(sum).slice(0, 9)) add(form, 'value', sum, true);
        for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10]) {
          const v = sum + d;
          if (v !== sum) add(String(v), 'value', v, false);
        }
        add(String(sum * 2), 'value', sum * 2, false);
        add(String(-sum), 'value', -sum, false);
        for (const text of ['DNE', 'diverges', 'nosum', 'converges']) add(text, 'text', 0, false);
      }
    }

    const instruction =
      target.kind === 'divergent'
        ? 'This geometric series diverges. Munch every tile that says so.'
        : target.kind === 'infinite'
          ? 'This series converges. Munch every tile equal to its sum.'
          : 'Munch every tile equal to the sum.';

    return makeRound({
      rng,
      heading: target.heading,
      instruction,
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not a value of this series.`;
        if (target.kind === 'divergent') {
          if (info.ok) return `${text} is right: the ratio is ${target.r}, and |${target.r}| >= 1, so the series diverges.`;
          if (info.kind === 'value' || /^-?\d/.test(text)) {
            return `${text} is a finite value, but the ratio ${target.r} >= 1 makes the series diverge, so it has no finite sum.`;
          }
          return `${text} is wrong: the ratio ${target.r} >= 1, so this geometric series diverges.`;
        }
        if (info.ok) return `${text} = ${sumText}, the sum of ${target.heading}.`;
        if (info.kind === 'text') return `${text} is wrong: ${target.heading} has a finite sum: ${sumText}.`;
        return `${text} = ${fmt(info.value)}, not ${sumText}.`;
      },
    });
  },
};

export const precalculusTopics: Topic[] = [
  functionTransformations,
  limits,
  derivatives,
  series,
];
