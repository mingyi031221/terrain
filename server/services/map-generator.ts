import { loadPrompt, renderPrompt } from '../prompts/loader';
import { chatComplete } from './llm-client';
import { parseTerrainMapDraft, combineToTerrainMap } from '../schemas/terrain-draft';
import type { TerrainMap } from '../../src/types';

export class MapGenerationError extends Error {
  constructor(
    message: string,
    public lastReason?: string,
  ) {
    super(message);
    this.name = 'MapGenerationError';
  }
}

const SYSTEM_PROMPT =
  '你是为 ADHD 用户做学习地形图的引导者。严格按用户消息中描述的 JSON 结构输出，不要任何额外文字、不要 markdown 代码块。';

const MAX_ATTEMPTS = 2;

export interface GenerateMapOptions {
  signal?: AbortSignal;
}

export async function generateMap(
  topic: string,
  opts: GenerateMapOptions = {},
): Promise<TerrainMap> {
  const template = loadPrompt('map.v1');
  const basePrompt = renderPrompt(template, { topic });

  let lastReason = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const userPrompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\n---\n上次返回出错：${lastReason}\n请严格按 schema 重新返回，只输出 JSON 对象。`;

    const raw = await chatComplete({
      model: process.env.LLM_MODEL_MAP ?? 'qwen-plus',
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

    const result = parseTerrainMapDraft(parsed);
    if (result.ok) {
      return combineToTerrainMap(result.data);
    }
    lastReason = `schema validation failed: ${result.error}`;
  }

  throw new MapGenerationError(`map generation failed after ${MAX_ATTEMPTS} attempts`, lastReason);
}
