import { loadPrompt, renderPrompt } from '../prompts/loader';
import { chatComplete } from './llm-client';
import { parseTerrainNodeDetail } from '../schemas/node-detail';
import type { TerrainNodeDetail } from '../../src/types';

export class NodeDetailGenerationError extends Error {
  constructor(
    message: string,
    public lastReason?: string,
  ) {
    super(message);
    this.name = 'NodeDetailGenerationError';
  }
}

const SYSTEM_PROMPT =
  '你是为 ADHD 用户写「走进山头」节点详情的引导者。严格按用户消息中描述的 JSON 结构输出，不要任何额外文字、不要 markdown 代码块。';

const MAX_ATTEMPTS = 2;

export interface GenerateNodeDetailInput {
  topic: string;
  nodeId: string;
  nodeTitle: string;
}

export interface GenerateNodeDetailOptions {
  signal?: AbortSignal;
}

export async function generateNodeDetail(
  input: GenerateNodeDetailInput,
  opts: GenerateNodeDetailOptions = {},
): Promise<TerrainNodeDetail> {
  const template = loadPrompt('node-detail.v1');
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

    const result = parseTerrainNodeDetail(parsed);
    if (!result.ok) {
      lastReason = `schema validation failed: ${result.error}`;
      continue;
    }

    if (result.data.nodeId !== input.nodeId) {
      lastReason = `nodeId mismatch: expected "${input.nodeId}", got "${result.data.nodeId}"`;
      continue;
    }

    return { ...result.data, suggestedNextNodeIds: result.data.suggestedNextNodeIds ?? [] };
  }

  throw new NodeDetailGenerationError(
    `node-detail generation failed after ${MAX_ATTEMPTS} attempts`,
    lastReason,
  );
}
