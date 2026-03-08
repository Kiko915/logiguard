import { createMiddleware } from "hono/factory";
import { config } from "../config/index.js";
import type { ApiError } from "../types/index.js";

// ─── In-Memory Rate Limiter ────────────────────────────────────────────────────
// Production note: Replace with Redis-backed limiter (e.g., ioredis + sliding window)
// for multi-instance deployments. This in-memory version is sufficient for single-node.
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

function getClientKey(c: Parameters<typeof createMiddleware>[0] extends (c: infer C, ...args: never[]) => unknown ? C : never): string {
  // Prefer X-Forwarded-For when behind a proxy
  const forwarded = c.req.header("x-forwarded-for");
  return forwarded?.split(",")[0].trim() ?? "unknown";
}

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const key = getClientKey(c);
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.RATE_LIMIT_WINDOW_MS });
    await next();
    return;
  }

  record.count++;

  if (record.count > config.RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    c.header("Retry-After", String(retryAfter));

    const body: ApiError = {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: `Too many requests. Retry after ${retryAfter}s.`,
      },
    };
    return c.json(body, 429);
  }

  await next();
});
