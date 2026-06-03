import type { FastifyInstance } from 'fastify';
import { QuizRequestSchema, type ErrorResponse } from '../../src/types';
import { generateQuiz, QuizGenerationError } from '../services/quiz-generator';
import { LLMUnavailableError } from '../services/llm-client';
import { quizCache, quizKey } from '../lib/caches';

function errorResponse(code: ErrorResponse['error']['code'], message: string): ErrorResponse {
  return { error: { code, message } };
}

export async function registerTerrainQuizRoute(app: FastifyInstance): Promise<void> {
  app.post('/api/terrain/quiz', async (request, reply) => {
    const parsed = QuizRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', '请求缺少必要的节点信息');
    }

    const key = quizKey(parsed.data.topic, parsed.data.nodeId, parsed.data.nodeTitle);
    const cached = quizCache.get(key);
    if (cached) return { quiz: cached };

    try {
      const quiz = await generateQuiz(parsed.data);
      quizCache.set(key, quiz);
      return { quiz };
    } catch (err) {
      if (err instanceof LLMUnavailableError) {
        request.log.warn({ kind: err.kind, status: err.status }, 'LLM unavailable');
        reply.code(502);
        return errorResponse('LLM_UNAVAILABLE', '生成服务暂时不可用，请稍后再试');
      }
      if (err instanceof QuizGenerationError) {
        request.log.warn({ lastReason: err.lastReason }, 'quiz generation failed');
        reply.code(500);
        return errorResponse('QUIZ_GENERATION_FAILED', '小测生成失败，待会儿再试试');
      }
      request.log.error({ err }, 'unexpected error in quiz route');
      reply.code(500);
      return errorResponse('QUIZ_GENERATION_FAILED', '小测生成失败，待会儿再试试');
    }
  });
}
