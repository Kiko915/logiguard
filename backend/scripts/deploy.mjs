// Deploy LogiGuard.sol to Ganache using ethers.js directly
// Run with: node scripts/deploy.mjs

import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RPC_URL     = "http://127.0.0.1:8545";

// Load compiled artifact produced by: npx hardhat compile --config hardhat.config.mjs
const artifactPath = join(
  __dirname, "..", "artifacts", "contracts", "LogiGuard.sol", "LogiGuard.json"
);
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

console.log("Deploying from:", wallet.address);

const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();

const address = await contract.getAddress();
console.log("LogiGuard deployed to:", address);

// Write backend/.env with all blockchain values pre-filled
const envContent = `# ─────────────────────────────────────────────
# Server
# ─────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ─────────────────────────────────────────────
# Appwrite — fill these in after creating your project
# ─────────────────────────────────────────────
APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=<your-project-id>
APPWRITE_API_KEY=<your-api-key>
APPWRITE_DATABASE_ID=<your-database-id>

# ─────────────────────────────────────────────
# Blockchain (Ganache Local Testnet)
# ─────────────────────────────────────────────
GANACHE_RPC_URL=http://127.0.0.1:8545
GANACHE_CHAIN_ID=1337
BLOCKCHAIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=${address}

# ─────────────────────────────────────────────
# Simulation Defaults
# ─────────────────────────────────────────────
DEFAULT_ARRIVAL_RATE=500
DEFAULT_SERVICE_RATE=600
DEFAULT_DEFECT_RATE=0.05
DEFAULT_SHIFT_HOURS=12
MONTE_CARLO_REPLICATIONS=1000

# ─────────────────────────────────────────────
# Rate Limiting
# ─────────────────────────────────────────────
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
`;

writeFileSync(join(__dirname, "..", ".env"), envContent);

console.log("\n✅ backend/.env written with blockchain config.");
console.log("   Remaining step: fill in the APPWRITE_* values.");
