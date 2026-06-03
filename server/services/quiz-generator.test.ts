import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateQuiz, QuizGenerationError } from './quiz-generator';
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

function validQuiz(nodeId = 'node-2') {
  return {
    nodeId,
    questions: [
      {
        type: 'truefalse',
        question: '镜像是只读的模板，容器是它跑起来的实例。',
        options: ['对', '错'],
        answerIndex: 0,
        explanation: '对，镜像像模具，容器是用模具做出来、能动的那一个。',
      },
      {
        type: 'choice',
        question: '下面哪种说法更接近镜像和容器的关系？',
        options: ['镜像是快照，容器是基于它启动的运行环境', '两者完全一样', '容器比镜像更早出现'],
        answerIndex: 0,
        explanation: '这题容易混，其实容器是镜像跑起来的那一份，可以有很多个。',
      },
    ],
  };
}

describe('generateQuiz', () => {
  beforeEach(() => {
    mockedChatComplete.mockReset();
  });

  const input = { topic: 'Docker', nodeId: 'node-2', nodeTitle: '镜像和容器的区别' };

  it('returns quiz on first valid response', async () => {
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validQuiz()));
    const quiz = await generateQuiz(input);
    expect(quiz.nodeId).toBe('node-2');
    expect(quiz.questions).toHaveLength(2);
    expect(quiz.questions[0].type).toBe('truefalse');
    expect(mockedChatComplete).toHaveBeenCalledTimes(1);
  });

  it('retries once on invalid JSON then succeeds', async () => {
    mockedChatComplete
      .mockResolvedValueOnce('not json {')
      .mockResolvedValueOnce(JSON.stringify(validQuiz()));
    const quiz = await generateQuiz(input);
    expect(quiz.nodeId).toBe('node-2');
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('retries on schema failure (answerIndex out of range)', async () => {
    const bad = validQuiz();
    bad.questions[0].answerIndex = 9;
    mockedChatComplete
      .mockResolvedValueOnce(JSON.stringify(bad))
      .mockResolvedValueOnce(JSON.stringify(validQuiz()));
    const quiz = await generateQuiz(input);
    expect(quiz.questions[0].answerIndex).toBe(0);
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('retries on schema failure (truefalse with !=2 options)', async () => {
    const bad = validQuiz();
    bad.questions[0].options = ['对', '错', '不确定'];
    mockedChatComplete
      .mockResolvedValueOnce(JSON.stringify(bad))
      .mockResolvedValueOnce(JSON.stringify(validQuiz()));
    const quiz = await generateQuiz(input);
    expect(quiz.questions[0].options).toEqual(['对', '错']);
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('retries when LLM returns mismatched nodeId', async () => {
    mockedChatComplete
      .mockResolvedValueOnce(JSON.stringify(validQuiz('node-99')))
      .mockResolvedValueOnce(JSON.stringify(validQuiz('node-2')));
    const quiz = await generateQuiz(input);
    expect(quiz.nodeId).toBe('node-2');
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('throws QuizGenerationError after two failed attempts', async () => {
    mockedChatComplete
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify(validQuiz('node-99')));
    await expect(generateQuiz(input)).rejects.toBeInstanceOf(QuizGenerationError);
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('renders topic / nodeId / nodeTitle into prompt', async () => {
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validQuiz('node-42')));
    await generateQuiz({ topic: 'TopicX', nodeId: 'node-42', nodeTitle: 'TitleY' });
    const first = mockedChatComplete.mock.calls[0][0];
    expect(first.userPrompt).toContain('TopicX');
    expect(first.userPrompt).toContain('node-42');
    expect(first.userPrompt).toContain('TitleY');
  });

  it('passes signal through to chatComplete', async () => {
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validQuiz()));
    const controller = new AbortController();
    await generateQuiz(input, { signal: controller.signal });
    expect(mockedChatComplete).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
