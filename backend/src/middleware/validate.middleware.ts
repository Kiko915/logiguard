import type { ZodSchema } from "zod";
import type { Context } from "hono";
import type { ApiError } from "../types/index.js";

// ─── Request Validator Helpers ─────────────────────────────────────────────────
// Validates and returns parsed data, or returns a 422 response.

export async function validateBody<T>(
  c: Context,
  schema: ZodSchema<T>
): Promise<{ data: T } | Response> {
  let raw: unknown;

  try {
    raw = await c.req.json();
  } catch {
    const body: ApiError = {
      success: false,
      error: { code: "INVALID_JSON", message: "Request body must be valid JSON" },
    };
    return c.json(body, 400);
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const body: ApiError = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body validation failed",
        details: result.error.flatten().fieldErrors,
      },
    };
    return c.json(body, 422);
  }

  return { data: result.data };
}

export function validateQuery<T>(
  c: Context,
  schema: ZodSchema<T>
): { data: T } | Response {
  const raw = Object.fromEntries(new URL(c.req.url).searchParams);
  const result = schema.safeParse(raw);

  if (!result.success) {
    const body: ApiError = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Query parameter validation failed",
        details: result.error.flatten().fieldErrors,
      },
    };
    return c.json(body, 422);
  }

  return { data: result.data };
}
