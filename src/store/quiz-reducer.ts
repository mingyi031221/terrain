import type { TerrainQuiz } from '../types';

// The quiz is opt-in: it stays 'closed' until the user taps "测一下" on a node,
// then loads on demand. Keyed by nodeId so a stale response for a node the user
// already navigated away from is ignored.
export type QuizState =
  | { kind: 'closed' }
  | { kind: 'loading'; nodeId: string; nodeTitle: string }
  | { kind: 'success'; nodeId: string; quiz: TerrainQuiz }
  | { kind: 'error'; nodeId: string; nodeTitle: string; code: string; message: string };

export type QuizAction =
  | { type: 'open'; nodeId: string; nodeTitle: string }
  | { type: 'success'; nodeId: string; quiz: TerrainQuiz }
  | { type: 'error'; nodeId: string; code: string; message: string }
  | { type: 'close' };

export const initialQuizState: QuizState = { kind: 'closed' };

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'open':
      return { kind: 'loading', nodeId: action.nodeId, nodeTitle: action.nodeTitle };

    case 'success': {
      if (state.kind === 'loading' && state.nodeId === action.nodeId) {
        return { kind: 'success', nodeId: action.nodeId, quiz: action.quiz };
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
