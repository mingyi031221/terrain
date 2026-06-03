import { z } from 'zod';
import { TerrainMapSchema, TerrainNodeDetailSchema, TerrainQuizSchema } from './terrain';

export const MapRequestSchema = z.object({
  topic: z.string().trim().min(1).max(80),
});

export const MapResponseSchema = z.object({
  map: TerrainMapSchema,
});

export const NodeDetailRequestSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  nodeId: z.string().min(1).max(64),
  nodeTitle: z.string().trim().min(1).max(120),
});

export const NodeDetailResponseSchema = z.object({
  detail: TerrainNodeDetailSchema,
});

export const QuizRequestSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  nodeId: z.string().min(1).max(64),
  nodeTitle: z.string().trim().min(1).max(120),
});

export const QuizResponseSchema = z.object({
  quiz: TerrainQuizSchema,
});

export const ErrorCodeSchema = z.enum([
  'MAP_GENERATION_FAILED',
  'NODE_DETAIL_GENERATION_FAILED',
  'QUIZ_GENERATION_FAILED',
  'INVALID_REQUEST',
  'LLM_UNAVAILABLE',
]);

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
  }),
});

export type MapRequest = z.infer<typeof MapRequestSchema>;
export type MapResponse = z.infer<typeof MapResponseSchema>;
export type NodeDetailRequest = z.infer<typeof NodeDetailRequestSchema>;
export type NodeDetailResponse = z.infer<typeof NodeDetailResponseSchema>;
export type QuizRequest = z.infer<typeof QuizRequestSchema>;
export type QuizResponse = z.infer<typeof QuizResponseSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
