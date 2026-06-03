import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerTerrainMapRoute } from './terrain-map';
import { generateMap, MapGenerationError } from '../services/map-generator';
import { LLMUnavailableError } from '../services/llm-client';
import { mapCache } from '../lib/caches';
import type { TerrainMap } from '../../src/types';

vi.mock('../services/map-generator', () => ({
  generateMap: vi.fn(),
  MapGenerationError: class MapGenerationError extends Error {
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

const mockedGenerateMap = vi.mocked(generateMap);

function buildMap(): TerrainMap {
  return {
    version: '1.0',
    topic: 'Docker',
    generatedAt: '2026-05-28T00:00:00.000Z',
    userPositionLabel: '入门',
    nodes: Array.from({ length: 5 }, (_, i) => ({
      id: `node-${i + 1}`,
      title: `节点 ${i + 1}`,
      summary: 's',
      difficulty: 2,
      estimatedMinutes: 30,
      required: true,
    })),
    edges: [],
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await registerTerrainMapRoute(app);
  return app;
}

describe('POST /api/terrain/map', () => {
  beforeEach(() => {
    mockedGenerateMap.mockReset();
    mapCache.clear();
  });

  it('returns 200 with map on success', async () => {
    mockedGenerateMap.mockResolvedValueOnce(buildMap());
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/map',
      payload: { topic: 'Docker' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.map.topic).toBe('Docker');
    expect(body.map.nodes).toHaveLength(5);
  });

  it('serves a cached map on the second identical request (one LLM call)', async () => {
    mockedGenerateMap.mockResolvedValueOnce(buildMap());
    const app = await buildApp();
    const req = { method: 'POST', url: '/api/terrain/map', payload: { topic: 'Docker' } } as const;
    const r1 = await app.inject(req);
    const r2 = await app.inject(req);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r2.json().map.topic).toBe('Docker');
    expect(mockedGenerateMap).toHaveBeenCalledTimes(1);
  });

  it('returns 400 INVALID_REQUEST for empty topic', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/map',
      payload: { topic: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'INVALID_REQUEST' },
    });
    expect(mockedGenerateMap).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_REQUEST for missing topic', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/map',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 502 LLM_UNAVAILABLE when LLM fails', async () => {
    mockedGenerateMap.mockRejectedValueOnce(new LLMUnavailableError('server', 'boom'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/map',
      payload: { topic: 'Docker' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({
      error: { code: 'LLM_UNAVAILABLE' },
    });
  });

  it('returns 500 MAP_GENERATION_FAILED on schema retry exhaustion', async () => {
    mockedGenerateMap.mockRejectedValueOnce(
      new MapGenerationError('exhausted', 'schema failed twice'),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/map',
      payload: { topic: 'Docker' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({
      error: { code: 'MAP_GENERATION_FAILED' },
    });
  });

  it('returns 500 MAP_GENERATION_FAILED on unknown error', async () => {
    mockedGenerateMap.mockRejectedValueOnce(new Error('totally unexpected'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/map',
      payload: { topic: 'Docker' },
    });
    expect(res.statusCode).toBe(500);
  });
});
