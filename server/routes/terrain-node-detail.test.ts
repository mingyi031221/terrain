import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerTerrainNodeDetailRoute } from './terrain-node-detail';
import { generateNodeDetail, NodeDetailGenerationError } from '../services/detail-generator';
import { LLMUnavailableError } from '../services/llm-client';
import { detailCache } from '../lib/caches';
import type { TerrainNodeDetail } from '../../src/types';

vi.mock('../services/detail-generator', () => ({
  generateNodeDetail: vi.fn(),
  NodeDetailGenerationError: class NodeDetailGenerationError extends Error {
    constructor(
      message: string,
      public lastReason?: string,
    ) {
      super(message);
    }
  },
}));

vi.mock('../services/llm-client', () => ({
  LLMUnavailableError: class LLMUnavailableError extends Error {
    constructor(
      public kind: string,
      message: string,
      public status?: number,
    ) {
      super(message);
    }
  },
  chatComplete: vi.fn(),
}));

const mockedGenerateNodeDetail = vi.mocked(generateNodeDetail);

function buildDetail(): TerrainNodeDetail {
  return {
    nodeId: 'node-2',
    title: '什么是镜像',
    explanation:
      '这一段在讲的是：镜像就是一份打包好的环境快照，可以反复拿来开新的容器。像冷冻便当，随时拿出来加热都一样。',
    whyThisMatters: '弄清这件事，后面看 docker run 的输出会突然知道在指哪一层。',
    reflectionPrompt: '你上次想"重新来一遍干净环境"的时候是怎么做的？',
    suggestedNextNodeIds: [],
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await registerTerrainNodeDetailRoute(app);
  return app;
}

const validPayload = { topic: 'Docker', nodeId: 'node-2', nodeTitle: '什么是镜像' };

describe('POST /api/terrain/node-detail', () => {
  beforeEach(() => {
    mockedGenerateNodeDetail.mockReset();
    detailCache.clear();
  });

  it('returns 200 with detail on success', async () => {
    mockedGenerateNodeDetail.mockResolvedValueOnce(buildDetail());
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/node-detail',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.detail.nodeId).toBe('node-2');
    expect(body.detail.title).toBe('什么是镜像');
  });

  it('serves a cached detail on the second identical request (one LLM call)', async () => {
    mockedGenerateNodeDetail.mockResolvedValueOnce(buildDetail());
    const app = await buildApp();
    const req = {
      method: 'POST',
      url: '/api/terrain/node-detail',
      payload: validPayload,
    } as const;
    const r1 = await app.inject(req);
    const r2 = await app.inject(req);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r2.json().detail.nodeId).toBe('node-2');
    expect(mockedGenerateNodeDetail).toHaveBeenCalledTimes(1);
  });

  it('returns 400 INVALID_REQUEST for missing fields', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/node-detail',
      payload: { topic: 'Docker' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
    expect(mockedGenerateNodeDetail).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_REQUEST for empty nodeId', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/node-detail',
      payload: { ...validPayload, nodeId: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 502 LLM_UNAVAILABLE when LLM is down', async () => {
    mockedGenerateNodeDetail.mockRejectedValueOnce(new LLMUnavailableError('server', 'boom'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/node-detail',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: { code: 'LLM_UNAVAILABLE' } });
  });

  it('returns 500 NODE_DETAIL_GENERATION_FAILED on schema exhaustion', async () => {
    mockedGenerateNodeDetail.mockRejectedValueOnce(
      new NodeDetailGenerationError('exhausted', 'schema failed twice'),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/node-detail',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: { code: 'NODE_DETAIL_GENERATION_FAILED' } });
  });

  it('returns 500 NODE_DETAIL_GENERATION_FAILED on unknown error', async () => {
    mockedGenerateNodeDetail.mockRejectedValueOnce(new Error('totally unexpected'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/node-detail',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(500);
  });
});
