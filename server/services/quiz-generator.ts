import { loadPrompt, renderPrompt } from '../prompts/loader';
import { chatComplete } from './llm-client';
import { parseTerrainQuiz } from '../schemas/quiz';
import type { TerrainQuiz } from '../../src/types';

export class QuizGenerationError extends Error {
  constructor(
    message: string,
    public lastReason?: string,
  ) {
    super(message);
    this.name = 'QuizGenerationError';
  }
}

const SYSTEM_PROMPT =
  '你为 ADHD 用户生成「看看你 get 到了没」的轻量自检（绝不是考试）。严格按用户消息中描述的 JSON 结构输出，语气温柔、解释性，不要任何额外文字、不要 markdown 代码块。';

const MAX_ATTEMPTS = 2;

export interface GenerateQuizInput {
  topic: string;
  nodeId: string;
  nodeTitle: string;
}

export interface GenerateQuizOptions {
  signal?: AbortSignal;
}

export async function generateQuiz(
  input: GenerateQuizInput,
  opts: GenerateQuizOptions = {},
): Promise<TerrainQuiz> {
  const template = loadPrompt('quiz.v1');
  const basePrompt = renderPrompt(template, {
    topic: input.topic,
    nodeId: input.nodeId,
    nodeTitle: input.nodeTitle,
  });

  let lastReason = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const userPrompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\n---\n上次返回出错：${lastReason}\n请严格按 schema 重新返回，只输出 JSON 对象。`;

    const raw = await chatComplete({
      model: process.env.LLM_MODEL_DETAIL ?? 'qwen-turbo',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      signal: opts.signal,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      lastReason = `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`;
      continue;
    }

    const result = parseTerrainQuiz(parsed);
    if (!result.ok) {
      lastReason = `schema validation failed: ${result.error}`;
      continue;
    }

    if (result.data.nodeId !== input.nodeId) {
      lastReason = `nodeId mismatch: expected "${input.nodeId}", got "${result.data.nodeId}"`;
      continue;
    }

    return result.data;
  }

  throw new QuizGenerationError(
    `quiz generation failed after ${MAX_ATTEMPTS} attempts`,
    lastReason,
  );
}
