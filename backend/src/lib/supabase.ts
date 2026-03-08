import { createClient } from "@supabase/supabase-js";
import { config } from "../config/index.js";
import type { Database } from "../types/database.types.js";

// ─── Supabase Singleton ────────────────────────────────────────────────────────
// Service role client bypasses Row-Level Security — only for server-side use.
// Never expose this key to the frontend.
export const supabase = createClient<Database>(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
