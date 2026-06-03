import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chatComplete, LLMUnavailableError } from './llm-client';

function mockJsonResponse(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

function mockTextResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

describe('chatComplete', () => {
  beforeEach(() => {
    vi.stubEnv('LLM_API_BASE_URL', 'https://example.test/v1');
    vi.stubEnv('LLM_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns content on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse('hello'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatComplete({
      model: 'qwen-plus',
      systemPrompt: 'sys',
      userPrompt: 'usr',
    });

    expect(result).toBe('hello');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws config error when API key missing', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('LLM_API_BASE_URL', 'https://example.test/v1');

    await expect(
      chatComplete({ model: 'm', systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toMatchObject({ kind: 'config' });
  });

  it('does not retry on 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockTextResponse('unauthorized', 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      chatComplete({ model: 'm', systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toMatchObject({ kind: 'client', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on 5xx then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockTextResponse('boom', 503))
      .mockResolvedValueOnce(mockJsonResponse('recovered'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatComplete({ model: 'm', systemPrompt: 's', userPrompt: 'u' });
    expect(result).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after 5xx twice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockTextResponse('boom', 503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      chatComplete({ model: 'm', systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toMatchObject({ kind: 'server' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on network error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(mockJsonResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatComplete({ model: 'm', systemPrompt: 's', userPrompt: 'u' });
    expect(result).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws empty error when content missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      chatComplete({ model: 'm', systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toMatchObject({ kind: 'empty' });
  });

  it('includes response_format when jsonMode=true', async () => {
    let capturedBody: unknown;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return Promise.resolve(mockJsonResponse('ok'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await chatComplete({
      model: 'm',
      systemPrompt: 's',
      userPrompt: 'u',
      jsonMode: true,
    });

    expect(capturedBody).toMatchObject({
      response_format: { type: 'json_object' },
    });
  });

  it('exports LLMUnavailableError as a class', () => {
    const err = new LLMUnavailableError('network', 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err.kind).toBe('network');
  });
});
