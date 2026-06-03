// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TerrainMapCanvas } from './TerrainMapCanvas';
import type { TerrainMap } from '../../types';

afterEach(() => cleanup());

function buildMap(): TerrainMap {
  return {
    version: '1.0',
    topic: 'Docker',
    generatedAt: '2026-05-28T00:00:00.000Z',
    userPositionLabel: '入门',
    nodes: Array.from({ length: 5 }, (_, i) => ({
      id: `node-${i + 1}`,
      title: `节点 ${i + 1}`,
      summary: 's',
      difficulty: 2,
      estimatedMinutes: 30,
      required: i < 3,
    })),
    edges: [{ from: 'node-1', to: 'node-2', kind: 'prerequisite' }],
  };
}

describe('TerrainMapCanvas', () => {
  it('renders one node group per map node', () => {
    render(<TerrainMapCanvas map={buildMap()} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`map-node-node-${i}`)).toBeTruthy();
    }
  });

  it('renders node titles as text', () => {
    render(<TerrainMapCanvas map={buildMap()} />);
    expect(screen.getByText('节点 1')).toBeTruthy();
    expect(screen.getByText('节点 5')).toBeTruthy();
  });

  it('calls onNodeClick with the clicked node id (after the cat walks over)', async () => {
    const onNodeClick = vi.fn();
    render(<TerrainMapCanvas map={buildMap()} onNodeClick={onNodeClick} />);
    fireEvent.click(screen.getByTestId('map-node-node-2'));
    await waitFor(() => expect(onNodeClick).toHaveBeenCalledWith('node-2'));
  });

  it('marks the topic on the svg aria-label', () => {
    render(<TerrainMapCanvas map={buildMap()} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('aria-label')).toContain('Docker');
  });
});
