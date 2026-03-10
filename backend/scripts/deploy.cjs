const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying LogiGuard with account:", deployer.address);

  const LogiGuard = await ethers.getContractFactory("LogiGuard");
  const contract  = await LogiGuard.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("LogiGuard deployed to:", address);

  // Write .env so the backend can pick it up immediately
  const envPath = path.join(__dirname, "..", ".env");
  const envContent = `# ─────────────────────────────────────────────
# Server
# ─────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ─────────────────────────────────────────────
# Appwrite
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

  fs.writeFileSync(envPath, envContent);
  console.log(".env written to backend/.env");
  console.log("\n✅ Done. Fill in the APPWRITE_* values in backend/.env to complete setup.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
