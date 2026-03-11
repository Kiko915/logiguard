/**
 * setup-appwrite.mjs
 * Creates all required Appwrite collections and attributes for LogiGuard.
 *
 * Run once:  node scripts/setup-appwrite.mjs
 *
 * Collections created:
 *   packages          — scanner results
 *   scan_logs         — per-frame scan events
 *   simulation_runs   — M/M1 + Monte Carlo results
 */

import { Client, Databases, ID } from "node-appwrite"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

// ─── Load .env manually (no dotenv dependency needed) ─────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, "../.env")

const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split("=").map((p) => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
)

const ENDPOINT    = env.APPWRITE_ENDPOINT
const PROJECT_ID  = env.APPWRITE_PROJECT_ID
const API_KEY     = env.APPWRITE_API_KEY
const DATABASE_ID = env.APPWRITE_DATABASE_ID

if (!ENDPOINT || !PROJECT_ID || !API_KEY || !DATABASE_ID) {
  console.error("❌  Missing Appwrite env vars in backend/.env")
  process.exit(1)
}

// ─── Client ───────────────────────────────────────────────────────────────────
const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY)

const db = new Databases(client)

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createCollection(id, name) {
  try {
    await db.createCollection(DATABASE_ID, id, name, [
      'read("any")',
      'create("users")',
      'update("users")',
      'delete("users")',
    ])
    console.log(`  ✔  Collection created: ${id}`)
  } catch (e) {
    if (e?.code === 409) {
      console.log(`  –  Collection already exists: ${id}`)
    } else {
      throw e
    }
  }
}

async function attr(fn, label) {
  try {
    await fn()
    console.log(`       + ${label}`)
  } catch (e) {
    if (e?.code === 409) {
      console.log(`       – ${label} (already exists)`)
    } else {
      throw e
    }
  }
}

// Small delay between API calls
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Poll until no attributes are still processing (available/failed/stuck = done)
async function waitForAttributes(collectionId, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { attributes } = await db.listAttributes(DATABASE_ID, collectionId, [])
    const processing = attributes.filter((a) => a.status === "processing")
    if (processing.length === 0) return
    await wait(800)
  }
  throw new Error(`Timed out waiting for attributes on "${collectionId}"`)
}

// ─── Collection definitions ────────────────────────────────────────────────────

async function setupPackages() {
  console.log("\n📦  packages")
  await createCollection("packages", "Packages")
  await wait(500)

  await attr(() => db.createStringAttribute(DATABASE_ID, "packages", "barcode",             128,  false),           "barcode (string, optional)")
  await attr(() => db.createEnumAttribute  (DATABASE_ID, "packages", "status",              ["good","damaged","empty"], true), "status (enum)")
  await attr(() => db.createFloatAttribute (DATABASE_ID, "packages", "confidence",          true, 0, 1),            "confidence (float)")
  await attr(() => db.createIntegerAttribute(DATABASE_ID,"packages", "scan_time_ms",        true, 0),               "scan_time_ms (integer)")
  await attr(() => db.createStringAttribute(DATABASE_ID, "packages", "blockchain_tx_hash",  256,  false),           "blockchain_tx_hash (string, optional)")
  await attr(() => db.createDatetimeAttribute(DATABASE_ID,"packages","blockchain_logged_at",false),                 "blockchain_logged_at (datetime, optional)")
  await attr(() => db.createDatetimeAttribute(DATABASE_ID,"packages","scanned_at",          true),                  "scanned_at (datetime)")

  // Wait for all attributes to be ready, then create indexes
  process.stdout.write("       ⏳ waiting for attributes…")
  await waitForAttributes("packages")
  console.log(" ready")
  try {
    await db.createIndex(DATABASE_ID, "packages", "idx_status",     "key",    ["status"])
    await db.createIndex(DATABASE_ID, "packages", "idx_scanned_at", "key",    ["scanned_at"])
    await db.createIndex(DATABASE_ID, "packages", "idx_barcode",    "unique", ["barcode"])
    console.log("       + indexes created")
  } catch (e) {
    if (e?.code !== 409) throw e
    console.log("       – indexes already exist")
  }
}

async function setupScanLogs() {
  console.log("\n📋  scan_logs")
  await createCollection("scan_logs", "Scan Logs")
  await wait(500)

  await attr(() => db.createStringAttribute (DATABASE_ID, "scan_logs", "package_id",    36,   true),  "package_id (string)")
  await attr(() => db.createEnumAttribute   (DATABASE_ID, "scan_logs", "status",        ["good","damaged","empty"], true), "status (enum)")
  await attr(() => db.createFloatAttribute  (DATABASE_ID, "scan_logs", "confidence",    true, 0, 1),  "confidence (float)")
  await attr(() => db.createIntegerAttribute(DATABASE_ID, "scan_logs", "scan_time_ms",  true, 0),     "scan_time_ms (integer)")
  await attr(() => db.createStringAttribute (DATABASE_ID, "scan_logs", "frame_data_url",2048, false), "frame_data_url (string, optional)")
  await attr(() => db.createStringAttribute (DATABASE_ID, "scan_logs", "metadata",      4096, false), "metadata (string/JSON, optional)")

  process.stdout.write("       ⏳ waiting for attributes…")
  await waitForAttributes("scan_logs")
  console.log(" ready")
  try {
    await db.createIndex(DATABASE_ID, "scan_logs", "idx_package_id", "key", ["package_id"])
    await db.createIndex(DATABASE_ID, "scan_logs", "idx_status",     "key", ["status"])
    console.log("       + indexes created")
  } catch (e) {
    if (e?.code !== 409) throw e
    console.log("       – indexes already exist")
  }
}

async function setupSimulationRuns() {
  console.log("\n📊  simulation_runs")
  await createCollection("simulation_runs", "Simulation Runs")
  await wait(500)

  // Stored as JSON strings because Appwrite doesn't support nested objects natively
  await attr(() => db.createStringAttribute(DATABASE_ID, "simulation_runs", "parameters",          65535, true),  "parameters (JSON string)")
  await attr(() => db.createStringAttribute(DATABASE_ID, "simulation_runs", "theoretical_metrics", 65535, true),  "theoretical_metrics (JSON string)")
  await attr(() => db.createStringAttribute(DATABASE_ID, "simulation_runs", "monte_carlo_results",  65535, true), "monte_carlo_results (JSON string)")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("🚀  LogiGuard — Appwrite collection setup")
console.log(`    Endpoint:    ${ENDPOINT}`)
console.log(`    Project:     ${PROJECT_ID}`)
console.log(`    Database:    ${DATABASE_ID}`)

try {
  await setupPackages()
  await setupScanLogs()
  await setupSimulationRuns()

  console.log("\n✅  All collections ready. You can now start the backend.\n")
} catch (err) {
  console.error("\n❌  Setup failed:", err?.message ?? err)
  process.exit(1)
}
