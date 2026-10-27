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

/** Distinct text forms of a small rational p/q (q > 0). */
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

/** Format a quadratic c2*x^2 + c1*x + c0 without spaces. */
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

const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
};

// ---------------------------------------------------------------------------
// 1. Evaluate Expressions
// ---------------------------------------------------------------------------

const evaluateExpressions: Topic = {
  id: 'evaluate-expressions',
  name: 'Plug It In',
  family: 'algebra',
  band: 'middle',
  grades: 'Grades 7-9',
  blurb: 'Substitute for x and munch every expression with the target value.',
  round(rng: Rng, level: number) {
    const x = rng.int(2, Math.min(9, 3 + Math.floor(level / 3)));
    const a = rng.int(2, Math.min(7, 2 + Math.floor(level / 4)));
    const b = rng.int(1, Math.min(12, 3 + level));
    const target = a * x + b;

    const values = new Map<string, number>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const addCorrect = (text: string): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, target);
      correct.push(text);
    };

    addCorrect(`${a}x+${b}`);
    addCorrect(`${b}+${a}x`);
    addCorrect(`${a}*${x}+${b}`);
    addCorrect(`${x}+${target - x}`);
    addCorrect(`${target - 2}+2`);
    for (const form of valueForms(target).slice(0, 5)) addCorrect(form);

    const addWrong = (text: string, value: number): void => {
      if (text.length > 9 || value === target || values.has(text)) return;
      values.set(text, value);
      incorrect.push(text);
    };

    addWrong(`${a}x`, a * x);
    addWrong(`${a}x-${b}`, a * x - b);
    addWrong(`${a + 1}x+${b}`, (a + 1) * x + b);
    if (a > 2) addWrong(`${a - 1}x+${b}`, (a - 1) * x + b);
    addWrong(`${x}+${b}`, x + b);
    addWrong(`${a * x}-${b}`, a * x - b);
    addWrong(`${a}x+${b}+1`, target + 1);
    addWrong(`${a}*${x}+${b + 1}`, target + 1);
    addWrong(`${a}*${x}+${b - 1}`, target - 1);
    addWrong(`${a}x^2`, a * x * x);
    addWrong('2x', 2 * x);
    addWrong('x', x);
    addWrong(`${a}x+${b * 2}`, a * x + 2 * b);
    addWrong(`${a + 2}x+${b}`, (a + 2) * x + b);
    addWrong(`${target * 2}`, target * 2);
    addWrong(`${-target}`, -target);
    addWrong(`${target}/2`, target / 2);
    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12]) {
      addWrong(String(target + d), target + d);
      if (target - d > 0) addWrong(String(target - d), target - d);
    }

    return makeRound({
      rng,
      heading: `x = ${x}`,
      instruction: `Munch every expression equal to ${target} when x = ${x}.`,
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const v = values.get(text);
        if (v === undefined) return `${text} is not equal to ${target} when x = ${x}.`;
        if (v === target) return `${text} gives ${target} when x = ${x}, so the munch is correct.`;
        return `${text} gives ${fmt(v)} when x = ${x}; ${fmt(v)} is not ${target}.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 2. Solve Linear Equations
// ---------------------------------------------------------------------------

const solveLinear: Topic = {
  id: 'solve-linear',
  name: 'Solve for x',
  family: 'algebra',
  band: 'middle',
  grades: 'Grades 7-9',
  blurb: 'Find every candidate value that makes the equation true.',
  round(rng: Rng, level: number) {
    const a = rng.int(2, Math.min(8, 3 + Math.floor(level / 5)));
    const root = rng.pick([-7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8] as const);
    const bSign = rng.chance(0.5) ? 1 : -1;
    const b = rng.int(1, Math.min(9, 3 + Math.floor(level / 3))) * bSign;
    const c = a * root + b;
    const bText = b > 0 ? `+${b}` : `-${Math.abs(b)}`;
    const equation = `${a}x${bText}=${c}`;

    const values = new Map<string, number>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    for (const form of valueForms(root)) {
      if (!values.has(form)) {
        values.set(form, root);
        correct.push(form);
      }
    }

    const addWrong = (text: string, value: number): void => {
      if (text.length > 9 || value === root || values.has(text)) return;
      values.set(text, value);
      incorrect.push(text);
    };

    addWrong(`${c}/${a}`, c / a);
    addWrong(`${-c}/${a}`, -c / a);
    addWrong(`${b}/${a}`, b / a);
    addWrong(`${c + b}/${a}`, (c + b) / a);
    addWrong(`${c - b}/${a}`, (c - b) / a);
    addWrong(`${a * root}`, a * root);
    addWrong(`${-root}`, -root);
    addWrong(`${root * 2}`, root * 2);
    addWrong(`${root + a}`, root + a);
    addWrong(`${root - a}`, root - a);
    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10]) {
      addWrong(String(root + d), root + d);
    }
    addWrong(`${root * 3}`, root * 3);
    addWrong(`${root * 4}`, root * 4);

    return makeRound({
      rng,
      heading: equation,
      instruction: `Munch every solution of ${equation}.`,
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const v = values.get(text);
        if (v === undefined) return `${text} is not a solution of ${equation}.`;
        const lhs = a * v + b;
        if (v === root) {
          return `${text} equals ${fmt(root)}; ${a}(${fmt(root)})${bText} = ${fmt(lhs)}, so it solves ${equation}.`;
        }
        return `${text} equals ${fmt(v)}; ${a}(${fmt(v)})${bText} = ${fmt(lhs)}, not ${c}.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 3. Linear Inequalities
// ---------------------------------------------------------------------------

const linearInequalities: Topic = {
  id: 'linear-inequalities',
  name: 'Inequalities',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 8-10',
  blurb: 'Munch every value on the correct side of the inequality.',
  round(rng: Rng, level: number) {
    const op = rng.pick(['>=', '<=', '>', '<'] as const);
    const a = rng.int(2, Math.min(8, 3 + Math.floor(level / 4)));
    const bSign = rng.chance(0.5) ? 1 : -1;
    const b = rng.int(1, 9) * bSign;
    const boundary = rng.int(-6, 6);
    const c = a * boundary + b;
    const bText = b > 0 ? `+${b}` : `-${Math.abs(b)}`;
    const relation = `${a}x${bText}${op}${c}`;

    const values = new Map<string, number>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const addValue = (v: number, ok: boolean): void => {
      const text = String(v);
      if (text.length > 9 || values.has(text)) return;
      values.set(text, v);
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    if (op === '>=') {
      for (let v = boundary; v <= boundary + 9; v++) addValue(v, true);
      for (let v = boundary - 1; v >= boundary - 21; v--) addValue(v, false);
    } else if (op === '>') {
      for (let v = boundary + 1; v <= boundary + 10; v++) addValue(v, true);
      for (let v = boundary; v >= boundary - 20; v--) addValue(v, false);
    } else if (op === '<=') {
      for (let v = boundary - 9; v <= boundary; v++) addValue(v, true);
      for (let v = boundary + 1; v <= boundary + 21; v++) addValue(v, false);
    } else {
      for (let v = boundary - 10; v <= boundary - 1; v++) addValue(v, true);
      for (let v = boundary; v <= boundary + 20; v++) addValue(v, false);
    }

    return makeRound({
      rng,
      heading: relation,
      instruction: `Munch every x with ${relation}.`,
      correct,
      incorrect,
      correctCount: 10,
      explain: (text) => {
        const v = values.get(text);
        if (v === undefined) return `${text} is not a value of x here.`;
        const lhs = a * v + b;
        const ok = op === '>=' ? lhs >= c : op === '<=' ? lhs <= c : op === '>' ? lhs > c : lhs < c;
        return `x = ${v}: ${a}(${v})${bText} = ${lhs}; ${lhs} ${op} ${c} is ${ok ? 'true' : 'false'}.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 4. Slope
// ---------------------------------------------------------------------------

const slope: Topic = {
  id: 'slope',
  name: 'Slope',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 8-10',
  blurb: 'Compute rise over run from points or from an equation.',
  round(rng: Rng, level: number) {
    const values = new Map<string, number | null>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const add = (text: string, value: number | null, ok: boolean): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, value);
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    let heading: string;
    let slopeValue: number | null;
    let rise = 0;
    let run = 0;
    let mode: 'points' | 'equation' = 'points';

    const useUndefined = rng.chance(0.15);
    if (useUndefined) {
      const x1 = rng.int(-5, 5);
      const y1 = rng.int(-6, 6);
      const y2 = y1 + rng.int(1, 6);
      heading = `(${x1},${y1}) to (${x1},${y2})`;
      slopeValue = null;
      rise = y2 - y1;
      run = 0;
    } else {
      const useFraction = level >= 5 && rng.chance(0.35);
      let p: number;
      let q: number;
      if (useFraction) {
        const pair = rng.pick([[1, 2], [3, 2], [3, 4], [-1, 2], [-3, 2]] as const);
        p = pair[0];
        q = pair[1];
      } else {
        p = rng.int(-4, 4);
        q = 1;
      }
      const x1 = rng.int(-4, 4);
      const y1 = rng.int(-5, 5);
      const step = rng.int(1, 3);
      const x2 = x1 + q * step;
      const y2 = y1 + p * step;
      const scale = p / q;
      slopeValue = scale;
      rise = y2 - y1;
      run = x2 - x1;
      if (Number.isInteger(scale) && rng.chance(0.22)) {
        mode = 'equation';
        const m = Math.round(scale);
        const intercept = rng.int(-6, 6);
        const mText = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`;
        const bText = intercept === 0 ? '' : intercept > 0 ? `+${intercept}` : `${intercept}`;
        heading = `y=${mText}${bText}`;
        slopeValue = m;
        rise = m;
        run = 1;
      } else {
        heading = `(${x1},${y1}) to (${x2},${y2})`;
      }
    }

    if (slopeValue === null) {
      for (const text of ['undef', '1/0', '2/0', '3/0', '4/0', '5/0', '0/0', '6/0', '7/0', '8/0']) {
        add(text, null, true);
      }
    } else if (Number.isInteger(slopeValue)) {
      for (const form of valueForms(slopeValue)) add(form, slopeValue, true);
    } else {
      const g = gcd(Math.round(slopeValue * 1000), 1000);
      const num = Math.round(slopeValue * 1000) / g;
      const den = 1000 / g;
      for (const form of rationalForms(num, den)) add(form, slopeValue, true);
    }

    if (slopeValue === null) {
      for (const v of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, 7, 8, 9, 10, -6, -7, -8, 11, 12]) {
        add(String(v), v, false);
      }
      add('0/1', 0, false);
      add('1/1', 1, false);
      add('5/5', 1, false);
    } else {
      add('undef', null, false);
      const wrongValues = [
        -slopeValue,
        slopeValue + 1,
        slopeValue - 1,
        slopeValue + 2,
        slopeValue - 2,
        slopeValue * 2,
        slopeValue / 2,
        slopeValue + 3,
        slopeValue - 3,
        1 / slopeValue,
        rise,
        run,
        rise + run,
        rise - run,
      ];
      for (const v of wrongValues) {
        if (!Number.isFinite(v) || v === slopeValue) continue;
        if (Number.isInteger(v)) add(String(v), v, false);
        else add(String(round3(v)), v, false);
      }
      for (let d = 1; d <= 20; d++) {
        const up: number = (slopeValue as number) + d;
        const down: number = (slopeValue as number) - d;
        if (up !== slopeValue) add(String(round3(up)), up, false);
        if (down !== slopeValue) add(String(round3(down)), down, false);
      }
      add(String(round3((slopeValue as number) * 3)), (slopeValue as number) * 3, false);
      add(String(round3((slopeValue as number) / 3)), (slopeValue as number) / 3, false);
      add('0/1', 0, slopeValue === 0);
      add('1/1', 1, slopeValue === 1);
      add('2/1', 2, slopeValue === 2);
    }

    const slopeText = slopeValue === null ? 'undefined' : fmt(slopeValue);
    return makeRound({
      rng,
      heading,
      instruction: 'Munch every tile equal to the slope.',
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const v = values.get(text);
        if (slopeValue === null) {
          if (v === null) return `${text} is undefined, just like the slope of a vertical line (run = 0).`;
          return `${text} = ${fmt(v as number)}, but this line is vertical: run = 0, so the slope is undefined.`;
        }
        if (v === null) return `${text} is undefined, but this line has slope ${slopeText}.`;
        if (v === slopeValue) return `${text} = ${slopeText}; rise/run = ${rise}/${run}.`;
        const why = mode === 'equation' ? 'the x coefficient is the slope' : 'slope = rise/run';
        return `${text} = ${fmt(v as number)}, not ${slopeText}; ${why} = ${rise}/${run}.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 5. Systems of Equations
// ---------------------------------------------------------------------------

const systems: Topic = {
  id: 'systems',
  name: 'Systems',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-11',
  blurb: 'Munch ordered pairs that make both equations true at once.',
  round(rng: Rng, level: number) {
    const dependent = rng.chance(level >= 12 ? 0.35 : 0.2);
    const coeffMax = Math.min(5, 2 + Math.floor(level / 5));
    const values = new Map<string, number[]>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    type Eq = { text: string; lhs: (x: number, y: number) => number; rhs: (x: number, y: number) => number };
    const equations: Eq[] = [];
    let goodPairs: Array<[number, number]> = [];

    if (dependent) {
      const rising = rng.chance(0.5);
      const k = rng.int(-2, 2);
      if (rising) {
        equations.push({ text: `y=x${signed(k)}`, lhs: (_x, y) => y, rhs: (x) => x + k });
        equations.push({
          text: `2y=2x${signed(2 * k)}`,
          lhs: (_x, y) => 2 * y,
          rhs: (x) => 2 * x + 2 * k,
        });
        for (let x = -2; x <= 6; x++) goodPairs.push([x, x + k]);
      } else {
        equations.push({ text: `y=-x${signed(k)}`, lhs: (_x, y) => y, rhs: (x) => -x + k });
        equations.push({
          text: `3y=-3x${signed(3 * k)}`,
          lhs: (_x, y) => 3 * y,
          rhs: (x) => -3 * x + 3 * k,
        });
        for (let x = -2; x <= 6; x++) goodPairs.push([x, -x + k]);
      }
    } else {
      const x0 = rng.int(1, 3);
      const y0 = rng.int(1, 3);
      let a = 1;
      let b = 1;
      let c = 1;
      let d = 1;
      for (let tries = 0; tries < 50; tries++) {
        a = rng.int(-coeffMax, coeffMax) || 1;
        b = rng.int(-coeffMax, coeffMax) || 1;
        c = rng.int(-coeffMax, coeffMax) || 1;
        d = rng.int(-coeffMax, coeffMax) || 1;
        if (a * d - b * c !== 0) break;
      }
      const e1 = a * x0 + b * y0;
      const e2 = c * x0 + d * y0;
      equations.push({
        text: `${a === 1 ? '' : a === -1 ? '-' : a}x${b > 0 ? '+' : '-'}${Math.abs(b) === 1 ? '' : Math.abs(b)}y=${e1}`,
        lhs: (x, y) => a * x + b * y,
        rhs: () => e1,
      });
      equations.push({
        text: `${c === 1 ? '' : c === -1 ? '-' : c}x${d > 0 ? '+' : '-'}${Math.abs(d) === 1 ? '' : Math.abs(d)}y=${e2}`,
        lhs: (x, y) => c * x + d * y,
        rhs: () => e2,
      });
      goodPairs = [[x0, y0]];
    }

    const heading = equations.map((eq) => eq.text).join(';');

    const check = (x: number, y: number): { ok: boolean; left: string; right: string } => {
      const ok = equations.every((eq) => eq.lhs(x, y) === eq.rhs(x, y));
      const left = equations.map((eq) => `${eq.lhs(x, y)}`).join(', ');
      const right = equations.map((eq) => `${eq.rhs(x, y)}`).join(', ');
      return { ok, left, right };
    };

    const addPair = (px: number, py: number, ok: boolean): void => {
      const text = `(${px},${py})`;
      if (text.length > 7 || values.has(text)) return;
      values.set(text, [px, py]);
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    if (dependent) {
      for (const [px, py] of goodPairs) addPair(px, py, true);
    } else {
      const [x0, y0] = goodPairs[0]!;
      const forms = [
        `(${x0},${y0})`,
        `(${x0}.0,${y0})`,
        `(${x0},${y0}.0)`,
        `(${2 * x0}/2,${y0})`,
        `(${3 * x0}/3,${y0})`,
        `(${x0},${2 * y0}/2)`,
        `(${x0},${3 * y0}/3)`,
        `(${x0},${y0}/1)`,
      ];
      for (const text of forms) {
        if (text.length > 7 || values.has(text)) continue;
        values.set(text, [x0, y0]);
        correct.push(text);
      }
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (dx === 0 && dy === 0) continue;
          addPair(x0 + dx, y0 + dy, false);
        }
      }
    }

    for (let px = -3; px <= 6; px++) {
      for (let py = -3; py <= 6; py++) {
        addPair(px, py, check(px, py).ok);
      }
    }

    return makeRound({
      rng,
      heading,
      instruction: 'Munch every ordered pair that solves the system.',
      correct,
      incorrect,
      correctCount: dependent ? 9 : 8,
      explain: (text) => {
        const pair = values.get(text);
        if (pair === undefined) return `${text} is not an ordered pair.`;
        const [x, y] = pair;
        const info = check(x, y);
        if (info.ok) {
          return `${text}: the left sides are ${info.left} and the right sides are ${info.right}, so both equations hold.`;
        }
        return `${text}: the left sides are ${info.left}, but the right sides are ${info.right}; both equations must match.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 6. Polynomial Operations
// ---------------------------------------------------------------------------

interface PolyTarget {
  text: string;
  c1: number;
  c0: number;
  correct: string[];
}

const polyTargets: PolyTarget[] = [
  {
    text: 'x^2-9',
    c1: 0,
    c0: -9,
    correct: [
      'x^2-9',
      '-9+x^2',
      'x*x-9',
      'x^2-3^2',
      '(x-3)(x+3)',
      '(x+3)(x-3)',
      'x^2-10+1',
      'x^2+9-18',
      'x^2-4-5',
      'x^2-8-1',
      'x^2-7-2',
      'x^2-6-3',
    ],
  },
  {
    text: 'x^2-4',
    c1: 0,
    c0: -4,
    correct: [
      'x^2-4',
      '-4+x^2',
      'x*x-4',
      'x^2-2^2',
      '(x-2)(x+2)',
      '(x+2)(x-2)',
      'x^2-5+1',
      'x^2+4-8',
      'x^2-3-1',
      'x^2-2-2',
      'x^2+2-6',
    ],
  },
  {
    text: 'x^2-1',
    c1: 0,
    c0: -1,
    correct: [
      'x^2-1',
      '-1+x^2',
      'x*x-1',
      '(x-1)(x+1)',
      '(x+1)(x-1)',
      'x^2-2+1',
      'x^2+1-2',
      'x^2-3+2',
      'x^2-1+0',
      'x^2+3-4',
      'x^2-4+3',
    ],
  },
  {
    text: 'x^2+5x',
    c1: 5,
    c0: 0,
    correct: [
      'x^2+5x',
      '5x+x^2',
      'x*x+5x',
      'x(x+5)',
      '(x)(x+5)',
      'x^2+5*x',
      '5x+x*x',
      'x^2+4x+x',
      'x^2+6x-x',
      'x^2+5x+0',
      '5x+x^2+0',
    ],
  },
  {
    text: 'x^2+2x',
    c1: 2,
    c0: 0,
    correct: [
      'x^2+2x',
      '2x+x^2',
      'x*x+2x',
      'x(x+2)',
      '(x)(x+2)',
      'x^2+2*x',
      '2x+x*x',
      'x^2+x+x',
      'x^2+2x+0',
      '2x+x^2+0',
    ],
  },
  {
    text: 'x^2-6x',
    c1: -6,
    c0: 0,
    correct: [
      'x^2-6x',
      '-6x+x^2',
      'x*x-6x',
      'x(x-6)',
      '(x)(x-6)',
      'x^2-6*x',
      '-6x+x*x',
      'x^2-5x-x',
      'x^2-6x+0',
      '-6x+x^2+0',
    ],
  },
  {
    text: 'x^2+3x',
    c1: 3,
    c0: 0,
    correct: [
      'x^2+3x',
      '3x+x^2',
      'x*x+3x',
      'x(x+3)',
      '(x)(x+3)',
      'x^2+3*x',
      '3x+x*x',
      'x^2+x+2x',
      'x^2+4x-x',
      'x^2+3x+0',
      '3x+x^2+0',
    ],
  },
  {
    text: 'x^2-5x',
    c1: -5,
    c0: 0,
    correct: [
      'x^2-5x',
      '-5x+x^2',
      'x*x-5x',
      'x(x-5)',
      '(x)(x-5)',
      'x^2-5*x',
      '-5x+x*x',
      'x^2-4x-x',
      'x^2-5x+0',
      '-5x+x^2+0',
    ],
  },
  {
    text: 'x^2+x-6',
    c1: 1,
    c0: -6,
    correct: [
      'x^2+x-6',
      '-6+x^2+x',
      'x*x+x-6',
      '(x+3)(x-2)',
      '(x-2)(x+3)',
      'x^2-6+x',
      'x^2+x-2-4',
      'x^2+x-3-3',
      'x^2+x+1-7',
      'x^2+x-5-1',
      'x^2+x-4-2',
    ],
  },
];

const polynomials: Topic = {
  id: 'polynomials',
  name: 'Polynomials',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-11',
  blurb: 'Expand and rearrange; munch every expression with the same value.',
  round(rng: Rng, level: number) {
    const pool =
      level < 5 ? polyTargets.slice(0, 3) : level < 10 ? polyTargets.slice(0, 6) : polyTargets;
    const target = rng.pick(pool);
    const values = new Map<string, { ok: boolean; why: string }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    for (const text of target.correct) {
      if (text.length <= 9 && !values.has(text)) {
        values.set(text, { ok: true, why: `${text} simplifies to ${target.text}.` });
        correct.push(text);
      }
    }

    const addWrong = (text: string, why: string): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, { ok: false, why });
      incorrect.push(text);
    };

    for (const d of [-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const c1 = target.c1 + d;
      addWrong(
        quadExpr(1, c1, target.c0),
        `The x coefficient is ${c1}, not ${target.c1}; ${quadExpr(1, c1, target.c0)} is not ${target.text}.`,
      );
    }
    for (const d of [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]) {
      const c0 = target.c0 + d;
      addWrong(
        quadExpr(1, target.c1, c0),
        `The constant term is ${c0}, not ${target.c0}; ${quadExpr(1, target.c1, c0)} is not ${target.text}.`,
      );
    }
    if (target.c1 !== 0) {
      addWrong(
        quadExpr(1, -target.c1, target.c0),
        `Sign error on the x term: it should be ${target.c1}x, not ${-target.c1}x.`,
      );
    }
    if (target.c0 !== 0) {
      addWrong(
        quadExpr(1, target.c1, -target.c0),
        `Sign error on the constant: it should be ${target.c0}, not ${-target.c0}.`,
      );
    }
    addWrong(`-${quadExpr(1, target.c1, target.c0)}`, `The whole expression is negated, so it is not ${target.text}.`);
    addWrong(`x^3${target.c1 === 0 ? '' : target.c1 > 0 ? `+${target.c1}x` : `-${Math.abs(target.c1)}x`}`, `The degree is 3, not 2.`);

    for (const [a, b] of [[1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [1, 4], [2, 5], [3, 5]]) {
      if (a + b === target.c1 && a * b === target.c0) continue;
      const text = `(x+${a})(x+${b})`;
      if (text.length > 9) continue;
      addWrong(text, `${text} expands to x^2+${a + b}x+${a * b}, not ${target.text}.`);
    }
    for (const [a, b] of [[-1, 2], [-2, 3], [-3, 4], [-1, 5], [-2, 5], [-4, 3]]) {
      if (a + b === target.c1 && a * b === target.c0) continue;
      const aText = a > 0 ? `+${a}` : `${a}`;
      const text = `(x${aText})(x+${b})`;
      if (text.length > 9) continue;
      addWrong(text, `${text} expands to x^2+${a + b}x+${a * b}, not ${target.text}.`);
    }

    return makeRound({
      rng,
      heading: target.text,
      instruction: `Munch every expression equal to ${target.text}.`,
      correct,
      incorrect,
      correctCount: Math.min(9, correct.length),
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not equal to ${target.text}.`;
        if (info.ok) return `${text} is equivalent to ${target.text}, so it is a correct munch.`;
        return info.why.includes(text) ? info.why : `${text}: ${info.why}`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 7. Factoring
// ---------------------------------------------------------------------------

interface FactorTarget {
  text: string;
  c1: number;
  c0: number;
  roots: [number, number];
}

const factorTargets: FactorTarget[] = [
  { text: 'x^2+7x+12', c1: 7, c0: 12, roots: [-4, -3] },
  { text: 'x^2-5x+6', c1: -5, c0: 6, roots: [2, 3] },
  { text: 'x^2+x-6', c1: 1, c0: -6, roots: [-3, 2] },
  { text: 'x^2-9', c1: 0, c0: -9, roots: [3, -3] },
  { text: 'x^2+3x+2', c1: 3, c0: 2, roots: [-2, -1] },
  { text: 'x^2-4x-5', c1: -4, c0: -5, roots: [-1, 5] },
  { text: 'x^2-7x+12', c1: -7, c0: 12, roots: [3, 4] },
];

const binomialText = (k: number, root: number): string => {
  const constant = -k * root;
  if (k === 1) return constant === 0 ? 'x' : `x${constant > 0 ? '+' : '-'}${Math.abs(constant)}`;
  return `${k}x${constant > 0 ? '+' : '-'}${Math.abs(constant)}`;
};

const factoring: Topic = {
  id: 'factoring',
  name: 'Factoring',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-11',
  blurb: 'Match binomials to the roots of a quadratic.',
  round(rng: Rng, level: number) {
    const pool =
      level < 5 ? factorTargets.slice(0, 3) : level < 10 ? factorTargets.slice(0, 5) : factorTargets;
    const target = rng.pick(pool);
    const values = new Map<string, { ok: boolean; root: number; value: number }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const polyAt = (x: number): number => x * x + target.c1 * x + target.c0;

    for (const root of target.roots) {
      for (let k = 1; k <= 6; k++) {
        const text = binomialText(k, root);
        if (text.length > 9 || values.has(text)) continue;
        values.set(text, { ok: true, root, value: 0 });
        correct.push(text);
      }
    }

    const wrongRoots = [-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8].filter(
      (r) => !target.roots.includes(r),
    );
    const addWrong = (text: string, root: number): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, { ok: false, root, value: polyAt(root) });
      incorrect.push(text);
    };
    for (const root of wrongRoots) {
      for (let k = 1; k <= 4; k++) addWrong(binomialText(k, root), root);
    }

    return makeRound({
      rng,
      heading: `Factors of ${target.text}`,
      instruction: `Munch every binomial with a root of ${target.text}.`,
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not a binomial factor of ${target.text}.`;
        if (info.ok) {
          return `${text} has root x=${info.root}; substituting gives 0, so it is a factor of ${target.text} up to a constant multiple.`;
        }
        return `${text} has root x=${info.root}; substituting gives ${info.value}, not 0, so it is not a factor.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 8. Quadratic Roots
// ---------------------------------------------------------------------------

interface QuadTarget {
  text: string;
  c1: number;
  c0: number;
  roots: [number, number] | null;
  discriminant: number;
}

const quadTargets: QuadTarget[] = [
  { text: 'x^2-5x+6', c1: -5, c0: 6, roots: [2, 3], discriminant: 1 },
  { text: 'x^2+x-6', c1: 1, c0: -6, roots: [-3, 2], discriminant: 25 },
  { text: 'x^2-9', c1: 0, c0: -9, roots: [3, -3], discriminant: 36 },
  { text: 'x^2-4x-5', c1: -4, c0: -5, roots: [5, -1], discriminant: 36 },
  { text: 'x^2+2x-8', c1: 2, c0: -8, roots: [2, -4], discriminant: 36 },
  { text: 'x^2-7x+12', c1: -7, c0: 12, roots: [3, 4], discriminant: 1 },
  { text: 'x^2+x+1', c1: 1, c0: 1, roots: null, discriminant: -3 },
  { text: 'x^2+2x+5', c1: 2, c0: 5, roots: null, discriminant: -16 },
  { text: 'x^2-2x+3', c1: -2, c0: 3, roots: null, discriminant: -8 },
  { text: 'x^2+4', c1: 0, c0: 4, roots: null, discriminant: -16 },
];

const quadratics: Topic = {
  id: 'quadratics',
  name: 'Quadratics',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-12',
  blurb: 'Find roots, and read the discriminant when there are none.',
  round(rng: Rng, level: number) {
    const realTargets = quadTargets.filter((t) => t.roots !== null);
    const pool = level < 8 ? realTargets : quadTargets;
    const target = rng.pick(pool);
    const values = new Map<string, { kind: 'value' | 'sign'; value: number; ok: boolean }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const add = (text: string, kind: 'value' | 'sign', value: number, ok: boolean): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, { kind, value, ok });
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    if (target.roots !== null) {
      for (const root of target.roots) {
        for (const form of valueForms(root).slice(0, 5)) add(form, 'value', root, true);
      }
      add('undef', 'sign', 0, false);
      add('D<0', 'sign', 0, false);
      for (const v of [-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        if (target.roots.includes(v)) continue;
        add(String(v), 'value', v, false);
        if (v > 0) add(`${v * 2}/2`, 'value', v, false);
      }
      add(String(-target.c1), 'value', -target.c1, false);
      add(String(target.c0), 'value', target.c0, false);
    } else {
      const signs = ['D<0', 'disc<0', 'neg', 'negative', 'b^2-4ac<0', 'noroots', 'noreal', `D=${target.discriminant}`];
      for (const text of signs) add(text, 'sign', target.discriminant, true);
      for (const form of valueForms(target.discriminant).slice(0, 4)) add(form, 'value', target.discriminant, true);
      for (const text of ['D>0', 'D=0', 'pos', 'positive', 'tworoots', 'b^2>4ac', '0', '1', '2', '3', '4', '5', '6', '8', '16', '25', '100', 'D=4', 'D=9', 'D=16', 'real']) {
        add(text, 'sign', target.discriminant, false);
      }
    }

    return makeRound({
      rng,
      heading: `Roots of ${target.text}`,
      instruction:
        target.roots === null
          ? 'No real roots. Munch every tile showing a negative discriminant.'
          : 'Munch every tile equal to a root.',
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not one of the offered answers.`;
        if (target.roots === null) {
          if (info.ok) {
            if (info.kind === 'value') return `${text} = ${target.discriminant}, and b^2-4ac < 0, so there are no real roots.`;
            return `${text} says the discriminant is negative, which is true: b^2-4ac = ${target.discriminant}.`;
          }
          return `${text} does not show a negative discriminant; for ${target.text}, b^2-4ac = ${target.discriminant} < 0.`;
        }
        if (info.ok) {
          return `${text} = ${info.value}; substituting gives (${info.value})^2 ${signed(target.c1)}(${info.value}) ${signed(target.c0)} = 0.`;
        }
        return `${text} = ${info.value}; substituting gives (${info.value})^2 ${signed(target.c1)}(${info.value}) ${signed(target.c0)} = ${
          info.value * info.value + target.c1 * info.value + target.c0
        }, not 0.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 9. Exponent Rules
// ---------------------------------------------------------------------------

const xpow = (e: number): string => (e === 1 ? 'x' : `x^${e}`);

const exponentRules: Topic = {
  id: 'exponent-rules',
  name: 'Exponent Rules',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-11',
  blurb: 'Use product, power and quotient rules to match a single power.',
  round(rng: Rng, level: number) {
    const n =
      level < 5
        ? rng.pick([3, 4, 5] as const)
        : level < 10
          ? rng.pick([4, 5, 6] as const)
          : rng.pick([5, 6, 7, 8] as const);
    const values = new Map<string, { ok: boolean; why: string }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const add = (text: string, exp: number | null, why: string): void => {
      if (text.length > 9 || values.has(text)) return;
      const ok = exp === n;
      values.set(text, { ok, why });
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    add(xpow(n), n, `${xpow(n)} is the target power.`);
    for (let a = 1; a < n; a++) {
      const b = n - a;
      add(`${xpow(a)}*${xpow(b)}`, n, `${xpow(a)}*${xpow(b)} = x^${n} by adding exponents.`);
      if (a !== b) add(`${xpow(b)}*${xpow(a)}`, n, `${xpow(b)}*${xpow(a)} = x^${n} by adding exponents.`);
    }
    for (const a of [2, 3, 4]) {
      if (n % a !== 0) continue;
      const b = n / a;
      if (b >= 2) add(`(x^${a})^${b}`, n, `(x^${a})^${b} = x^${n} by multiplying exponents.`);
    }
    for (let k = 1; k <= 4; k++) {
      add(`x^${n + k}/${xpow(k)}`, n, `x^${n + k}/${xpow(k)} = x^${n} by subtracting exponents.`);
    }
    add(`${xpow(n)}*1`, n, 'Multiplying by 1 does not change the power.');
    add(`1*${xpow(n)}`, n, 'Multiplying by 1 does not change the power.');
    add(`${xpow(n)}+0`, n, 'Adding 0 does not change the power.');

    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const e = a + b;
        if (e === n) continue;
        add(`${xpow(a)}*${xpow(b)}`, e, `${xpow(a)}*${xpow(b)} = x^${e}, not x^${n}.`);
      }
    }
    for (let a = 1; a <= 3; a++) {
      for (let b = 1; b <= 3; b++) {
        const e = a * b;
        if (e === n) continue;
        add(`(x^${a})^${b}`, e, `(x^${a})^${b} = x^${e}, not x^${n}.`);
      }
    }
    for (let k = 1; k <= 4; k++) {
      for (let j = 1; j <= 5; j++) {
        const e = n + k - j;
        if (e === n || e < 0) continue;
        add(`x^${n + k}/${xpow(j)}`, e, `x^${n + k}/${xpow(j)} = x^${e}, not x^${n}.`);
      }
    }
    add(`2${xpow(n)}`, null, `2${xpow(n)} is twice x^${n}, not x^${n}.`);
    add(`${xpow(n)}/2`, null, `${xpow(n)}/2 is half of x^${n}, not x^${n}.`);
    add(`${xpow(n)}+1`, null, `${xpow(n)}+1 is x^${n} plus 1, not x^${n}.`);
    add(`${n}x`, null, `${n}x has coefficient ${n}, not exponent ${n}.`);
    add(`x^${n - 1}+x^${n - 1}`, null, `Adding equal powers doubles the coefficient; the result is 2x^${n - 1}, not x^${n}.`);
    add(`${xpow(n)}/x`, null, `Dividing by x gives x^${n - 1}, not x^${n}.`);
    add(`x^${n + 1}`, n + 1, `x^${n + 1} has exponent ${n + 1}, not ${n}.`);

    return makeRound({
      rng,
      heading: xpow(n),
      instruction: `Munch every expression equal to ${xpow(n)}.`,
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not equal to ${xpow(n)}.`;
        return `${text}: ${info.why}`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 10. Function Values
// ---------------------------------------------------------------------------

const functions: Topic = {
  id: 'functions',
  name: 'Function Values',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-11',
  blurb: 'Evaluate linear, quadratic and absolute-value functions.',
  round(rng: Rng, level: number) {
    const kind = rng.pick(['linear', 'linear', 'quad', 'abs'] as const);
    let expr: string;
    let k: number;
    let target: number;
    let correctExtra: string[];
    let a = 1;
    let b = 0;
    let c = 0;

    if (kind === 'linear') {
      a = rng.int(2, Math.min(8, 2 + Math.floor(level / 4)));
      b = rng.int(-8, 8);
      k = rng.int(-5, 7);
      const bText = b === 0 ? '' : b > 0 ? `+${b}` : `${b}`;
      expr = `${a}x${bText}`;
      target = a * k + b;
      correctExtra = [`${a}*${k}${bText}`, `${a * k}${bText}`, `${target - 1}+1`];
    } else if (kind === 'quad') {
      b = rng.int(-5, 5);
      c = rng.int(-8, 8);
      k = rng.int(-4, 5);
      const bMag = Math.abs(b);
      const bText = b === 0 ? '' : b > 0 ? `+${bMag === 1 ? '' : bMag}x` : `-${bMag === 1 ? '' : bMag}x`;
      const cText = c === 0 ? '' : c > 0 ? `+${c}` : `${c}`;
      expr = `x^2${bText}${cText}`;
      target = k * k + b * k + c;
      correctExtra = [
        `${k * k}${signed(b * k)}${signed(c)}`,
        `${k * k + b * k}${signed(c)}`,
        `${target - 1}+1`,
      ];
    } else {
      c = rng.int(-5, 5);
      k = rng.int(-6, 6);
      const cText = c === 0 ? '' : c > 0 ? `-${c}` : `+${-c}`;
      expr = `abs(x${cText})`;
      target = Math.abs(k - c);
      correctExtra = [`abs(${k}${cText})`, `${target - 1}+1`, `${target + 1}-1`];
    }

    const values = new Map<string, number>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const add = (text: string, value: number, ok: boolean): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, value);
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    for (const form of valueForms(target).slice(0, 7)) add(form, target, true);
    for (const text of correctExtra) add(text, target, true);
    add(`${target + 2}-2`, target, true);
    add(`${target - 2}+2`, target, true);

    const addWrong = (text: string, value: number): void => {
      if (value === target) return;
      add(text, value, false);
    };

    if (kind === 'linear') {
      addWrong(`${a * k}`, a * k);
      addWrong(`${k + b}`, k + b);
      addWrong(`${a}*${k + 1}`, a * (k + 1));
      addWrong(`${a}*${k - 1}`, a * (k - 1));
      addWrong(`${a * k - b}`, a * k - b);
      addWrong(`${a + 1}x`, (a + 1) * k);
      addWrong(`${a}x`, a * k);
      addWrong(`${a * (k + 1) + b}`, a * (k + 1) + b);
    } else if (kind === 'quad') {
      addWrong(`${k * k}`, k * k);
      addWrong(`${2 * k}`, 2 * k);
      addWrong(`${k * k + 1}`, k * k + 1);
      addWrong(`${k * k - 1}`, k * k - 1);
      addWrong(`${(k + 1) * (k + 1)}`, (k + 1) * (k + 1));
      addWrong(`${(k - 1) * (k - 1)}`, (k - 1) * (k - 1));
      addWrong(`${k * k + b * k}`, k * k + b * k);
      addWrong(`${k * k + c}`, k * k + c);
    } else {
      addWrong(`abs(${k})`, Math.abs(k));
      addWrong(`${k}`, k);
      addWrong(`${-target}`, -target);
      addWrong(`abs(${k + 1})`, Math.abs(k + 1));
      addWrong(`abs(${k - 1})`, Math.abs(k - 1));
      addWrong(`abs(${k})${c === 0 ? '' : c > 0 ? `-${c}` : `+${-c}`}`, Math.abs(k) - c);
    }

    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10]) {
      addWrong(String(target + d), target + d);
    }
    addWrong(String(target * 2), target * 2);
    addWrong(String(-target), -target);
    addWrong(`${target + 3}-3`, target);
    addWrong(`${target - 3}+3`, target);

    return makeRound({
      rng,
      heading: `f(x)=${expr}, x=${k}`,
      instruction: `Munch every tile equal to f(${k}).`,
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const v = values.get(text);
        if (v === undefined) return `${text} is not equal to f(${k}).`;
        if (v === target) return `${text} = ${target}, and f(${k}) = ${target}.`;
        return `${text} = ${fmt(v)}, but f(${k}) = ${target}.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 11. Sequences
// ---------------------------------------------------------------------------

const sequences: Topic = {
  id: 'sequences',
  name: 'Sequences',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-12',
  blurb: 'Decide which numbers are terms of the arithmetic or geometric sequence.',
  round(rng: Rng, level: number) {
    const geometric = rng.chance(0.4);
    const a = geometric ? rng.int(1, 4) : rng.int(1, Math.min(12, 3 + Math.floor(level / 2)));
    const d = geometric ? 0 : rng.int(2, Math.min(9, 3 + Math.floor(level / 3)));
    const r = geometric ? rng.int(2, Math.min(4, 2 + Math.floor(level / 6))) : 1;
    const term = (k: number): number => (geometric ? a * r ** k : a + k * d);
    const isMember = (v: number): boolean => {
      if (geometric) {
        if (v <= 0 || v % a !== 0) return false;
        let t = v / a;
        while (t % r === 0) t /= r;
        return t === 1;
      }
      const k = (v - a) / d;
      return Number.isInteger(k) && k >= 0;
    };

    const headingTerms: string[] = [];
    for (let k = 0; k < 4; k++) headingTerms.push(String(term(k)));
    const heading = `${headingTerms.join(',')},...`;

    const values = new Map<string, { ok: boolean; k: number }>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const add = (text: string, k: number, ok: boolean): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, { ok, k });
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    for (let k = 0; k < 16; k++) {
      const v = term(k);
      if (String(v).length <= 9) add(String(v), k, true);
    }

    for (let k = 0; k < 16; k++) {
      const v = term(k);
      for (const delta of [1, -1, 2, -2, 3, -3, 4, -4, 5]) {
        const w = v + delta;
        if (!isMember(w)) add(String(w), -1, false);
      }
      if (!geometric) {
        for (const delta of [1, 2, 3, 4]) {
          if (!isMember(a - delta)) add(String(a - delta), -1, false);
        }
      }
    }
    if (geometric) {
      for (let k = 0; k < 10; k++) {
        for (const delta of [1, -1]) {
          const w = (a + delta) * r ** k;
          if (w > 0 && !isMember(w)) add(String(w), -1, false);
        }
      }
    }

    const rule =
      geometric
        ? `Each term is ${r} times the one before, starting at ${a}.`
        : `Each term grows by ${d}, starting at ${a}.`;

    return makeRound({
      rng,
      heading,
      instruction: 'Munch every number that belongs to the sequence.',
      correct,
      incorrect,
      correctCount: 10,
      explain: (text) => {
        const info = values.get(text);
        if (info === undefined) return `${text} is not a term of this sequence.`;
        if (info.ok) {
          return geometric
            ? `${text} = ${a} x ${r}^${info.k}, so it is term ${info.k + 1}. ${rule}`
            : `${text} = ${a} + ${info.k} x ${d}, so it is term ${info.k + 1}. ${rule}`;
        }
        return geometric
          ? `${text} is not ${a} times a whole power of ${r}, so it is not in the sequence.`
          : `(${text} - ${a}) / ${d} is not a whole number, so ${text} is not in the sequence.`;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// 12. Logarithms
// ---------------------------------------------------------------------------

interface LogCase {
  heading: string;
  value: number;
  hard: boolean;
}

const logCases: LogCase[] = [
  { heading: 'log2(32)', value: 5, hard: false },
  { heading: 'log2(64)', value: 6, hard: true },
  { heading: 'log2(16)', value: 4, hard: false },
  { heading: 'log(1000)', value: 3, hard: false },
  { heading: 'log(10000)', value: 4, hard: true },
  { heading: 'ln(e^2)', value: 2, hard: false },
  { heading: 'ln(e^3)', value: 3, hard: false },
  { heading: 'ln(e^4)', value: 4, hard: true },
  { heading: 'log2(1/8)', value: -3, hard: true },
  { heading: 'log2(1/4)', value: -2, hard: true },
  { heading: 'log(0.01)', value: -2, hard: true },
  { heading: 'log2(1)', value: 0, hard: false },
];

const logs: Topic = {
  id: 'logs',
  name: 'Logs',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 10-12',
  blurb: 'Convert between logs and powers, including negatives and zero.',
  round(rng: Rng, level: number) {
    const pool = level < 6 ? logCases.filter((c) => !c.hard) : logCases;
    const target = rng.pick(pool);
    const values = new Map<string, number>();
    const correct: string[] = [];
    const incorrect: string[] = [];

    const add = (text: string, value: number, ok: boolean): void => {
      if (text.length > 9 || values.has(text)) return;
      values.set(text, value);
      if (ok) correct.push(text);
      else incorrect.push(text);
    };

    add(target.heading, target.value, true);
    for (const form of valueForms(target.value).slice(0, 8)) add(form, target.value, true);
    if (target.value >= 0 && target.value <= 6) add(`log2(${2 ** target.value})`, target.value, true);
    if (target.value >= 1 && target.value <= 4) add(`log(${10 ** target.value})`, target.value, true);
    if (target.value >= 0 && target.value <= 5) add(`ln(e^${target.value})`, target.value, true);

    const addWrong = (text: string, value: number): void => {
      if (value !== target.value) add(text, value, false);
    };

    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, -1, -2, -3, -4]) {
      addWrong(String(target.value + d), target.value + d);
    }
    for (let w = 0; w <= 6; w++) {
      if (w === target.value) continue;
      addWrong(`log2(${2 ** w})`, w);
    }
    for (let w = -3; w <= 4; w++) {
      if (w === target.value) continue;
      addWrong(`log(${round3(10 ** w)})`, w);
    }
    for (let w = 0; w <= 5; w++) {
      if (w === target.value) continue;
      addWrong(`ln(e^${w})`, w);
    }
    addWrong(`2^${target.value}`, 2 ** target.value);
    addWrong(`${target.value}^2`, target.value ** 2);

    return makeRound({
      rng,
      heading: target.heading,
      instruction: `Munch every expression equal to ${target.value}.`,
      correct,
      incorrect,
      correctCount: 9,
      explain: (text) => {
        const v = values.get(text);
        if (v === undefined) return `${text} is not equal to ${target.value}.`;
        if (v === target.value) return `${text} = ${target.value}, so it matches ${target.heading}.`;
        return `${text} = ${v}, not ${target.value}.`;
      },
    });
  },
};

export const algebraTopics: Topic[] = [
  evaluateExpressions,
  solveLinear,
  linearInequalities,
  slope,
  systems,
  polynomials,
  factoring,
  quadratics,
  exponentRules,
  functions,
  sequences,
  logs,
];
