import { makeRound } from '../build';
import type { PlotFamily, PlotSpec, Rng, Topic } from '../types';

/**
 * Graph-reading topics. Every tile is a small plot; the muncher has to
 * recognise the function family or a graph feature from the picture alone.
 */

const FAMILY_LABELS: Record<PlotFamily, string> = {
  linear: 'linear',
  quadratic: 'quadratic',
  cubic: 'cubic',
  exponential: 'exponential',
  logarithmic: 'logarithmic',
  reciprocal: 'reciprocal',
  sqrt: 'square root',
  absolute: 'absolute value',
  sine: 'sine',
};

const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const FAMILY_HINTS: Record<PlotFamily, string> = {
  linear: 'a straight line',
  quadratic: 'a U-shaped parabola',
  cubic: 'an S-shaped curve with no turning points',
  exponential: 'a curve that grows by a constant factor',
  logarithmic: 'a curve that rises quickly then flattens',
  reciprocal: 'two branches that never touch the axes',
  sqrt: 'a curve that starts flat and rises slowly',
  absolute: 'a V shape',
  sine: 'a repeating wave',
};

const CORE_FAMILIES: PlotFamily[] = [
  'linear',
  'quadratic',
  'cubic',
  'exponential',
  'logarithmic',
  'reciprocal',
  'sqrt',
  'absolute',
];

interface PlotResult {
  spec: PlotSpec;
  label: string;
}

/** Pick a family and generate a plot of it with randomised but faithful shape. */
function makePlot(family: PlotFamily, rng: Rng, level: number): PlotResult {
  const spread = 1 + Math.min(2, level / 8);
  switch (family) {
    case 'linear': {
      const m = rng.pick([1, -1, 0.5, 2]) * (rng.chance(0.5) ? 1 : 1);
      const b = rng.int(-2, 2);
      return {
        label: FAMILY_LABELS.linear,
        spec: {
          kind: 'plot',
          family,
          f: (x) => m * x + b,
          xRange: [-4, 4],
          yRange: [-4, 4],
        },
      };
    }
    case 'quadratic': {
      const a = (rng.chance(0.25) ? -1 : 1) * (0.8 + rng.next() * 0.5);
      const h = rng.int(-1, 1);
      const k = rng.int(-2, 1);
      return {
        label: FAMILY_LABELS.quadratic,
        spec: {
          kind: 'plot',
          family,
          f: (x) => a * (x - h) ** 2 + k,
          xRange: [-3.5, 3.5],
          yRange: [-3, 7],
        },
      };
    }
    case 'cubic': {
      const a = rng.pick([1, -1, 2]) / 8;
      return {
        label: FAMILY_LABELS.cubic,
        spec: {
          kind: 'plot',
          family,
          f: (x) => a * x ** 3,
          xRange: [-3, 3],
          yRange: [-4, 4],
        },
      };
    }
    case 'exponential': {
      const a = rng.pick([0.5, 1, 2]);
      const b = rng.pick([1.5, 2, 3]);
      return {
        label: FAMILY_LABELS.exponential,
        spec: {
          kind: 'plot',
          family,
          f: (x) => a * b ** x,
          xRange: [-3, 2.4 * spread * 0.5],
          yRange: [-1, 9],
        },
      };
    }
    case 'logarithmic': {
      const b = rng.pick([2, 3, 10]);
      const c = rng.int(-1, 1);
      return {
        label: FAMILY_LABELS.logarithmic,
        spec: {
          kind: 'plot',
          family,
          f: (x) => (x > 0 ? Math.log(x) / Math.log(b) + c : null),
          xRange: [-1, 8],
          yRange: [-3, 3],
        },
      };
    }
    case 'reciprocal': {
      const a = rng.pick([1, -1, 2]);
      return {
        label: FAMILY_LABELS.reciprocal,
        spec: {
          kind: 'plot',
          family,
          f: (x) => (Math.abs(x) < 1e-6 ? null : a / x),
          xRange: [-4, 4],
          yRange: [-4, 4],
        },
      };
    }
    case 'sqrt': {
      const h = rng.int(0, 2);
      const a = rng.pick([1, 1.5]);
      return {
        label: FAMILY_LABELS.sqrt,
        spec: {
          kind: 'plot',
          family,
          f: (x) => (x >= h ? a * Math.sqrt(x - h) : null),
          xRange: [-1, 9],
          yRange: [-1, 4],
        },
      };
    }
    case 'absolute': {
      const a = rng.pick([1, 2]);
      const h = rng.int(-1, 1);
      const k = rng.int(-1, 2);
      return {
        label: FAMILY_LABELS.absolute,
        spec: {
          kind: 'plot',
          family,
          f: (x) => a * Math.abs(x - h) + k,
          xRange: [-4, 4],
          yRange: [-2, 6],
        },
      };
    }
    case 'sine': {
      const a = rng.pick([1, 1.5]);
      return {
        label: FAMILY_LABELS.sine,
        spec: {
          kind: 'plot',
          family,
          f: (x) => a * Math.sin(x),
          xRange: [-Math.PI * 2, Math.PI * 2],
          yRange: [-2, 2],
        },
      };
    }
    default:
      throw new Error(`unknown family ${family}`);
  }
}

export interface GraphFeatures {
  increasing: boolean;
  minimum: boolean;
  maximum: boolean;
  nonnegative: boolean;
}

/** Sample a plot and describe it. Shared by the generator (see tests). */
export function featuresOf(spec: PlotSpec): GraphFeatures {
  const [xMin, xMax] = spec.xRange;
  const steps = 160;
  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    const y = spec.f(x);
    ys.push(y === null || !Number.isFinite(y) ? Number.NaN : y);
  }

  const valid = ys.map((y, i) => ({ y, i })).filter((p) => Number.isFinite(p.y));
  if (valid.length < 8) {
    return { increasing: false, minimum: false, maximum: false, nonnegative: false };
  }

  let increasing = true;
  for (let i = 1; i < valid.length; i++) {
    if (valid[i]!.y < valid[i - 1]!.y - 1e-9) {
      increasing = false;
      break;
    }
  }

  const minimum = valid.some((point, index) => {
    if (index === 0 || index === valid.length - 1) return false;
    return (
      point.y < valid[index - 1]!.y - 1e-9 && point.y < valid[index + 1]!.y - 1e-9
    );
  });

  const maximum = valid.some((point, index) => {
    if (index === 0 || index === valid.length - 1) return false;
    return (
      point.y > valid[index - 1]!.y + 1e-9 && point.y > valid[index + 1]!.y + 1e-9
    );
  });

  const nonnegative = valid.every((point) => point.y >= -1e-9);

  return { increasing, minimum, maximum, nonnegative };
}

interface GeneratedTile {
  id: string;
  spec: PlotSpec;
  family: PlotFamily;
  features: GraphFeatures;
}

function buildPool(rng: Rng, level: number, count: number, families: PlotFamily[]): GeneratedTile[] {
  const pool: GeneratedTile[] = [];
  for (let i = 0; i < count; i++) {
    const family = families[i % families.length]!;
    const { spec } = makePlot(family, rng, level);
    pool.push({ id: `g${i}`, spec, family, features: featuresOf(spec) });
  }
  return pool;
}

const functionFamilies: Topic = {
  id: 'function-families',
  name: 'Function Families',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-12',
  blurb: 'Identify linear, quadratic, exponential and other curves from their graph.',
  round(rng: Rng, level: number) {
    const unlocked = level >= 8 ? [...CORE_FAMILIES, 'sine' as PlotFamily] : CORE_FAMILIES;
    const target = rng.pick(unlocked);
    const pool = buildPool(rng, level, 90, unlocked);

    const matching = pool.filter((t) => t.family === target);
    // Guarantee enough correct tiles even for a rare family.
    let extra = 0;
    while (matching.length < 12 && extra < 40) {
      const plot = makePlot(target, rng, level);
      matching.push({
        id: `x${extra}`,
        spec: plot.spec,
        family: target,
        features: featuresOf(plot.spec),
      });
      extra++;
    }
    const other = pool.filter((t) => t.family !== target);

    const explainMap = new Map<string, GeneratedTile>();
    const visuals: Record<string, PlotSpec> = {};
    for (const tile of [...matching, ...other]) {
      explainMap.set(tile.id, tile);
      visuals[tile.id] = tile.spec;
    }

    return makeRound({
      rng,
      heading: 'Function Families',
      instruction: `Munch every graph of ${article(FAMILY_LABELS[target])} ${FAMILY_LABELS[target]} function.`,
      correct: matching.map((t) => t.id),
      incorrect: other.map((t) => t.id),
      correctCount: 9,
      visuals,
      explain: (text) => {
        const tile = explainMap.get(text);
        if (!tile) return 'That graph does not match.';
        return `This is ${FAMILY_HINTS[tile.family]} - ${article(FAMILY_LABELS[tile.family])} ${FAMILY_LABELS[tile.family]} function, not ${FAMILY_LABELS[target]}.`;
      },
    });
  },
};

const graphFeatures: Topic = {
  id: 'graph-features',
  name: 'Graph Features',
  family: 'algebra',
  band: 'high',
  grades: 'Grades 9-12',
  blurb: 'Read shape, direction, and turning points instead of formulas.',
  round(rng: Rng, level: number) {
    const prompts = [
      {
        heading: 'Always Increasing',
        instruction: 'Munch every graph that is always increasing.',
        test: (f: GraphFeatures) => f.increasing,
        why: 'This graph does not rise across its whole domain.',
      },
      {
        heading: 'Turning Points',
        instruction: 'Munch every graph with a lowest turning point.',
        test: (f: GraphFeatures) => f.minimum,
        why: 'This graph has no lowest turning point.',
      },
      {
        heading: 'Maximum Point',
        instruction: 'Munch every graph with a highest turning point.',
        test: (f: GraphFeatures) => f.maximum,
        why: 'This graph has no highest turning point.',
      },
      {
        heading: 'Never Negative',
        instruction: 'Munch every graph that never goes below the x-axis.',
        test: (f: GraphFeatures) => f.nonnegative,
        why: 'This graph dips below the x-axis.',
      },
    ];
    const prompt = rng.pick(prompts);
    const families = level >= 10 ? [...CORE_FAMILIES, 'sine' as PlotFamily] : CORE_FAMILIES;
    const pool = buildPool(rng, level, 120, families);
    const matching = pool.filter((t) => prompt.test(t.features));
    const other = pool.filter((t) => !prompt.test(t.features));

    const explainMap = new Map<string, GeneratedTile>();
    const visuals: Record<string, PlotSpec> = {};
    for (const tile of pool) {
      explainMap.set(tile.id, tile);
      visuals[tile.id] = tile.spec;
    }

    return makeRound({
      rng,
      heading: prompt.heading,
      instruction: prompt.instruction,
      correct: matching.map((t) => t.id),
      incorrect: other.map((t) => t.id),
      correctCount: 9,
      visuals,
      explain: (text) => {
        const tile = explainMap.get(text);
        if (!tile) return 'That graph does not match.';
        return `${prompt.why} It is a ${FAMILY_LABELS[tile.family]} graph.`;
      },
    });
  },
};

export const graphTopics: Topic[] = [functionFamilies, graphFeatures];
