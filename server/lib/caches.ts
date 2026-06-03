import type { TerrainMap, TerrainNodeDetail, TerrainQuiz } from '../../src/types';
import { TTLCache } from './cache';

// Shared across requests for the lifetime of the process.
export const mapCache = new TTLCache<TerrainMap>(300);
export const detailCache = new TTLCache<TerrainNodeDetail>(800);
export const quizCache = new TTLCache<TerrainQuiz>(800);

export function detailKey(topic: string, nodeId: string, nodeTitle: string): string {
  return `${topic.trim().toLowerCase()}::${nodeId}::${nodeTitle.trim()}`;
}

export function quizKey(topic: string, nodeId: string, nodeTitle: string): string {
  return `${topic.trim().toLowerCase()}::${nodeId}::${nodeTitle.trim()}`;
}
