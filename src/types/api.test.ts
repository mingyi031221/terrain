import { describe, it, expect } from 'vitest';
import { MapRequestSchema, NodeDetailRequestSchema, ErrorResponseSchema } from './api';

describe('MapRequestSchema', () => {
  it('accepts non-empty topic', () => {
    expect(MapRequestSchema.safeParse({ topic: 'Docker' }).success).toBe(true);
  });

  it('rejects empty topic', () => {
    expect(MapRequestSchema.safeParse({ topic: '' }).success).toBe(false);
  });

  it('rejects missing topic', () => {
    expect(MapRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('NodeDetailRequestSchema', () => {
  it('accepts a complete request', () => {
    expect(
      NodeDetailRequestSchema.safeParse({
        topic: 'Docker',
        nodeId: 'n1',
        nodeTitle: '容器与镜像',
      }).success,
    ).toBe(true);
  });

  it('rejects missing nodeId', () => {
    expect(
      NodeDetailRequestSchema.safeParse({
        topic: 'Docker',
        nodeTitle: '容器与镜像',
      }).success,
    ).toBe(false);
  });
});

describe('ErrorResponseSchema', () => {
  it('accepts a known code', () => {
    expect(
      ErrorResponseSchema.safeParse({
        error: { code: 'MAP_GENERATION_FAILED', message: 'oops' },
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown code', () => {
    expect(
      ErrorResponseSchema.safeParse({
        error: { code: 'UNKNOWN_THING', message: 'oops' },
      }).success,
    ).toBe(false);
  });

  it('rejects missing message', () => {
    expect(
      ErrorResponseSchema.safeParse({
        error: { code: 'MAP_GENERATION_FAILED' },
      }).success,
    ).toBe(false);
  });
});
