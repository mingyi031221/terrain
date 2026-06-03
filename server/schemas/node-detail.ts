import { TerrainNodeDetailSchema, type TerrainNodeDetail } from '../../src/types';
import { formatZodError, type ParseResult } from './result';

export function parseTerrainNodeDetail(raw: unknown): ParseResult<TerrainNodeDetail> {
  const result = TerrainNodeDetailSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: formatZodError(result.error) };
}
