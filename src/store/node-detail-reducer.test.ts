import { describe, it, expect } from 'vitest';
import {
  nodeDetailReducer,
  initialNodeDetailState,
  type NodeDetailState,
} from './node-detail-reducer';
import type { TerrainNodeDetail } from '../types';

function buildDetail(nodeId = 'node-2'): TerrainNodeDetail {
  return {
    nodeId,
    title: '什么是镜像',
    explanation:
      '这一段在讲的是：镜像就是一份打包好的环境快照，可以反复拿来开新的容器。像冷冻便当随时拿出来加热都一样。',
    whyThisMatters: '弄清这件事，后面看 docker run 的输出会突然知道在指哪一层。',
    reflectionPrompt: '你上次想"重新来一遍干净环境"的时候是怎么做的？',
    suggestedNextNodeIds: [],
  };
}

describe('nodeDetailReducer', () => {
  it('initial state is closed', () => {
    expect(initialNodeDetailState).toEqual({ kind: 'closed' });
  });

  it('open transitions to loading', () => {
    const next = nodeDetailReducer(
      { kind: 'closed' },
      { type: 'open', nodeId: 'node-2', nodeTitle: '什么是镜像' },
    );
    expect(next).toEqual({ kind: 'loading', nodeId: 'node-2', nodeTitle: '什么是镜像' });
  });

  it('open overrides any previous state (single-select)', () => {
    const prev: NodeDetailState = { kind: 'success', nodeId: 'node-1', detail: buildDetail('node-1') };
    const next = nodeDetailReducer(prev, { type: 'open', nodeId: 'node-5', nodeTitle: 'X' });
    expect(next).toEqual({ kind: 'loading', nodeId: 'node-5', nodeTitle: 'X' });
  });

  it('success transitions loading to success when nodeId matches', () => {
    const detail = buildDetail();
    const next = nodeDetailReducer(
      { kind: 'loading', nodeId: 'node-2', nodeTitle: '什么是镜像' },
      { type: 'success', nodeId: 'node-2', detail },
    );
    expect(next).toEqual({ kind: 'success', nodeId: 'node-2', detail });
  });

  it('stale success (different nodeId) is ignored', () => {
    const loading: NodeDetailState = { kind: 'loading', nodeId: 'node-5', nodeTitle: 'X' };
    const next = nodeDetailReducer(loading, {
      type: 'success',
      nodeId: 'node-2',
      detail: buildDetail('node-2'),
    });
    expect(next).toBe(loading);
  });

  it('error transitions loading to error with same nodeId', () => {
    const next = nodeDetailReducer(
      { kind: 'loading', nodeId: 'node-2', nodeTitle: '什么是镜像' },
      { type: 'error', nodeId: 'node-2', code: 'LLM_UNAVAILABLE', message: 'oops' },
    );
    expect(next).toEqual({
      kind: 'error',
      nodeId: 'node-2',
      nodeTitle: '什么是镜像',
      code: 'LLM_UNAVAILABLE',
      message: 'oops',
    });
  });

  it('stale error is ignored', () => {
    const loading: NodeDetailState = { kind: 'loading', nodeId: 'node-5', nodeTitle: 'X' };
    const next = nodeDetailReducer(loading, {
      type: 'error',
      nodeId: 'node-2',
      code: 'c',
      message: 'm',
    });
    expect(next).toBe(loading);
  });

  it('close returns to closed from any state', () => {
    expect(nodeDetailReducer({ kind: 'success', nodeId: 'n', detail: buildDetail() }, { type: 'close' })).toEqual({
      kind: 'closed',
    });
    expect(
      nodeDetailReducer(
        { kind: 'error', nodeId: 'n', nodeTitle: 't', code: 'c', message: 'm' },
        { type: 'close' },
      ),
    ).toEqual({ kind: 'closed' });
  });
});
