import { createMiddleware } from "hono/factory";
import { createUserClient } from "../lib/appwrite.js";
import type { AppwriteUser, ApiError } from "../types/index.js";

// ─── Extend Hono Context Variables ────────────────────────────────────────────
declare module "hono" {
  interface ContextVariableMap {
    user: AppwriteUser;
  }
}

// ─── Appwrite JWT Auth Middleware ──────────────────────────────────────────────
// Expects: Authorization: Bearer <appwrite-jwt>
// Frontend obtains the JWT via: account.createJWT()
// Role is the first entry in the user's Appwrite labels (default: "viewer").
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
    const { account } = createUserClient(token);
    const appwriteUser = await account.get();

    const role = ((appwriteUser.labels?.[0]) ?? "viewer") as AppwriteUser["role"];

    const user: AppwriteUser = {
      $id:   appwriteUser.$id,
      email: appwriteUser.email,
      name:  appwriteUser.name,
      role,
    };

    c.set("user", user);
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
export function requireRole(...roles: AppwriteUser["role"][]) {
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
