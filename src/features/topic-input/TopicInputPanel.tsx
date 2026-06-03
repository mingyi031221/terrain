import { useState } from 'react';

interface Props {
  isLoading: boolean;
  onSubmit: (topic: string) => void;
  initialValue?: string;
}

export function TopicInputPanel({ isLoading, onSubmit, initialValue = '' }: Props) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const canSubmit = !isLoading && trimmed.length > 0;

  return (
    <form
      className="topic-input-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(trimmed);
      }}
    >
      <input
        type="text"
        className="topic-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="我想搞懂..."
        disabled={isLoading}
        aria-label="学习主题"
      />
      <button type="submit" className="topic-submit" disabled={!canSubmit}>
        {isLoading ? '生成中…' : '生成地图'}
      </button>
    </form>
  );
}
