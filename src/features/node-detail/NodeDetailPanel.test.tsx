// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NodeDetailPanel } from './NodeDetailPanel';
import type { NodeDetailState } from '../../store/node-detail-reducer';
import type { TerrainNodeDetail } from '../../types';

afterEach(() => cleanup());

function buildDetail(): TerrainNodeDetail {
  return {
    nodeId: 'node-2',
    title: '什么是镜像',
    explanation:
      '这一段在讲的是：镜像就是一份打包好的环境快照，可以反复拿来开新的容器。像冷冻便当，随时拿出来加热都一样。',
    whyThisMatters: '弄清这件事，后面看 docker run 的输出会突然知道在指哪一层。',
    reflectionPrompt: '你上次想"重新来一遍干净环境"的时候是怎么做的？',
    suggestedNextNodeIds: [],
  };
}

const noop = () => {};

describe('NodeDetailPanel', () => {
  it('renders nothing when state is closed', () => {
    const { container } = render(
      <NodeDetailPanel
        state={{ kind: 'closed' }}
        completed={false}
        onClose={noop}
        onRetry={noop}
        onToggleComplete={noop}
      />,
    );
    expect(container.querySelector('.node-detail-panel')).toBeNull();
  });

  it('renders loading state with the title', () => {
    const state: NodeDetailState = {
      kind: 'loading',
      nodeId: 'node-2',
      nodeTitle: '什么是镜像',
    };
    render(
      <NodeDetailPanel
        state={state}
        completed={false}
        onClose={noop}
        onRetry={noop}
        onToggleComplete={noop}
      />,
    );
    expect(screen.getByText(/正在写/)).toBeTruthy();
    expect(screen.getAllByText(/什么是镜像/).length).toBeGreaterThan(0);
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    const state: NodeDetailState = {
      kind: 'error',
      nodeId: 'node-2',
      nodeTitle: '什么是镜像',
      code: 'LLM_UNAVAILABLE',
      message: '生成服务暂时不可用',
    };
    render(
      <NodeDetailPanel
        state={state}
        completed={false}
        onClose={noop}
        onRetry={onRetry}
        onToggleComplete={noop}
      />,
    );
    expect(screen.getByText('生成服务暂时不可用')).toBeTruthy();
    fireEvent.click(screen.getByText('重试'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders success state with all three sections', () => {
    const detail = buildDetail();
    const state: NodeDetailState = { kind: 'success', nodeId: 'node-2', detail };
    render(
      <NodeDetailPanel
        state={state}
        completed={false}
        onClose={noop}
        onRetry={noop}
        onToggleComplete={noop}
      />,
    );
    expect(screen.getByText(detail.explanation)).toBeTruthy();
    expect(screen.getByText(detail.whyThisMatters)).toBeTruthy();
    expect(screen.getByText(detail.reflectionPrompt)).toBeTruthy();
    expect(screen.getByText('为什么爬这一段')).toBeTruthy();
    expect(screen.getByText('挂个钩子')).toBeTruthy();
  });

  it('close button fires onClose', () => {
    const onClose = vi.fn();
    const state: NodeDetailState = { kind: 'success', nodeId: 'node-2', detail: buildDetail() };
    render(
      <NodeDetailPanel
        state={state}
        completed={false}
        onClose={onClose}
        onRetry={noop}
        onToggleComplete={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText('关闭节点详情'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows opt-in quiz button that fires onStartQuiz (no auto-generation)', () => {
    const onStartQuiz = vi.fn();
    const state: NodeDetailState = { kind: 'success', nodeId: 'node-2', detail: buildDetail() };
    render(
      <NodeDetailPanel
        state={state}
        completed={false}
        quizState={{ kind: 'closed' }}
        onClose={noop}
        onRetry={noop}
        onToggleComplete={noop}
        onStartQuiz={onStartQuiz}
      />,
    );
    fireEvent.click(screen.getByText(/测一下/));
    expect(onStartQuiz).toHaveBeenCalledWith('node-2', '什么是镜像');
  });

  it('toggle-complete button fires with nodeId, switches label based on completed prop', () => {
    const onToggle = vi.fn();
    const state: NodeDetailState = { kind: 'success', nodeId: 'node-2', detail: buildDetail() };
    const { rerender } = render(
      <NodeDetailPanel
        state={state}
        completed={false}
        onClose={noop}
        onRetry={noop}
        onToggleComplete={onToggle}
      />,
    );
    fireEvent.click(screen.getByText('我爬过这一段了'));
    expect(onToggle).toHaveBeenCalledWith('node-2');

    rerender(
      <NodeDetailPanel
        state={state}
        completed={true}
        onClose={noop}
        onRetry={noop}
        onToggleComplete={onToggle}
      />,
    );
    expect(screen.getByText(/已爬过/)).toBeTruthy();
  });
});
