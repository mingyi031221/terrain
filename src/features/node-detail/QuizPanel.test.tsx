// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { QuizPanel } from './QuizPanel';
import type { QuizState } from '../../store/quiz-reducer';
import type { TerrainQuiz } from '../../types';

afterEach(() => cleanup());

const noop = () => {};

function quiz(): TerrainQuiz {
  return {
    nodeId: 'node-2',
    questions: [
      {
        type: 'truefalse',
        question: '镜像是只读模板。',
        options: ['对', '错'],
        answerIndex: 0,
        explanation: '对，镜像是只读的，容器才是跑起来的实例。',
      },
      {
        type: 'choice',
        question: '哪个更接近实际？',
        options: ['镜像是快照，容器基于它启动', '两者一样', '容器更早出现'],
        answerIndex: 0,
        explanation: '其实容器是镜像跑起来的那一份。',
      },
    ],
  };
}

describe('QuizPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <QuizPanel state={{ kind: 'closed' }} nodeTitle="镜像" onClose={noop} onRetry={noop} />,
    );
    expect(container.querySelector('.quiz')).toBeNull();
  });

  it('shows a non-exam framing and a skip control', () => {
    const state: QuizState = { kind: 'loading', nodeId: 'node-2', nodeTitle: '镜像' };
    render(<QuizPanel state={state} nodeTitle="镜像" onClose={noop} onRetry={noop} />);
    expect(screen.getByText('看看你 get 到了没')).toBeTruthy();
    expect(screen.getByText('先不测了')).toBeTruthy();
    expect(screen.getByText(/不是考试/)).toBeTruthy();
  });

  it('reveals correct answer + explanation after picking (gentle, no red ✗)', () => {
    const state: QuizState = { kind: 'success', nodeId: 'node-2', quiz: quiz() };
    render(<QuizPanel state={state} nodeTitle="镜像和容器" onClose={noop} onRetry={noop} />);
    // answer Q1 correctly ("对")
    fireEvent.click(screen.getByText('对'));
    expect(screen.getByText(/对，镜像是只读的/)).toBeTruthy();
  });

  it('on a wrong pick, points gently back to the node, and scores encouragingly', () => {
    const state: QuizState = { kind: 'success', nodeId: 'node-2', quiz: quiz() };
    render(<QuizPanel state={state} nodeTitle="镜像和容器" onClose={noop} onRetry={noop} />);
    // Q1 wrong ("错")
    fireEvent.click(screen.getByText('错'));
    expect(screen.getByText(/这块对应「镜像和容器」那座/)).toBeTruthy();
    // Q2 wrong ("两者一样")
    fireEvent.click(screen.getByText('两者一样'));
    // score appears once all answered, framed encouragingly, never punishing
    expect(screen.getByText(/你 get 到了 0\/2/)).toBeTruthy();
    expect(screen.getByText(/没关系/)).toBeTruthy();
  });

  it('fires onClose from the skip control', () => {
    const onClose = vi.fn();
    const state: QuizState = { kind: 'success', nodeId: 'node-2', quiz: quiz() };
    render(<QuizPanel state={state} nodeTitle="镜像" onClose={onClose} onRetry={noop} />);
    fireEvent.click(screen.getByText('先不测了'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows retry on error', () => {
    const onRetry = vi.fn();
    const state: QuizState = {
      kind: 'error',
      nodeId: 'node-2',
      nodeTitle: '镜像',
      code: 'LLM_UNAVAILABLE',
      message: '生成服务暂时不可用',
    };
    render(<QuizPanel state={state} nodeTitle="镜像" onClose={noop} onRetry={onRetry} />);
    const panel = screen.getByLabelText('看看你 get 到了没');
    fireEvent.click(within(panel).getByText('再试一次'));
    expect(onRetry).toHaveBeenCalled();
  });
});
