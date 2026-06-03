import { z } from 'zod';

export const TerrainNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  estimatedMinutes: z.number().int().positive(),
  required: z.boolean(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const TerrainEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.literal('prerequisite'),
});

export function checkMapInvariants(
  map: { nodes: TerrainNode[]; edges: TerrainEdge[] },
  ctx: z.RefinementCtx,
): void {
  const ids = new Set<string>();
  for (const node of map.nodes) {
    if (ids.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate node id: ${node.id}`,
        path: ['nodes'],
      });
    }
    ids.add(node.id);
  }

  map.edges.forEach((edge, i) => {
    if (edge.from === edge.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'edge cannot self-loop',
        path: ['edges', i],
      });
    }
    if (!ids.has(edge.from)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `edge.from "${edge.from}" references unknown node`,
        path: ['edges', i, 'from'],
      });
    }
    if (!ids.has(edge.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `edge.to "${edge.to}" references unknown node`,
        path: ['edges', i, 'to'],
      });
    }
  });
}

export const TerrainMapSchema = z
  .object({
    version: z.string().min(1),
    topic: z.string().min(1),
    generatedAt: z.string().min(1),
    userPositionLabel: z.string().min(1),
    nodes: z.array(TerrainNodeSchema).min(5).max(8),
    edges: z.array(TerrainEdgeSchema),
  })
  .superRefine(checkMapInvariants);

export const TerrainNodeDetailSchema = z.object({
  nodeId: z.string().min(1),
  title: z.string().min(1),
  explanation: z.string().min(50),
  whyThisMatters: z.string().min(1),
  reflectionPrompt: z.string().min(1),
  suggestedNextNodeIds: z.array(z.string().min(1)).optional(),
});

// — optional "看看你 get 到了没" mini-check (NOT an exam) —
export const QuizQuestionSchema = z
  .object({
    type: z.union([z.literal('choice'), z.literal('truefalse')]),
    question: z.string().min(4),
    options: z.array(z.string().min(1)).min(2).max(4),
    answerIndex: z.number().int().nonnegative(),
    explanation: z.string().min(4),
  })
  .superRefine((q, ctx) => {
    if (q.answerIndex >= q.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `answerIndex ${q.answerIndex} out of range for ${q.options.length} options`,
        path: ['answerIndex'],
      });
    }
    if (q.type === 'truefalse' && q.options.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'truefalse question must have exactly 2 options',
        path: ['options'],
      });
    }
    if (q.type === 'choice' && q.options.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'choice question must have at least 3 options',
        path: ['options'],
      });
    }
  });

export const TerrainQuizSchema = z.object({
  nodeId: z.string().min(1),
  questions: z.array(QuizQuestionSchema).min(2).max(3),
});

export type TerrainNode = z.infer<typeof TerrainNodeSchema>;
export type TerrainEdge = z.infer<typeof TerrainEdgeSchema>;
export type TerrainMap = z.infer<typeof TerrainMapSchema>;
export type TerrainNodeDetail = z.infer<typeof TerrainNodeDetailSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type TerrainQuiz = z.infer<typeof TerrainQuizSchema>;
