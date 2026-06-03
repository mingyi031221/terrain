import { useState } from 'react';
import type { QuizState } from '../../store/quiz-reducer';
import type { TerrainQuiz } from '../../types';

interface Props {
  state: QuizState;
  /** Current node title — used for the gentle "回头看看那座山" pointer on a miss. */
  nodeTitle: string;
  onClose: () => void;
  onRetry: () => void;
}

export function QuizPanel({ state, nodeTitle, onClose, onRetry }: Props) {
  if (state.kind === 'closed') return null;

  return (
    <section className="quiz" aria-label="看看你 get 到了没">
      <header className="quiz__header">
        <h3 className="quiz__title">看看你 get 到了没</h3>
        <button type="button" className="quiz__dismiss" onClick={onClose}>
          先不测了
        </button>
      </header>

      {state.kind === 'loading' && (
        <p className="quiz__loading">在出几道小题…不是考试，随便看看就好。</p>
      )}

      {state.kind === 'error' && (
        <div className="quiz__error" role="alert">
          <p>{state.message}</p>
          <button type="button" className="quiz__retry" onClick={onRetry}>
            再试一次
          </button>
        </div>
      )}

      {state.kind === 'success' && <QuizQuestions quiz={state.quiz} nodeTitle={nodeTitle} />}
    </section>
  );
}

function encouragement(correct: number, total: number): string {
  if (correct === total) return '全中，这块你是真 get 到了。';
  if (correct === 0) return '没关系，能停下来想一遍，就已经在往上爬了。';
  return '没全中也完全没关系——能想一遍就已经赚到。';
}

function QuizQuestions({ quiz, nodeTitle }: { quiz: TerrainQuiz; nodeTitle: string }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const total = quiz.questions.length;
  const answeredCount = Object.keys(picked).length;
  const correctCount = quiz.questions.reduce(
    (acc, q, i) => acc + (picked[i] === q.answerIndex ? 1 : 0),
    0,
  );

  return (
    <div className="quiz__body">
      {quiz.questions.map((q, i) => {
        const selected = picked[i];
        const locked = selected !== undefined;
        const isCorrect = locked && selected === q.answerIndex;

        return (
          <div className="quiz-q" key={i}>
            <p className="quiz-q__stem">
              <span className="quiz-q__num">{i + 1}.</span> {q.question}
            </p>
            <ul className="quiz-q__options">
              {q.options.map((opt, oi) => {
                const optClass = [
                  'quiz-q__option',
                  locked && oi === q.answerIndex ? 'quiz-q__option--answer' : '',
                  locked && oi === selected && !isCorrect ? 'quiz-q__option--picked' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li key={oi}>
                    <button
                      type="button"
                      className={optClass}
                      disabled={locked}
                      onClick={() => setPicked((prev) => ({ ...prev, [i]: oi }))}
                    >
                      <span className="quiz-q__option-text">{opt}</span>
                      {locked && oi === q.answerIndex && (
                        <span className="quiz-q__tag quiz-q__tag--answer">✓</span>
                      )}
                      {locked && oi === selected && !isCorrect && (
                        <span className="quiz-q__tag quiz-q__tag--picked">你选的</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {locked && (
              <p className={isCorrect ? 'quiz-fb quiz-fb--ok' : 'quiz-fb quiz-fb--soft'}>
                <span className="quiz-fb__lead">{isCorrect ? '✨ 对了：' : '🌱 这题容易混：'}</span>
                {q.explanation}
                {!isCorrect && (
                  <span className="quiz-fb__pointer">
                    {' '}
                    这块对应「{nodeTitle}」那座，回头再扫一眼？
                  </span>
                )}
              </p>
            )}
          </div>
        );
      })}

      {answeredCount === total && (
        <p className="quiz__score">
          你 get 到了 {correctCount}/{total} ✨ {encouragement(correctCount, total)}
        </p>
      )}
    </div>
  );
}
