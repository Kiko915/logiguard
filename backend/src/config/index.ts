import "dotenv/config";
import { z } from "zod";

// ─── Environment Schema ────────────────────────────────────────────────────────
// Validates all required env vars at startup. App crashes fast if misconfigured.
const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Appwrite
  APPWRITE_ENDPOINT: z.string().url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1),
  APPWRITE_DATABASE_ID: z.string().min(1),

  // Blockchain
  GANACHE_RPC_URL: z.string().url().default("http://127.0.0.1:8545"),
  GANACHE_CHAIN_ID: z.coerce.number().default(1337),
  BLOCKCHAIN_PRIVATE_KEY: z.string().min(1),
  CONTRACT_ADDRESS: z.string().min(1),

  // Simulation Defaults
  DEFAULT_ARRIVAL_RATE: z.coerce.number().default(500),
  DEFAULT_SERVICE_RATE: z.coerce.number().default(600),
  DEFAULT_DEFECT_RATE: z.coerce.number().default(0.05),
  DEFAULT_SHIFT_HOURS: z.coerce.number().default(12),
  MONTE_CARLO_REPLICATIONS: z.coerce.number().default(1000),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n");
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
