import type { TerrainMap } from '../types';

export type TopicState =
  | { kind: 'idle' }
  | { kind: 'loading'; topic: string }
  | { kind: 'success'; topic: string; map: TerrainMap }
  | { kind: 'error'; topic: string; code: string; message: string };

export type TopicAction =
  | { type: 'submit'; topic: string }
  | { type: 'success'; map: TerrainMap }
  | { type: 'error'; code: string; message: string }
  | { type: 'reset' };

export const initialTopicState: TopicState = { kind: 'idle' };

export function topicReducer(state: TopicState, action: TopicAction): TopicState {
  switch (action.type) {
    case 'submit':
      return { kind: 'loading', topic: action.topic };
    case 'success':
      if (state.kind !== 'loading') return state;
      return { kind: 'success', topic: state.topic, map: action.map };
    case 'error':
      if (state.kind !== 'loading') return state;
      return { kind: 'error', topic: state.topic, code: action.code, message: action.message };
    case 'reset':
      return initialTopicState;
  }
}
