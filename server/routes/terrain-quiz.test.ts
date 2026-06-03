import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerTerrainQuizRoute } from './terrain-quiz';
import { generateQuiz, QuizGenerationError } from '../services/quiz-generator';
import { LLMUnavailableError } from '../services/llm-client';
import { quizCache } from '../lib/caches';
import type { TerrainQuiz } from '../../src/types';

vi.mock('../services/quiz-generator', () => ({
  generateQuiz: vi.fn(),
  QuizGenerationError: class QuizGenerationError extends Error {
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

const mockedGenerateQuiz = vi.mocked(generateQuiz);

function buildQuiz(): TerrainQuiz {
  return {
    nodeId: 'node-2',
    questions: [
      {
        type: 'truefalse',
        question: '镜像是只读模板，容器是它跑起来的实例。',
        options: ['对', '错'],
        answerIndex: 0,
        explanation: '对，镜像像模具，容器是做出来能动的那一个。',
      },
      {
        type: 'choice',
        question: '哪种说法更接近实际？',
        options: ['镜像是快照，容器基于它启动', '两者一样', '容器更早出现'],
        answerIndex: 0,
        explanation: '这题容易混，其实容器是镜像跑起来的那一份。',
      },
    ],
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await registerTerrainQuizRoute(app);
  return app;
}

const validPayload = { topic: 'Docker', nodeId: 'node-2', nodeTitle: '镜像和容器的区别' };

describe('POST /api/terrain/quiz', () => {
  beforeEach(() => {
    mockedGenerateQuiz.mockReset();
    quizCache.clear();
  });

  it('returns 200 with quiz on success', async () => {
    mockedGenerateQuiz.mockResolvedValueOnce(buildQuiz());
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/quiz',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.quiz.nodeId).toBe('node-2');
    expect(body.quiz.questions).toHaveLength(2);
  });

  it('serves a cached quiz on the second identical request (one LLM call)', async () => {
    mockedGenerateQuiz.mockResolvedValueOnce(buildQuiz());
    const app = await buildApp();
    const req = { method: 'POST', url: '/api/terrain/quiz', payload: validPayload } as const;
    const r1 = await app.inject(req);
    const r2 = await app.inject(req);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r2.json().quiz.nodeId).toBe('node-2');
    expect(mockedGenerateQuiz).toHaveBeenCalledTimes(1);
  });

  it('returns 400 INVALID_REQUEST for missing fields', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/quiz',
      payload: { topic: 'Docker' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
    expect(mockedGenerateQuiz).not.toHaveBeenCalled();
  });

  it('returns 502 LLM_UNAVAILABLE when LLM is down', async () => {
    mockedGenerateQuiz.mockRejectedValueOnce(new LLMUnavailableError('server', 'boom'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/quiz',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: { code: 'LLM_UNAVAILABLE' } });
  });

  it('returns 500 QUIZ_GENERATION_FAILED on generation failure', async () => {
    mockedGenerateQuiz.mockRejectedValueOnce(new QuizGenerationError('exhausted', 'schema failed'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/quiz',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: { code: 'QUIZ_GENERATION_FAILED' } });
  });

  it('returns 500 QUIZ_GENERATION_FAILED on unknown error', async () => {
    mockedGenerateQuiz.mockRejectedValueOnce(new Error('totally unexpected'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/terrain/quiz',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(500);
  });
});
