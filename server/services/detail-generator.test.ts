import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateNodeDetail, NodeDetailGenerationError } from './detail-generator';
import { chatComplete } from './llm-client';

vi.mock('./llm-client', () => ({
  chatComplete: vi.fn(),
  LLMUnavailableError: class LLMUnavailableError extends Error {
    constructor(
      public kind: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const mockedChatComplete = vi.mocked(chatComplete);

function validDetail(nodeId = 'node-2') {
  return {
    nodeId,
    title: '什么是镜像',
    explanation:
      '这一段在讲的是：镜像就是一份打包好的环境快照，你可以反复用它来开新的容器。可以把它想象成一个冷冻便当——你随时拿出来加热，每次味道都一样。',
    whyThisMatters: '弄清楚镜像和容器的关系，后面看到 docker run 的输出你会突然知道在指哪一层。',
    reflectionPrompt: '你上次想"重新来一遍干净环境"的时候，是怎么做的？',
    suggestedNextNodeIds: [],
  };
}

describe('generateNodeDetail', () => {
  beforeEach(() => {
    mockedChatComplete.mockReset();
  });

  const input = { topic: 'Docker', nodeId: 'node-2', nodeTitle: '什么是镜像' };

  it('returns detail on first valid response', async () => {
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validDetail()));
    const detail = await generateNodeDetail(input);
    expect(detail.nodeId).toBe('node-2');
    expect(detail.title).toBe('什么是镜像');
    expect(detail.suggestedNextNodeIds).toEqual([]);
    expect(mockedChatComplete).toHaveBeenCalledTimes(1);
  });

  it('retries once on invalid JSON then succeeds', async () => {
    mockedChatComplete
      .mockResolvedValueOnce('not json {')
      .mockResolvedValueOnce(JSON.stringify(validDetail()));
    const detail = await generateNodeDetail(input);
    expect(detail.nodeId).toBe('node-2');
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('retries on schema failure (explanation too short)', async () => {
    mockedChatComplete
      .mockResolvedValueOnce(
        JSON.stringify({
          nodeId: 'node-2',
          title: 'x',
          explanation: '太短',
          whyThisMatters: 'y',
          reflectionPrompt: 'z？',
        }),
      )
      .mockResolvedValueOnce(JSON.stringify(validDetail()));
    const detail = await generateNodeDetail(input);
    expect(detail.nodeId).toBe('node-2');
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('retries when LLM returns mismatched nodeId', async () => {
    mockedChatComplete
      .mockResolvedValueOnce(JSON.stringify(validDetail('node-99')))
      .mockResolvedValueOnce(JSON.stringify(validDetail('node-2')));
    const detail = await generateNodeDetail(input);
    expect(detail.nodeId).toBe('node-2');
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('throws NodeDetailGenerationError after two failed attempts', async () => {
    mockedChatComplete
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify(validDetail('node-99')));
    await expect(generateNodeDetail(input)).rejects.toBeInstanceOf(NodeDetailGenerationError);
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('uses LLM_MODEL_DETAIL env var, default qwen-turbo', async () => {
    vi.stubEnv('LLM_MODEL_DETAIL', 'qwen-detail-test');
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validDetail()));
    await generateNodeDetail(input);
    expect(mockedChatComplete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen-detail-test' }),
    );
    vi.unstubAllEnvs();
  });

  it('passes signal through to chatComplete', async () => {
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validDetail()));
    const controller = new AbortController();
    await generateNodeDetail(input, { signal: controller.signal });
    expect(mockedChatComplete).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('includes failure reason in retry prompt', async () => {
    mockedChatComplete
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify(validDetail()));
    await generateNodeDetail(input);
    const secondCall = mockedChatComplete.mock.calls[1][0];
    expect(secondCall.userPrompt).toContain('上次返回出错');
    expect(secondCall.userPrompt).toContain('JSON parse failed');
  });

  it('renders topic / nodeId / nodeTitle into prompt', async () => {
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validDetail('node-42')));
    await generateNodeDetail({ topic: 'TopicX', nodeId: 'node-42', nodeTitle: 'TitleY' });
    const first = mockedChatComplete.mock.calls[0][0];
    expect(first.userPrompt).toContain('TopicX');
    expect(first.userPrompt).toContain('node-42');
    expect(first.userPrompt).toContain('TitleY');
  });

  it('defaults suggestedNextNodeIds to [] when LLM omits it', async () => {
    const omitted = validDetail();
    delete (omitted as Record<string, unknown>).suggestedNextNodeIds;
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(omitted));
    const detail = await generateNodeDetail(input);
    expect(detail.suggestedNextNodeIds).toEqual([]);
  });
});
