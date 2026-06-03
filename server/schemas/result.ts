import type { ZodError } from 'zod';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}
