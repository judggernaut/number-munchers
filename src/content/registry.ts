import { algebraTopics } from './topics/algebra';
import { arithmeticTopics } from './topics/arithmetic';
import { geometryTopics } from './topics/geometry';
import { graphTopics } from './topics/graphs';
import { numberTheoryTopics } from './topics/number-theory';
import { precalculusTopics } from './topics/precalculus';
import { statisticsTopics } from './topics/statistics';
import { trianglePictureTopics } from './topics/triangle-pictures';
import { trigonometryTopics } from './topics/trigonometry';
import { visualGeometryTopics } from './topics/visual-geometry';
import type { Band, Family, Topic } from './types';

/** Every topic in the game, in menu order. */
export const ALL_TOPICS: Topic[] = [
  ...numberTheoryTopics,
  ...arithmeticTopics,
  ...algebraTopics,
  ...geometryTopics,
  ...visualGeometryTopics,
  ...trianglePictureTopics,
  ...graphTopics,
  ...trigonometryTopics,
  ...statisticsTopics,
  ...precalculusTopics,
];

export const BANDS: Band[] = ['elementary', 'middle', 'high'];

export const FAMILY_COLORS: Record<Family, string> = {
  number: '#5ad2ff',
  arithmetic: '#7dffb0',
  algebra: '#ffd85a',
  geometry: '#ff9de2',
  trigonometry: '#b06bff',
  statistics: '#ffb347',
  precalculus: '#ff5a5a',
};

export const FAMILY_LABELS: Record<Family, string> = {
  number: 'Number Sense',
  arithmetic: 'Arithmetic',
  algebra: 'Algebra',
  geometry: 'Geometry',
  trigonometry: 'Trigonometry',
  statistics: 'Statistics',
  precalculus: 'Pre-Calculus',
};

export function topicsForBand(band: Band): Topic[] {
  return ALL_TOPICS.filter((topic) => topic.band === band);
}

export function findTopic(id: string): Topic | undefined {
  return ALL_TOPICS.find((topic) => topic.id === id);
}

/** First grade number mentioned in `grades`, used purely for menu ordering. */
export function gradeRank(topic: Topic): number {
  const match = topic.grades.match(/\d+/);
  return match ? Number(match[0]) : 99;
}

export function orderedTopics(band: Band): Topic[] {
  return topicsForBand(band).slice().sort((a, b) => {
    const grade = gradeRank(a) - gradeRank(b);
    if (grade !== 0) return grade;
    return a.name.localeCompare(b.name);
  });
}

export function topicSummary(): { total: number; byBand: Record<Band, number> } {
  return {
    total: ALL_TOPICS.length,
    byBand: {
      elementary: topicsForBand('elementary').length,
      middle: topicsForBand('middle').length,
      high: topicsForBand('high').length,
    },
  };
}
