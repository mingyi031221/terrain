import type { TerrainNodeDetail } from '../types';

export type NodeDetailState =
  | { kind: 'closed' }
  | { kind: 'loading'; nodeId: string; nodeTitle: string }
  | { kind: 'success'; nodeId: string; detail: TerrainNodeDetail }
  | { kind: 'error'; nodeId: string; nodeTitle: string; code: string; message: string };

export type NodeDetailAction =
  | { type: 'open'; nodeId: string; nodeTitle: string }
  | { type: 'success'; nodeId: string; detail: TerrainNodeDetail }
  | { type: 'error'; nodeId: string; code: string; message: string }
  | { type: 'close' };

export const initialNodeDetailState: NodeDetailState = { kind: 'closed' };

function currentNodeTitle(state: NodeDetailState): string | null {
  if (state.kind === 'loading' || state.kind === 'error') return state.nodeTitle;
  if (state.kind === 'success') return state.detail.title;
  return null;
}

export function nodeDetailReducer(
  state: NodeDetailState,
  action: NodeDetailAction,
): NodeDetailState {
  switch (action.type) {
    case 'open':
      return { kind: 'loading', nodeId: action.nodeId, nodeTitle: action.nodeTitle };

    case 'success': {
      if (state.kind === 'loading' && state.nodeId === action.nodeId) {
        return { kind: 'success', nodeId: action.nodeId, detail: action.detail };
      }
      return state;
    }

    case 'error': {
      if (state.kind === 'loading' && state.nodeId === action.nodeId) {
        return {
          kind: 'error',
          nodeId: action.nodeId,
          nodeTitle: state.nodeTitle,
          code: action.code,
          message: action.message,
        };
      }
      return state;
    }

    case 'close':
      return { kind: 'closed' };
  }
}

export { currentNodeTitle };
