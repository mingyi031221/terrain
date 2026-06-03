import { z } from 'zod';
import {
  TerrainNodeSchema,
  TerrainEdgeSchema,
  checkMapInvariants,
  type TerrainMap,
} from '../../src/types';
import { formatZodError, type ParseResult } from './result';

export const TerrainMapDraftSchema = z
  .object({
    topic: z.string().min(1),
    userPositionLabel: z.string().min(1),
    nodes: z.array(TerrainNodeSchema).min(5).max(8),
    edges: z.array(TerrainEdgeSchema),
  })
  .superRefine(checkMapInvariants);

export type TerrainMapDraft = z.infer<typeof TerrainMapDraftSchema>;

export function parseTerrainMapDraft(raw: unknown): ParseResult<TerrainMapDraft> {
  const r = TerrainMapDraftSchema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: formatZodError(r.error) };
}

export function combineToTerrainMap(draft: TerrainMapDraft): TerrainMap {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    ...draft,
  };
}
