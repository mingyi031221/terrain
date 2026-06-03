import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function cacheControl(rel: string): string {
  // Vite emits content-hashed files under /assets → safe to cache forever.
  if (rel.startsWith('assets/')) return 'public, max-age=31536000, immutable';
  // The shell, SW and manifest must always be revalidated so updates ship.
  if (rel === 'index.html' || rel === 'sw.js' || rel.endsWith('.webmanifest')) {
    return 'no-cache';
  }
  return 'public, max-age=3600';
}

/**
 * Serve the built SPA (`distDir`) for any non-API GET/HEAD request, with a
 * single-page fallback to index.html. Dependency-free so it runs offline and
 * adds nothing to the bundle.
 */
export function registerStatic(app: FastifyInstance, distDir: string): void {
  const indexFile = path.join(distDir, 'index.html');

  const send = (reply: import('fastify').FastifyReply, filePath: string, rel: string) => {
    reply.header('content-type', MIME[path.extname(filePath)] ?? 'application/octet-stream');
    reply.header('cache-control', cacheControl(rel));
    return reply.send(createReadStream(filePath));
  };

  app.setNotFoundHandler(async (request, reply) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: 'Not found' } };
    }
    // never let the SPA fallback swallow a missing API route
    if (request.url.startsWith('/api/')) {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: 'Not found' } };
    }

    const urlPath = decodeURIComponent((request.url || '/').split('?')[0]);
    let rel = urlPath.replace(/^\/+/, '');
    if (rel === '') rel = 'index.html';

    const filePath = path.resolve(distDir, rel);
    // path-traversal guard
    if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
      return send(reply, indexFile, 'index.html');
    }

    try {
      const info = await stat(filePath);
      if (info.isFile()) return send(reply, filePath, rel);
    } catch {
      // fall through to SPA shell
    }
    return send(reply, indexFile, 'index.html');
  });
}
