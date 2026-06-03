import { describe, it, expect } from 'vitest';
import { quizReducer, initialQuizState, type QuizState } from './quiz-reducer';
import type { TerrainQuiz } from '../types';

function buildQuiz(nodeId = 'node-2'): TerrainQuiz {
  return {
    nodeId,
    questions: [
      {
        type: 'truefalse',
        question: '镜像是只读模板。',
        options: ['对', '错'],
        answerIndex: 0,
        explanation: '对，镜像是只读的。',
      },
      {
        type: 'choice',
        question: '哪个更接近？',
        options: ['A 快照', 'B 一样', 'C 更早'],
        answerIndex: 0,
        explanation: '其实是快照。',
      },
    ],
  };
}

describe('quizReducer', () => {
  it('starts closed', () => {
    expect(initialQuizState).toEqual({ kind: 'closed' });
  });

  it('open → loading', () => {
    const next = quizReducer(initialQuizState, {
      type: 'open',
      nodeId: 'node-2',
      nodeTitle: '镜像',
    });
    expect(next).toEqual({ kind: 'loading', nodeId: 'node-2', nodeTitle: '镜像' });
  });

  it('loading → success on matching nodeId', () => {
    const loading: QuizState = { kind: 'loading', nodeId: 'node-2', nodeTitle: '镜像' };
    const next = quizReducer(loading, { type: 'success', nodeId: 'node-2', quiz: buildQuiz() });
    expect(next.kind).toBe('success');
    if (next.kind === 'success') expect(next.quiz.questions).toHaveLength(2);
  });

  it('ignores success for a different (stale) nodeId', () => {
    const loading: QuizState = { kind: 'loading', nodeId: 'node-2', nodeTitle: '镜像' };
    const next = quizReducer(loading, {
      type: 'success',
      nodeId: 'node-9',
      quiz: buildQuiz('node-9'),
    });
    expect(next).toBe(loading);
  });

  it('loading → error keeps nodeTitle', () => {
    const loading: QuizState = { kind: 'loading', nodeId: 'node-2', nodeTitle: '镜像' };
    const next = quizReducer(loading, {
      type: 'error',
      nodeId: 'node-2',
      code: 'LLM_UNAVAILABLE',
      message: 'boom',
    });
    expect(next).toMatchObject({ kind: 'error', nodeId: 'node-2', nodeTitle: '镜像' });
  });

  it('close → closed from any state', () => {
    const success: QuizState = { kind: 'success', nodeId: 'node-2', quiz: buildQuiz() };
    expect(quizReducer(success, { type: 'close' })).toEqual({ kind: 'closed' });
  });
});
