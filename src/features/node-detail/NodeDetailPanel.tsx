import type { NodeDetailState } from '../../store/node-detail-reducer';
import type { QuizState } from '../../store/quiz-reducer';
import { QuizPanel } from './QuizPanel';

interface Props {
  state: NodeDetailState;
  completed: boolean;
  /** Titles of not-yet-completed prerequisites — drives the gentle hint, never a lock. */
  prereqHint?: string[];
  quizState?: QuizState;
  onClose: () => void;
  onRetry: () => void;
  onToggleComplete: (nodeId: string) => void;
  onStartQuiz?: (nodeId: string, nodeTitle: string) => void;
  onQuizClose?: () => void;
  onQuizRetry?: () => void;
}

export function NodeDetailPanel({
  state,
  completed,
  prereqHint = [],
  quizState = { kind: 'closed' },
  onClose,
  onRetry,
  onToggleComplete,
  onStartQuiz = () => {},
  onQuizClose = () => {},
  onQuizRetry = () => {},
}: Props) {
  if (state.kind === 'closed') return null;

  const showHint = prereqHint.length > 0;
  const hintNames = prereqHint.map((t) => `「${t}」`).join('、');

  return (
    <aside
      className={`node-detail-panel node-detail-panel--${state.kind}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="node-detail-title"
    >
      <header className="node-detail-panel__header">
        <h2 id="node-detail-title" className="node-detail-panel__title">
          {state.kind === 'success' ? state.detail.title : state.nodeTitle}
        </h2>
        <button
          type="button"
          className="node-detail-panel__close"
          onClick={onClose}
          aria-label="关闭节点详情"
        >
          ×
        </button>
      </header>

      {showHint && (
        <p className="node-detail-panel__hint" role="note">
          先爬过{hintNames}会更顺，不过现在看看也完全可以 ✨
        </p>
      )}

      {state.kind === 'loading' && (
        <p className="node-detail-panel__loading">正在写「{state.nodeTitle}」这一段…</p>
      )}

      {state.kind === 'error' && (
        <div className="node-detail-panel__error" role="alert">
          <p>{state.message}</p>
          <button type="button" className="node-detail-panel__retry" onClick={onRetry}>
            重试
          </button>
        </div>
      )}

      {state.kind === 'success' && (
        <div className="node-detail-panel__body">
          <section className="node-detail-panel__section">
            <p className="node-detail-panel__text">{state.detail.explanation}</p>
          </section>

          <section
            className="node-detail-panel__section node-detail-panel__section--why"
            aria-label="为什么爬这一段"
          >
            <h3 className="node-detail-panel__subhead">为什么爬这一段</h3>
            <p className="node-detail-panel__text">{state.detail.whyThisMatters}</p>
          </section>

          <section
            className="node-detail-panel__section node-detail-panel__section--reflect"
            aria-label="挂个钩子"
          >
            <h3 className="node-detail-panel__subhead">挂个钩子</h3>
            <p className="node-detail-panel__text node-detail-panel__text--reflect">
              {state.detail.reflectionPrompt}
            </p>
          </section>

          <footer className="node-detail-panel__footer">
            <button
              type="button"
              className={
                completed
                  ? 'node-detail-panel__complete node-detail-panel__complete--done'
                  : 'node-detail-panel__complete'
              }
              onClick={() => onToggleComplete(state.detail.nodeId)}
            >
              {completed ? '已爬过 ✓ 点这里取消' : '我爬过这一段了'}
            </button>

            {quizState.kind === 'closed' && (
              <button
                type="button"
                className="node-detail-panel__quiz-start"
                onClick={() => onStartQuiz(state.detail.nodeId, state.detail.title)}
              >
                测一下 · 看看你 get 到了没
              </button>
            )}
          </footer>

          <QuizPanel
            state={quizState}
            nodeTitle={state.detail.title}
            onClose={onQuizClose}
            onRetry={onQuizRetry}
          />
        </div>
      )}
    </aside>
  );
}
