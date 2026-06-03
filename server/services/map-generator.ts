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

/**
 * Guarantee the dependency graph is connected: any node that ended up with no
 * edges at all gets a real prerequisite edge from the hub (a no-incoming root
 * with the most out-edges). This never creates a cycle (the orphan has no
 * outgoing path back to the hub), so every node always gets a proper arrow —
 * the prompt asks for this, this just makes it certain.
 */
export function ensureConnected(map: TerrainMap): TerrainMap {
  const deg = new Map<string, number>();
  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();
  for (const n of map.nodes) {
    deg.set(n.id, 0);
    indeg.set(n.id, 0);
    outdeg.set(n.id, 0);
  }
  for (const e of map.edges) {
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    outdeg.set(e.from, (outdeg.get(e.from) ?? 0) + 1);
  }

  const roots = map.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  const pool = roots.length ? roots : map.nodes;
  const hub = pool.reduce(
    (best, n) => ((outdeg.get(n.id) ?? 0) > (outdeg.get(best.id) ?? 0) ? n : best),
    pool[0],
  );

  const orphans = map.nodes.filter((n) => (deg.get(n.id) ?? 0) === 0 && n.id !== hub.id);
  if (orphans.length === 0) return map;

  const edges = [...map.edges];
  for (const o of orphans) {
    edges.push({ from: hub.id, to: o.id, kind: 'prerequisite' });
  }
  return { ...map, edges };
}

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
      return ensureConnected(combineToTerrainMap(result.data));
    }
    lastReason = `schema validation failed: ${result.error}`;
  }

  throw new MapGenerationError(`map generation failed after ${MAX_ATTEMPTS} attempts`, lastReason);
}
