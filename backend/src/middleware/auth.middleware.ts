import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import type { JwtPayload, ApiError } from "../types/index.js";

// ─── Extend Hono Context Variables ────────────────────────────────────────────
declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

// ─── JWT Auth Middleware ───────────────────────────────────────────────────────
// Validates Bearer token and injects decoded payload into context.
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    const body: ApiError = {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" },
    };
    return c.json(body, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    c.set("user", payload);
    await next();
  } catch {
    const body: ApiError = {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    };
    return c.json(body, 401);
  }
});

// ─── Role Guard ────────────────────────────────────────────────────────────────
// Usage: requireRole("admin") or requireRole("admin", "operator")
export function requireRole(...roles: JwtPayload["role"][]) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      const body: ApiError = {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Role '${user.role}' is not authorized for this resource`,
        },
      };
      return c.json(body, 403);
    }
    await next();
  });
}
