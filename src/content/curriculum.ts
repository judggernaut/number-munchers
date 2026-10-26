import type { Rng, Topic } from './types';
import { orderedTopics } from './registry';

/**
 * A curriculum run walks the selected band's topics in grade order, looping
 * once the list is exhausted. Levels stay in-band so a player never gets a
 * sudden jump from times tables to derivatives.
 */
export function buildCurriculum(band: Topic['band']): Topic[] {
  return orderedTopics(band);
}

export function topicForLevel(curriculum: Topic[], level: number): Topic {
  if (curriculum.length === 0) throw new Error('Empty curriculum');
  return curriculum[(level - 1) % curriculum.length]!;
}

/**
 * Practice mode: keep one topic but rotate its variations, which the topic
 * itself handles by regenerating from the level number.
 */
export function practiceCurriculum(topic: Topic): Topic[] {
  return [topic];
}

/** Extra variety for run mode: occasionally insert a lateral topic. */
export function shuffleWithinGrades(topics: Topic[], rng: Rng): Topic[] {
  const byGrade = new Map<number, Topic[]>();
  for (const topic of topics) {
    const key = Number(topic.grades.match(/\d+/)?.[0] ?? 99);
    const group = byGrade.get(key) ?? [];
    group.push(topic);
    byGrade.set(key, group);
  }
  const out: Topic[] = [];
  for (const key of [...byGrade.keys()].sort((a, b) => a - b)) {
    out.push(...rng.shuffle(byGrade.get(key)!));
  }
  return out;
}
