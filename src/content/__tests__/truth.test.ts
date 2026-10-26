import { describe, expect, it } from 'vitest';

import { createRng } from '../rng';
import { arithmeticTopics } from '../topics/arithmetic';
import { graphTopics } from '../topics/graphs';
import { numberTheoryTopics } from '../topics/number-theory';
import { trianglePictureTopics } from '../topics/triangle-pictures';
import { visualGeometryTopics } from '../topics/visual-geometry';
import { verifyRound } from './support/truth';

/**
 * The important guard: flags must be *mathematically* right, not merely
 * consistent with the generator that produced them.
 */
describe('independent truth verification', () => {
  for (const topic of [
    ...numberTheoryTopics,
    ...arithmeticTopics,
    ...graphTopics,
    ...visualGeometryTopics,
    ...trianglePictureTopics,
  ]) {
    it(`${topic.id}: every tile flag matches the mathematics`, () => {
      const failures: string[] = [];
      for (let level = 1; level <= 20; level++) {
        for (let seed = 1; seed <= 10; seed++) {
          const round = topic.round(createRng(seed * 104729 + level), level);
          for (const failure of verifyRound(topic.id, round)) {
            failures.push(`level ${level} seed ${seed}: ${failure} [${round.heading}]`);
          }
        }
      }
      expect(failures.slice(0, 12)).toEqual([]);
    });
  }
});
