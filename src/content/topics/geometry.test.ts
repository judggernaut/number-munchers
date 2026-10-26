import { describe, expect, it } from 'vitest';
import { geometryTopics } from './geometry';
import { createRng } from '../rng';
import { ASCII_ONLY, close, evalArith, evalPiTile } from './test-utils';

const parsePair = (text: string): [number, number] => {
  const m = /^(\d+),(\d+)$/.exec(text);
  expect(m).not.toBeNull();
  return [Number(m![1]), Number(m![2])];
};

const parseTriple = (text: string): [number, number, number] => {
  const m = /^(\d+),(\d+),(\d+)$/.exec(text);
  expect(m).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3])];
};

const parsePoint = (text: string): [number, number] => {
  const m = /^\((-?\d+),(-?\d+)\)$/.exec(text);
  expect(m).not.toBeNull();
  return [Number(m![1]), Number(m![2])];
};

const parseEndpointPair = (text: string): [[number, number], [number, number]] => {
  const m = /^(-?\d+),(-?\d+);(-?\d+),(-?\d+)$/.exec(text);
  expect(m).not.toBeNull();
  return [
    [Number(m![1]), Number(m![2])],
    [Number(m![3]), Number(m![4])],
  ];
};

const parseRatio = (text: string): [number, number] => {
  const m = /^(\d+):(\d+)$/.exec(text);
  expect(m).not.toBeNull();
  return [Number(m![1]), Number(m![2])];
};

const POINTS: Record<string, number> = {
  Triangle: 3,
  Quadrilateral: 4,
  Pentagon: 5,
  Hexagon: 6,
  Heptagon: 7,
  Octagon: 8,
  Nonagon: 9,
  Decagon: 10,
  '12-gon': 12,
  '15-gon': 15,
  '20-gon': 20,
};

const samples = (topicIndex: number) => {
  const topic = geometryTopics[topicIndex]!;
  const rounds = [];
  for (const level of [1, 6, 13, 20]) {
    for (let seed = 0; seed < 5; seed++) {
      rounds.push({ level, seed, round: topic.round(createRng(seed * 101 + level), level) });
    }
  }
  return rounds;
};

const allRounds = (topicIndex: number) => {
  const topic = geometryTopics[topicIndex]!;
  const rounds = [];
  for (let level = 1; level <= 20; level++) {
    for (let seed = 0; seed < 20; seed++) {
      rounds.push({ level, seed, round: topic.round(createRng(seed * 7919 + level * 31), level) });
    }
  }
  return rounds;
};

for (const topic of geometryTopics) {
  describe(topic.id, () => {
    it('is deterministic for a fixed seed', () => {
      const a = topic.round(createRng(4242), 7);
      const b = topic.round(createRng(4242), 7);
      expect(a.heading).toBe(b.heading);
      expect(a.instruction).toBe(b.instruction);
      expect(a.correctCount).toBe(b.correctCount);
      expect(a.tiles).toEqual(b.tiles);
      for (const tile of a.tiles) expect(a.explain(tile.text)).toBe(b.explain(tile.text));
    });

    it('always produces a valid 30-tile board', () => {
      for (const { level, seed, round } of samples(geometryTopics.indexOf(topic))) {
        const texts = round.tiles.map((t) => t.text);
        expect(round.tiles, `${topic.id} L${level} S${seed}`).toHaveLength(30);
        expect(round.tiles.filter((t) => t.correct)).toHaveLength(round.correctCount);
        expect(round.correctCount).toBeGreaterThanOrEqual(8);
        expect(round.correctCount).toBeLessThanOrEqual(12);
        expect(new Set(texts).size).toBe(30);
        expect(round.heading.length).toBeGreaterThan(0);
        expect(round.instruction.length).toBeGreaterThan(0);
        for (const text of texts) {
          expect(text.length).toBeLessThanOrEqual(9);
          expect(text).toMatch(ASCII_ONLY);
          expect(round.explain(text).length).toBeGreaterThan(0);
        }
      }
    });

    it('never throws over 20 levels and 20 seeds', () => {
      for (let level = 1; level <= 20; level++) {
        for (let seed = 0; seed < 20; seed++) {
          expect(() => topic.round(createRng(seed * 7919 + level * 31), level)).not.toThrow();
        }
      }
    });
  });
}

describe('geometry independent checks', () => {
  it('angles: every correct tile equals the complement, supplement or vertical partner', () => {
    for (const { round } of allRounds(0)) {
      const m = /^(Complementary|Supplementary|Vertical) to (\d+) deg$/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const given = Number(m![2]);
      const partner = m![1] === 'Complementary' ? 90 - given : m![1] === 'Supplementary' ? 180 - given : given;
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, partner));
      }
    }
  });

  it('triangle-types: classifies every triple independently', () => {
    for (const { round } of allRounds(1)) {
      const target = round.heading.replace(' Triangles', '').toLowerCase();
      const angleMode = round.instruction.includes('angle set');
      for (const tile of round.tiles) {
        const [a, b, c] = parseTriple(tile.text);
        let expected = false;
        if (angleMode) {
          const max = Math.max(a, b, c);
          const kind = a + b + c !== 180 ? 'invalid' : max > 90 ? 'obtuse' : max === 90 ? 'right' : 'acute';
          expected = kind === target;
        } else {
          const [x, y, z] = [a, b, c].sort((p, q) => p - q) as [number, number, number];
          const kind = x + y <= z
            ? 'invalid'
            : x === z ? 'equilateral' : x === y || y === z ? 'isosceles' : 'scalene';
          expected = kind === target;
        }
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(expected);
      }
    }
  });

  it('pythagorean: every correct tile equals the missing side', () => {
    for (const { round } of allRounds(2)) {
      const legs = /^Legs (\d+) and (\d+): missing hyp$/.exec(round.heading);
      const legHyp = /^Leg (\d+), hyp (\d+): missing leg$/.exec(round.heading);
      expect(legs ?? legHyp, round.heading).not.toBeNull();
      const expected = legs
        ? Math.sqrt(Number(legs[1]) ** 2 + Number(legs[2]) ** 2)
        : Math.sqrt(Number(legHyp![2]) ** 2 - Number(legHyp![1]) ** 2);
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected));
      }
    }
  });

  it('area-perimeter: every correct tile equals the area or perimeter', () => {
    for (const { round } of allRounds(3)) {
      const rect = /^Rectangle (\d+)x(\d+): (area|perimeter)$/.exec(round.heading);
      const tri = /^Triangle b=(\d+),h=(\d+): area$/.exec(round.heading);
      expect(rect ?? tri, round.heading).not.toBeNull();
      let expected = 0;
      if (rect) {
        const [w, h] = [Number(rect[1]), Number(rect[2])];
        expected = rect[3] === 'area' ? w * h : 2 * (w + h);
      } else {
        expected = (Number(tri![1]) * Number(tri![2])) / 2;
      }
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected));
      }
    }
  });

  it('circles: evaluates pi forms with pi = 3.14', () => {
    for (const { round } of allRounds(4)) {
      const m = /^Circle (r|d)=(\d+): (circumference|area)$/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const radius = m![1] === 'r' ? Number(m![2]) : Number(m![2]) / 2;
      const coef = m![3] === 'circumference' ? 2 * radius : radius * radius;
      const expected = coef * 3.14;
      for (const tile of round.tiles) {
        const value = evalPiTile(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected, 1e-7));
      }
    }
  });

  it('volume: recomputes volume and surface area from the heading', () => {
    for (const { round } of allRounds(5)) {
      const box = /^Box (\d+)x(\d+)x(\d+): (volume|surface area)$/.exec(round.heading);
      const cyl = /^Cylinder r=(\d+),h=(\d+): (volume|surface area)$/.exec(round.heading);
      const cone = /^Cone r=(\d+),h=(\d+): volume$/.exec(round.heading);
      const sphere = /^Sphere r=(\d+): (volume|surface area)$/.exec(round.heading);
      let expected = 0;
      let pi = false;
      if (box) {
        const [l, w, h] = [Number(box[1]), Number(box[2]), Number(box[3])];
        expected = box[4] === 'volume' ? l * w * h : 2 * (l * w + l * h + w * h);
      } else if (cyl) {
        const [r, h] = [Number(cyl[1]), Number(cyl[2])];
        expected = cyl[3] === 'volume' ? r * r * h : 2 * r * (r + h);
        pi = true;
      } else if (cone) {
        const [r, h] = [Number(cone[1]), Number(cone[2])];
        expected = (r * r * h) / 3;
        pi = true;
      } else {
        expect(sphere).not.toBeNull();
        const r = Number(sphere![1]);
        expected = sphere![2] === 'volume' ? (4 * r * r * r) / 3 : 4 * r * r;
        pi = true;
      }
      const target = pi ? expected * 3.14 : expected;
      for (const tile of round.tiles) {
        const value = pi ? evalPiTile(tile.text) : evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, target, 1e-7));
      }
    }
  });

  it('coordinate-geometry: recomputes quadrants, distances and midpoints', () => {
    for (const { round } of allRounds(6)) {
      const quadrant = /^Quadrant (I|II|III|IV)$/.exec(round.heading);
      const distance = /^Distance (\d+) from \((-?\d+),(-?\d+)\)$/.exec(round.heading);
      const midpoint = /^Midpoint \((-?\d+),(-?\d+)\)$/.exec(round.heading);
      expect(quadrant ?? distance ?? midpoint).not.toBeNull();
      for (const tile of round.tiles) {
        if (quadrant) {
          const [x, y] = parsePoint(tile.text);
          const actual = x > 0 ? (y > 0 ? 'I' : y < 0 ? 'IV' : '') : x < 0 ? (y > 0 ? 'II' : y < 0 ? 'III' : '') : '';
          expect(tile.correct, `${round.heading} ${tile.text}`).toBe(actual === quadrant[1]);
        } else if (distance) {
          const [x, y] = parsePoint(tile.text);
          const dx = x - Number(distance[2]);
          const dy = y - Number(distance[3]);
          expect(tile.correct, `${round.heading} ${tile.text}`).toBe(dx * dx + dy * dy === Number(distance[1]) ** 2);
        } else {
          const [[x1, y1], [x2, y2]] = parseEndpointPair(tile.text);
          expect(tile.correct, `${round.heading} ${tile.text}`).toBe(
            (x1 + x2) / 2 === Number(midpoint![1]) && (y1 + y2) / 2 === Number(midpoint![2]),
          );
        }
      }
    }
  });

  it('polygons: recomputes the requested polygon property', () => {
    for (const { round } of allRounds(7)) {
      const m = /^(.+): (sides|interior sum|diagonals)$/.exec(round.heading);
      expect(m, round.heading).not.toBeNull();
      const n = POINTS[m![1]!]!;
      expect(n).toBeDefined();
      const expected = m![2] === 'sides' ? n : m![2] === 'interior sum' ? (n - 2) * 180 : (n * (n - 3)) / 2;
      for (const tile of round.tiles) {
        const value = evalArith(tile.text);
        expect(value, tile.text).not.toBeNull();
        expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected));
      }
    }
  });

  it('similarity: recomputes scale factors, ratios and missing sides', () => {
    for (const { round } of allRounds(8)) {
      const scale = /^Scale factor (\d+)$/.exec(round.heading);
      const ratio = /^Ratio (\d+):(\d+)$/.exec(round.heading);
      const missing = /^Proportion (\d+):(\d+) = (?:x:(\d+)|(\d+):x)$/.exec(round.heading);
      expect(scale ?? ratio ?? missing).not.toBeNull();
      for (const tile of round.tiles) {
        if (scale) {
          const [a, b] = parseRatio(tile.text);
          expect(tile.correct, tile.text).toBe(b === a * Number(scale[1]));
        } else if (ratio) {
          const [a, b] = parseRatio(tile.text);
          expect(tile.correct, tile.text).toBe(a * Number(ratio[2]) === b * Number(ratio[1]));
        } else {
          const value = evalArith(tile.text);
          expect(value, tile.text).not.toBeNull();
          const p = Number(missing![1]);
          const q = Number(missing![2]);
          const expected = missing![3] !== undefined
            ? p * (Number(missing![3]) / q)
            : q * (Number(missing![4]) / p);
          expect(tile.correct, `${round.heading} ${tile.text}`).toBe(close(value!, expected));
        }
      }
    }
  });

  it('circle-theorems: recomputes each theorem relationship', () => {
    for (const { round } of allRounds(9)) {
      for (const tile of round.tiles) {
        if (round.heading === 'Tangent & Radius') {
          const value = evalArith(tile.text);
          expect(value, tile.text).not.toBeNull();
          expect(tile.correct, tile.text).toBe(close(value!, 90));
        } else {
          const [a, b] = parsePair(tile.text);
          const expected = round.heading === 'Inscribed & Central Angles'
            ? b === 2 * a
            : round.heading === 'Cyclic Quadrilateral'
              ? a + b === 180
              : a === b;
          expect(tile.correct, `${round.heading} ${tile.text}`).toBe(expected);
        }
      }
    }
  });
});
