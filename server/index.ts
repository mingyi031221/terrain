import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerHealthRoute } from './routes/health';
import { registerTerrainMapRoute } from './routes/terrain-map';
import { registerTerrainNodeDetailRoute } from './routes/terrain-node-detail';
import { registerTerrainQuizRoute } from './routes/terrain-quiz';
import { registerStatic } from './lib/static';
import { RateLimiter } from './lib/rate-limit';

const isProd = process.env.NODE_ENV === 'production';
const serveStatic = isProd || process.env.SERVE_STATIC === '1';

const app = Fastify({ logger: true, trustProxy: true });

// — CORS — in the single-service prod deploy the frontend is same-origin so this
// is effectively a no-op; in dev it lets the Vite server (5173) reach the API.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : ['http://localhost:5173'];
await app.register(cors, { origin: corsOrigin });

// — rate limiting — best-effort guard so a public link can't burn the LLM quota.
const perIp = new RateLimiter(Number(process.env.RATE_LIMIT_PER_MIN ?? 20), 60_000);
const global = new RateLimiter(Number(process.env.RATE_LIMIT_GLOBAL_PER_MIN ?? 120), 60_000);
const sweep = setInterval(() => {
  perIp.sweep();
  global.sweep();
}, 60_000);
sweep.unref?.();

app.addHook('onRequest', async (request, reply) => {
  // only throttle the expensive generation endpoints
  if (request.method !== 'POST' || !request.url.startsWith('/api/terrain/')) return;
  const g = global.hit('global');
  const ip = perIp.hit(request.ip);
  const blocked = !g.ok ? g : !ip.ok ? ip : null;
  if (blocked) {
    reply.header('retry-after', Math.ceil(blocked.retryAfterMs / 1000));
    reply.code(429);
    return reply.send({
      error: { code: 'RATE_LIMITED', message: '有点挤，喝口水等几秒再试 🍵' },
    });
  }
});

await registerHealthRoute(app);
await registerTerrainMapRoute(app);
await registerTerrainNodeDetailRoute(app);
await registerTerrainQuizRoute(app);

if (serveStatic) {
  const distDir = fileURLToPath(new URL('../dist', import.meta.url));
  registerStatic(app, distDir);
  app.log.info({ distDir }, 'serving static frontend');
}

const port = Number(process.env.PORT ?? 3001);
const host = serveStatic ? '0.0.0.0' : '127.0.0.1';

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
