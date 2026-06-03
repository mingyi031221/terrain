import { TerrainQuizSchema, type TerrainQuiz } from '../../src/types';
import { formatZodError, type ParseResult } from './result';

export function parseTerrainQuiz(raw: unknown): ParseResult<TerrainQuiz> {
  const result = TerrainQuizSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: formatZodError(result.error) };
}
