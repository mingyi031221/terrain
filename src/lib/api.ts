import type { TerrainMap, TerrainNodeDetail, TerrainQuiz, ErrorResponse } from '../types';

// Dev sets VITE_API_BASE_URL=http://localhost:3001 (two servers); in the
// production single-service deploy the API is same-origin, so we fall back to a
// relative base ('') and fetch '/api/...'.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export type FetchMapResult =
  | { ok: true; map: TerrainMap }
  | { ok: false; code: string; message: string };

export type FetchNodeDetailResult =
  | { ok: true; detail: TerrainNodeDetail }
  | { ok: false; code: string; message: string };

export type FetchQuizResult =
  | { ok: true; quiz: TerrainQuiz }
  | { ok: false; code: string; message: string };

export async function fetchMap(topic: string, signal?: AbortSignal): Promise<FetchMapResult> {
  try {
    const response = await fetch(`${API_BASE}/api/terrain/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
      signal,
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const err = (data as ErrorResponse | null)?.error;
      return {
        ok: false,
        code: err?.code ?? 'UNKNOWN',
        message: err?.message ?? `生成失败 (HTTP ${response.status})`,
      };
    }

    const map = (data as { map?: TerrainMap } | null)?.map;
    if (!map) {
      return { ok: false, code: 'UNKNOWN', message: '生成服务返回了空响应' };
    }
    return { ok: true, map };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, code: 'ABORTED', message: '请求已取消' };
    }
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: '无法连接到生成服务，请检查网络或稍后再试',
    };
  }
}

export interface FetchNodeDetailInput {
  topic: string;
  nodeId: string;
  nodeTitle: string;
}

export async function fetchNodeDetail(
  input: FetchNodeDetailInput,
  signal?: AbortSignal,
): Promise<FetchNodeDetailResult> {
  try {
    const response = await fetch(`${API_BASE}/api/terrain/node-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const err = (data as ErrorResponse | null)?.error;
      return {
        ok: false,
        code: err?.code ?? 'UNKNOWN',
        message: err?.message ?? `生成失败 (HTTP ${response.status})`,
      };
    }

    const detail = (data as { detail?: TerrainNodeDetail } | null)?.detail;
    if (!detail) {
      return { ok: false, code: 'UNKNOWN', message: '生成服务返回了空响应' };
    }
    return { ok: true, detail };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, code: 'ABORTED', message: '请求已取消' };
    }
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: '无法连接到生成服务，请检查网络或稍后再试',
    };
  }
}

export interface FetchQuizInput {
  topic: string;
  nodeId: string;
  nodeTitle: string;
}

export async function fetchQuiz(
  input: FetchQuizInput,
  signal?: AbortSignal,
): Promise<FetchQuizResult> {
  try {
    const response = await fetch(`${API_BASE}/api/terrain/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const err = (data as ErrorResponse | null)?.error;
      return {
        ok: false,
        code: err?.code ?? 'UNKNOWN',
        message: err?.message ?? `生成失败 (HTTP ${response.status})`,
      };
    }

    const quiz = (data as { quiz?: TerrainQuiz } | null)?.quiz;
    if (!quiz) {
      return { ok: false, code: 'UNKNOWN', message: '生成服务返回了空响应' };
    }
    return { ok: true, quiz };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, code: 'ABORTED', message: '请求已取消' };
    }
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: '无法连接到生成服务，请检查网络或稍后再试',
    };
  }
}
