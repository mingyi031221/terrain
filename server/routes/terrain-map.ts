import type { FastifyInstance } from 'fastify';
import { MapRequestSchema, type ErrorResponse } from '../../src/types';
import { generateMap, MapGenerationError } from '../services/map-generator';
import { LLMUnavailableError } from '../services/llm-client';
import { mapCache } from '../lib/caches';
import { normalizeTopic } from '../lib/cache';

function errorResponse(code: ErrorResponse['error']['code'], message: string): ErrorResponse {
  return { error: { code, message } };
}

export async function registerTerrainMapRoute(app: FastifyInstance): Promise<void> {
  app.post('/api/terrain/map', async (request, reply) => {
    const parsed = MapRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', '请输入一个学习主题');
    }

    const cacheKey = normalizeTopic(parsed.data.topic);
    const cached = mapCache.get(cacheKey);
    if (cached) return { map: cached };

    try {
      const map = await generateMap(parsed.data.topic);
      mapCache.set(cacheKey, map);
      return { map };
    } catch (err) {
      if (err instanceof LLMUnavailableError) {
        request.log.warn({ kind: err.kind, status: err.status }, 'LLM unavailable');
        reply.code(502);
        return errorResponse('LLM_UNAVAILABLE', '生成服务暂时不可用，请稍后再试');
      }
      if (err instanceof MapGenerationError) {
        request.log.warn({ lastReason: err.lastReason }, 'map generation failed');
        reply.code(500);
        return errorResponse('MAP_GENERATION_FAILED', '地图生成失败，请重试');
      }
      request.log.error({ err }, 'unexpected error in map route');
      reply.code(500);
      return errorResponse('MAP_GENERATION_FAILED', '地图生成失败，请重试');
    }
  });
}
