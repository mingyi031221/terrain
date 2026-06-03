export type LLMErrorKind = 'network' | 'server' | 'client' | 'aborted' | 'config' | 'empty';

export class LLMUnavailableError extends Error {
  constructor(
    public kind: LLMErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'LLMUnavailableError';
  }
}

export interface ChatCompleteOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_BACKOFF_MS = 500;

export async function chatComplete(opts: ChatCompleteOptions): Promise<string> {
  const baseUrl = process.env.LLM_API_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  if (!baseUrl) throw new LLMUnavailableError('config', 'LLM_API_BASE_URL not set');
  if (!apiKey) throw new LLMUnavailableError('config', 'LLM_API_KEY not set');

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    return await performOnce(url, body, apiKey, timeoutMs, opts.signal);
  } catch (err) {
    if (shouldRetry(err)) {
      await sleep(RETRY_BACKOFF_MS);
      return await performOnce(url, body, apiKey, timeoutMs, opts.signal);
    }
    throw err;
  }
}

function shouldRetry(err: unknown): boolean {
  return err instanceof LLMUnavailableError && (err.kind === 'network' || err.kind === 'server');
}

async function performOnce(
  url: string,
  body: unknown,
  apiKey: string,
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const kind: LLMErrorKind = response.status >= 500 ? 'server' : 'client';
      throw new LLMUnavailableError(kind, `LLM API HTTP ${response.status}`, response.status);
    }

    const data: unknown = await response.json();
    const content = extractContent(data);
    if (content === null || content.length === 0) {
      throw new LLMUnavailableError('empty', 'LLM API returned empty content');
    }
    return content;
  } catch (err) {
    if (err instanceof LLMUnavailableError) throw err;
    if (externalSignal?.aborted) {
      throw new LLMUnavailableError('aborted', 'request aborted by caller');
    }
    if (controller.signal.aborted) {
      throw new LLMUnavailableError('network', `LLM API timeout after ${timeoutMs}ms`);
    }
    throw new LLMUnavailableError(
      'network',
      `LLM API network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function extractContent(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
