// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TopicInputPanel } from './TopicInputPanel';

afterEach(() => cleanup());

describe('TopicInputPanel', () => {
  it('disables submit when input is empty', () => {
    render(<TopicInputPanel isLoading={false} onSubmit={vi.fn()} />);
    const button = screen.getByRole('button');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables submit once topic is typed', () => {
    render(<TopicInputPanel isLoading={false} onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('学习主题');
    fireEvent.change(input, { target: { value: 'Docker' } });
    const button = screen.getByRole('button');
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onSubmit with trimmed value when submitted', () => {
    const onSubmit = vi.fn();
    render(<TopicInputPanel isLoading={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('学习主题'), {
      target: { value: '  Docker  ' },
    });
    fireEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Docker');
  });

  it('does not submit a whitespace-only topic', () => {
    const onSubmit = vi.fn();
    render(<TopicInputPanel isLoading={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('学习主题'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables input and shows loading label while isLoading', () => {
    render(<TopicInputPanel isLoading={true} onSubmit={vi.fn()} initialValue="Docker" />);
    const input = screen.getByLabelText('学习主题');
    const button = screen.getByRole('button');
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.textContent).toContain('生成中');
  });
});
