import { TerrainMapSchema, type TerrainMap } from '../../src/types';
import { formatZodError, type ParseResult } from './result';

export function parseTerrainMap(raw: unknown): ParseResult<TerrainMap> {
  const result = TerrainMapSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: formatZodError(result.error) };
}
