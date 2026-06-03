import { useEffect, useReducer, useState } from 'react';
import { topicReducer, type TopicState } from '../store/topic-reducer';
import {
  nodeDetailReducer,
  initialNodeDetailState,
  type NodeDetailState,
} from '../store/node-detail-reducer';
import { quizReducer, initialQuizState } from '../store/quiz-reducer';
import { fetchMap, fetchNodeDetail, fetchQuiz } from '../lib/api';
import { loadSession, saveSession, clearSession } from '../lib/persistence';
import { TopicInputPanel } from '../features/topic-input/TopicInputPanel';
import { TerrainMapCanvas } from '../features/terrain-map/TerrainMapCanvas';
import { NodeDetailPanel } from '../features/node-detail/NodeDetailPanel';
import { currentNodeId, incompletePrereqs } from '../features/terrain-map/layout';

function loadingOrErrorNodeId(state: NodeDetailState): string | null {
  if (state.kind === 'loading' || state.kind === 'error' || state.kind === 'success') {
    return state.nodeId;
  }
  return null;
}

function initialTopicStateFromStorage(): TopicState {
  const persisted = loadSession();
  if (!persisted) return { kind: 'idle' };
  return { kind: 'success', topic: persisted.topic, map: persisted.map };
}

function initialCompletedFromStorage(): Set<string> {
  const persisted = loadSession();
  if (!persisted) return new Set();
  return new Set(persisted.completedNodeIds);
}

export default function App() {
  const [topicState, topicDispatch] = useReducer(
    topicReducer,
    undefined,
    initialTopicStateFromStorage,
  );
  const [detailState, detailDispatch] = useReducer(nodeDetailReducer, initialNodeDetailState);
  const [quizState, quizDispatch] = useReducer(quizReducer, initialQuizState);
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(
    initialCompletedFromStorage,
  );

  useEffect(() => {
    if (topicState.kind === 'success') {
      saveSession({
        topic: topicState.topic,
        map: topicState.map,
        completedNodeIds: [...completedNodeIds],
      });
    }
  }, [topicState, completedNodeIds]);

  const submitTopic = async (topic: string) => {
    topicDispatch({ type: 'submit', topic });
    detailDispatch({ type: 'close' });
    quizDispatch({ type: 'close' });
    setCompletedNodeIds(new Set());
    clearSession();
    const result = await fetchMap(topic);
    if (result.ok) {
      topicDispatch({ type: 'success', map: result.map });
    } else {
      topicDispatch({ type: 'error', code: result.code, message: result.message });
    }
  };

  const retryTopic = () => {
    if (topicState.kind === 'error') void submitTopic(topicState.topic);
  };

  const openDetail = async (nodeId: string, nodeTitle: string) => {
    if (topicState.kind !== 'success') return;
    detailDispatch({ type: 'open', nodeId, nodeTitle });
    quizDispatch({ type: 'close' }); // a fresh node starts with no quiz open
    const result = await fetchNodeDetail({
      topic: topicState.map.topic,
      nodeId,
      nodeTitle,
    });
    if (result.ok) {
      detailDispatch({ type: 'success', nodeId, detail: result.detail });
    } else {
      detailDispatch({ type: 'error', nodeId, code: result.code, message: result.message });
    }
  };

  const startQuiz = async (nodeId: string, nodeTitle: string) => {
    if (topicState.kind !== 'success') return;
    quizDispatch({ type: 'open', nodeId, nodeTitle });
    const result = await fetchQuiz({ topic: topicState.map.topic, nodeId, nodeTitle });
    if (result.ok) {
      quizDispatch({ type: 'success', nodeId, quiz: result.quiz });
    } else {
      quizDispatch({ type: 'error', nodeId, code: result.code, message: result.message });
    }
  };

  const retryQuiz = () => {
    if (quizState.kind === 'error') void startQuiz(quizState.nodeId, quizState.nodeTitle);
  };

  const handleNodeClick = (nodeId: string) => {
    if (topicState.kind !== 'success') return;
    const node = topicState.map.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    void openDetail(nodeId, node.title);
  };

  const retryDetail = () => {
    if (detailState.kind === 'error') void openDetail(detailState.nodeId, detailState.nodeTitle);
  };

  const toggleComplete = (nodeId: string) => {
    setCompletedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const activeNodeId = loadingOrErrorNodeId(detailState);

  const map = topicState.kind === 'success' ? topicState.map : null;
  const currentId = map ? currentNodeId(map, completedNodeIds) : null;
  const openNodeId =
    detailState.kind === 'closed' ? null : detailState.nodeId;
  const prereqHint =
    map && openNodeId
      ? incompletePrereqs(map, openNodeId, completedNodeIds).map((n) => n.title)
      : [];

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Terrain</h1>
        <p className="app-tagline">输入一个学习主题，先看见地图，再走进去。</p>
      </header>

      <TopicInputPanel
        isLoading={topicState.kind === 'loading'}
        onSubmit={(t) => {
          void submitTopic(t);
        }}
      />

      {topicState.kind === 'idle' && (
        <div className="empty-state">
          <p className="empty-state__hint">
            先随便写一个你最近想搞懂、但每次开头都会卡住的事。一句话就好。
          </p>
          <p className="empty-state__suggestions">
            <span className="empty-state__suggestions-label">想不出来？试试：</span>
            <button
              type="button"
              className="empty-state__chip"
              onClick={() => void submitTopic('我想搞懂 Docker')}
            >
              我想搞懂 Docker
            </button>
            <button
              type="button"
              className="empty-state__chip"
              onClick={() => void submitTopic('我想搞懂回归分析')}
            >
              我想搞懂回归分析
            </button>
            <button
              type="button"
              className="empty-state__chip"
              onClick={() => void submitTopic('我想自己冲一杯不难喝的咖啡')}
            >
              我想自己冲一杯不难喝的咖啡
            </button>
          </p>
        </div>
      )}

      {topicState.kind === 'loading' && (
        <p className="status-line">正在生成「{topicState.topic}」的地形图…慢的话喝口水就回来。</p>
      )}

      {topicState.kind === 'error' && (
        <div className="status-block status-error" role="alert">
          <p className="status-error__message">{topicState.message}</p>
          <p className="status-error__hint">不是你的问题。重试一下，或者换个写法再试。</p>
          <button type="button" className="status-error__retry" onClick={retryTopic}>
            重试「{topicState.topic}」
          </button>
        </div>
      )}

      {topicState.kind === 'success' && (
        <section className="map-section">
          <p className="map-position">{topicState.map.userPositionLabel}</p>
          <div className="map-with-detail">
            <TerrainMapCanvas
              map={topicState.map}
              completedNodeIds={completedNodeIds}
              activeNodeId={activeNodeId ?? undefined}
              currentNodeId={currentId ?? undefined}
              onNodeClick={handleNodeClick}
            />
            <NodeDetailPanel
              state={detailState}
              completed={
                detailState.kind === 'success' && completedNodeIds.has(detailState.nodeId)
              }
              prereqHint={prereqHint}
              quizState={quizState}
              onClose={() => {
                detailDispatch({ type: 'close' });
                quizDispatch({ type: 'close' });
              }}
              onRetry={retryDetail}
              onToggleComplete={toggleComplete}
              onStartQuiz={(nodeId, nodeTitle) => void startQuiz(nodeId, nodeTitle)}
              onQuizClose={() => quizDispatch({ type: 'close' })}
              onQuizRetry={retryQuiz}
            />
          </div>
        </section>
      )}
    </main>
  );
}
