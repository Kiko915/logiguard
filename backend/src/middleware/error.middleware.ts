import type { Context } from "hono";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
import type { ApiError } from "../types/index.js";

// ─── Global Error Handler ──────────────────────────────────────────────────────
// Catches all unhandled errors and returns a consistent ApiError shape.
// Prevents leaking internal stack traces in production.
export async function errorHandler(err: Error, c: Context): Promise<Response> {
  if (err instanceof ZodError) {
    const body: ApiError = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten().fieldErrors,
      },
    };
    return c.json(body, 422);
  }

  // Supabase PostgREST errors
  if ("code" in err && typeof (err as Record<string, unknown>).code === "string") {
    const pgErr = err as { code: string; message: string; details: string };
    logger.warn({ code: pgErr.code, message: pgErr.message }, "Database error");

    const body: ApiError = {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "A database error occurred",
        ...(process.env.NODE_ENV !== "production" && { details: pgErr.details }),
      },
    };
    return c.json(body, 500);
  }

  // Generic unhandled errors
  logger.error({ err, path: c.req.path, method: c.req.method }, "Unhandled error");

  const body: ApiError = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    },
  };
  return c.json(body, 500);
}

// ─── Not Found Handler ─────────────────────────────────────────────────────────
export function notFoundHandler(c: Context): Response {
  const body: ApiError = {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
  };
  return c.json(body, 404);
}
