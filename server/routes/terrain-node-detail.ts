import type { FastifyInstance } from 'fastify';
import { NodeDetailRequestSchema, type ErrorResponse } from '../../src/types';
import { generateNodeDetail, NodeDetailGenerationError } from '../services/detail-generator';
import { LLMUnavailableError } from '../services/llm-client';
import { detailCache, detailKey } from '../lib/caches';

function errorResponse(code: ErrorResponse['error']['code'], message: string): ErrorResponse {
  return { error: { code, message } };
}

export async function registerTerrainNodeDetailRoute(app: FastifyInstance): Promise<void> {
  app.post('/api/terrain/node-detail', async (request, reply) => {
    const parsed = NodeDetailRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', '请求缺少必要的节点信息');
    }

    const key = detailKey(parsed.data.topic, parsed.data.nodeId, parsed.data.nodeTitle);
    const cached = detailCache.get(key);
    if (cached) return { detail: cached };

    try {
      const detail = await generateNodeDetail(parsed.data);
      detailCache.set(key, detail);
      return { detail };
    } catch (err) {
      if (err instanceof LLMUnavailableError) {
        request.log.warn({ kind: err.kind, status: err.status }, 'LLM unavailable');
        reply.code(502);
        return errorResponse('LLM_UNAVAILABLE', '生成服务暂时不可用，请稍后再试');
      }
      if (err instanceof NodeDetailGenerationError) {
        request.log.warn({ lastReason: err.lastReason }, 'node-detail generation failed');
        reply.code(500);
        return errorResponse('NODE_DETAIL_GENERATION_FAILED', '节点详情生成失败，请重试');
      }
      request.log.error({ err }, 'unexpected error in node-detail route');
      reply.code(500);
      return errorResponse('NODE_DETAIL_GENERATION_FAILED', '节点详情生成失败，请重试');
    }
  });
}
