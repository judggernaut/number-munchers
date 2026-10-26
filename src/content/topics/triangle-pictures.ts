import { makeRound } from '../build';
import type { Rng, ShapeSpec, TileVisual, Topic } from '../types';

/**
 * Picture-based triangle classification: the board shows triangles drawn from
 * their real angles, with equality tick marks for equal sides and a square on
 * any right angle.
 *
 * A triangle has two independent classifications, so the prompt decides which
 * one is being asked about:
 *   - by angles: acute / right / obtuse
 *   - by sides:  equilateral / isosceles / scalene
 */
export type AngleClass = 'acute' | 'right' | 'obtuse';
export type SideClass = 'equilateral' | 'isosceles' | 'scalene';
export type TriClass = AngleClass | SideClass;

const ANGLE_CLASSES: AngleClass[] = ['acute', 'right', 'obtuse'];
const SIDE_CLASSES: SideClass[] = ['equilateral', 'isosceles', 'scalene'];

export const angleClass = (angles: readonly number[]): AngleClass => {
  const biggest = Math.max(...angles);
  if (biggest === 90) return 'right';
  if (biggest > 90) return 'obtuse';
  return 'acute';
};

export const sideClass = (angles: readonly number[]): SideClass => {
  const distinct = new Set(angles).size;
  if (distinct === 1) return 'equilateral';
  if (distinct === 2) return 'isosceles';
  return 'scalene';
};

const matches = (cls: TriClass, angles: readonly number[]): boolean =>
  ANGLE_CLASSES.includes(cls as AngleClass)
    ? angleClass(angles) === cls
    : sideClass(angles) === cls;

/** Sides opposite equal angles are equal, so mark them. */
const marksFor = (angles: readonly number[]): number[] =>
  angles.map((angle, index) => (angles.filter((other) => other === angle).length > 1 ? index : -1)).filter((i) => i >= 0);

interface TriTile {
  id: string;
  spec: ShapeSpec;
  angles: [number, number, number];
  marks: number[];
}

function makeAngles(cls: TriClass, rng: Rng): [number, number, number] {
  switch (cls) {
    case 'equilateral':
      return [60, 60, 60];
    case 'isosceles': {
      // Repeated attempts keep the arithmetic exact.
      for (let i = 0; i < 60; i++) {
        const base = rng.int(30, 80);
        const apex = 180 - base * 2;
        if (apex >= 20 && apex !== base) return [apex, base, base];
      }
      return [40, 70, 70];
    }
    case 'scalene': {
      for (let i = 0; i < 60; i++) {
        const a = rng.int(25, 110);
        const b = rng.int(25, 110);
        const c = 180 - a - b;
        if (c < 25) continue;
        if (new Set([a, b, c]).size === 3) return [a, b, c];
      }
      return [80, 60, 40];
    }
    case 'right': {
      const a = rng.int(20, 70);
      return [90, a, 90 - a];
    }
    case 'obtuse': {
      const big = rng.int(100, 140);
      const rest = 180 - big;
      const a = rng.int(15, rest - 15);
      return [big, a, rest - a];
    }
    case 'acute':
    default: {
      for (let i = 0; i < 80; i++) {
        const a = rng.int(35, 80);
        const b = rng.int(35, 80);
        const c = 180 - a - b;
        if (c < 30) continue;
        if (Math.max(a, b, c) >= 90) continue;
        return [a, b, c];
      }
      return [70, 60, 50];
    }
  }
}

function poolFor(target: TriClass, count: number, prefix: string, rng: Rng): TriTile[] {
  const tiles: TriTile[] = [];
  let guard = 0;
  while (tiles.length < count && guard < count * 40) {
    guard++;
    const angles = makeAngles(target, rng);
    if (!matches(target, angles)) continue;
    const marks = marksFor(angles);
    tiles.push({
      id: `${prefix}${tiles.length}`,
      angles,
      marks,
      spec: { kind: 'shape', shape: 'triangle', dimension: 2, triangle: { angles, marks } },
    });
  }
  if (tiles.length < count) throw new Error(`triangle pool starved for ${target}`);
  return tiles;
}

const trianglePictures: Topic = {
  id: 'triangle-pictures',
  name: 'Triangle Pictures',
  family: 'geometry',
  band: 'middle',
  grades: 'Grades 5-8',
  blurb: 'Classify triangles from the drawing: angles, tick marks, right-angle squares.',
  round(rng: Rng, level: number) {
    const angleMode = rng.chance(0.55);
    const classes: TriClass[] = angleMode ? ANGLE_CLASSES : SIDE_CLASSES;
    const target = rng.pick(classes);
    const others = classes.filter((cls) => cls !== target);

    const matching = poolFor(target, 12, 't', rng);
    const otherTiles = others.flatMap((cls) => poolFor(cls, 13, `o${cls}`, rng));

    const visuals: Record<string, TileVisual> = {};
    const explainMap = new Map<string, TriTile>();
    for (const tile of [...matching, ...otherTiles]) {
      visuals[tile.id] = tile.spec;
      explainMap.set(tile.id, tile);
    }

    return makeRound({
      rng,
      heading: angleMode ? 'Triangle Angles' : 'Triangle Sides',
      instruction: `Munch every ${target} triangle.`,
      correct: matching.map((t) => t.id),
      incorrect: otherTiles.map((t) => t.id),
      correctCount: 9 + Math.min(2, Math.floor(level / 8)),
      visuals,
      explain: (text) => {
        const tile = explainMap.get(text);
        if (!tile) return 'That triangle does not match.';
        const [a, b, c] = tile.angles;
        const actual = angleMode ? angleClass(tile.angles) : sideClass(tile.angles);
        const detail = angleMode
          ? `its angles are ${a}, ${b} and ${c} degrees`
          : `it has ${new Set(tile.angles).size} distinct angles, so ${new Set(tile.angles).size === 1 ? 'all' : new Set(tile.angles).size === 2 ? 'two' : 'no'} sides are equal`;
        return `${detail[0]!.toUpperCase()}${detail.slice(1)}; it is ${actual}, not ${target}.`;
      },
    });
  },
};

export const trianglePictureTopics: Topic[] = [trianglePictures];
