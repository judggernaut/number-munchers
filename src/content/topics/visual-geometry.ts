import { makeRound } from '../build';
import type { Rng, ShapeName, ShapeSpec, TileVisual, Topic } from '../types';

/**
 * Visual geometry: the board shows figures instead of numbers. Tiles carry a
 * `visual` and a hidden stable id, so scoring and explanations work exactly
 * like text tiles.
 */

interface ShapeFact {
  shape: ShapeName;
  dimension: 2 | 3;
  label: string;
  curved: boolean;
  pointy: boolean;
  parallelBases: boolean;
}

const SHAPES: ShapeFact[] = [
  { shape: 'circle', dimension: 2, label: 'circle', curved: true, pointy: false, parallelBases: false },
  { shape: 'square', dimension: 2, label: 'square', curved: false, pointy: false, parallelBases: true },
  { shape: 'rectangle', dimension: 2, label: 'rectangle', curved: false, pointy: false, parallelBases: true },
  { shape: 'triangle', dimension: 2, label: 'triangle', curved: false, pointy: true, parallelBases: false },
  { shape: 'right-triangle', dimension: 2, label: 'right triangle', curved: false, pointy: true, parallelBases: false },
  { shape: 'pentagon', dimension: 2, label: 'pentagon', curved: false, pointy: false, parallelBases: false },
  { shape: 'hexagon', dimension: 2, label: 'hexagon', curved: false, pointy: false, parallelBases: false },
  { shape: 'trapezoid', dimension: 2, label: 'trapezoid', curved: false, pointy: false, parallelBases: true },
  { shape: 'parallelogram', dimension: 2, label: 'parallelogram', curved: false, pointy: false, parallelBases: true },
  { shape: 'cube', dimension: 3, label: 'cube', curved: false, pointy: false, parallelBases: true },
  { shape: 'prism', dimension: 3, label: 'rectangular prism', curved: false, pointy: false, parallelBases: true },
  { shape: 'triangular-prism', dimension: 3, label: 'triangular prism', curved: false, pointy: false, parallelBases: true },
  { shape: 'pyramid', dimension: 3, label: 'pyramid', curved: false, pointy: true, parallelBases: false },
  { shape: 'cylinder', dimension: 3, label: 'cylinder', curved: true, pointy: false, parallelBases: true },
  { shape: 'cone', dimension: 3, label: 'cone', curved: true, pointy: true, parallelBases: false },
  { shape: 'sphere', dimension: 3, label: 'sphere', curved: true, pointy: false, parallelBases: false },
];

const byDimension = (d: 2 | 3): ShapeFact[] => SHAPES.filter((s) => s.dimension === d);

interface ShapeTile {
  id: string;
  spec: ShapeSpec;
  fact: ShapeFact;
}

/**
 * Build at least `minCount` tiles from the given shapes, cycling through them
 * so a pool can never starve the board builder.
 */
function shapePool(facts: ShapeFact[], minCount: number, prefix: string): ShapeTile[] {
  if (facts.length === 0) throw new Error(`shapePool(${prefix}): no shapes`);
  const out: ShapeTile[] = [];
  let copy = 0;
  while (out.length < minCount && copy < 64) {
    for (const fact of facts) {
      if (out.length >= minCount) break;
      out.push({
        id: `${prefix}-${fact.shape}-${copy}`,
        spec: { kind: 'shape', shape: fact.shape, dimension: fact.dimension },
        fact,
      });
    }
    copy++;
  }
  return out;
}

const visualsOf = (tiles: ShapeTile[]): Record<string, TileVisual> => {
  const map: Record<string, TileVisual> = {};
  for (const tile of tiles) map[tile.id] = tile.spec;
  return map;
};

const solidOrFlat: Topic = {
  id: 'solid-or-flat',
  name: 'Solids & Flats',
  family: 'geometry',
  band: 'elementary',
  grades: 'Grades 3-6',
  blurb: 'Tell 3D solids apart from flat 2D figures at a glance.',
  round(rng: Rng) {
    const wantSolid = rng.chance(0.5);
    const want: 2 | 3 = wantSolid ? 3 : 2;
    const matching = shapePool(byDimension(want), 12, 'ok');
    const other = shapePool(byDimension(want === 3 ? 2 : 3), 22, 'no');
    const explainMap = new Map<string, ShapeTile>();
    for (const tile of [...matching, ...other]) explainMap.set(tile.id, tile);

    return makeRound({
      rng,
      heading: wantSolid ? '3D Solids' : 'Flat Shapes',
      instruction: `Munch every ${wantSolid ? '3D solid' : 'flat 2D shape'}.`,
      correct: matching.map((t) => t.id),
      incorrect: other.map((t) => t.id),
      correctCount: 10,
      visuals: visualsOf([...matching, ...other]),
      explain: (text) => {
        const tile = explainMap.get(text);
        if (!tile) return 'That shape does not belong here.';
        const kind = tile.fact.dimension === 3 ? 'a 3D solid' : 'a flat 2D shape';
        return `A ${tile.fact.label} is ${kind}.`;
      },
    });
  },
};

const solidAttributes: Topic = {
  id: 'solid-attributes',
  name: 'Solid Clues',
  family: 'geometry',
  band: 'middle',
  grades: 'Grades 5-8',
  blurb: 'Curved surfaces, parallel bases, and solids that come to a point.',
  round(rng: Rng) {
    const solids = byDimension(3);
    const prompts = [
      {
        heading: 'Curved Surfaces',
        instruction: 'Munch every solid with a curved surface.',
        test: (s: ShapeFact) => s.curved,
      },
      {
        heading: 'All Flat Faces',
        instruction: 'Munch every solid with only flat faces.',
        test: (s: ShapeFact) => !s.curved,
      },
      {
        heading: 'Comes To A Point',
        instruction: 'Munch every solid that comes to a point.',
        test: (s: ShapeFact) => s.pointy,
      },
      {
        heading: 'Parallel Bases',
        instruction: 'Munch every solid with two parallel bases.',
        test: (s: ShapeFact) => s.parallelBases,
      },
    ];
    const prompt = rng.pick(prompts);
    const matching = shapePool(solids.filter(prompt.test), 12, 's');
    const other = shapePool(solids.filter((s) => !prompt.test(s)), 22, 'n');

    const explainMap = new Map<string, ShapeTile>();
    for (const tile of [...matching, ...other]) explainMap.set(tile.id, tile);

    return makeRound({
      rng,
      heading: prompt.heading,
      instruction: prompt.instruction,
      correct: matching.map((t) => t.id),
      incorrect: other.map((t) => t.id),
      correctCount: 9,
      visuals: visualsOf([...matching, ...other]),
      explain: (text) => {
        const tile = explainMap.get(text);
        if (!tile) return 'That solid does not match.';
        return `A ${tile.fact.label} does not fit "${prompt.heading.toLowerCase()}".`;
      },
    });
  },
};

export const visualGeometryTopics: Topic[] = [solidOrFlat, solidAttributes];
