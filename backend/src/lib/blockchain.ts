import { ethers } from "ethers";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

// ─── Blockchain Client ─────────────────────────────────────────────────────────
// Connects to local Ganache testnet. Lazily initialized on first use.
let _provider: ethers.JsonRpcProvider | null = null;
let _wallet: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(config.GANACHE_RPC_URL, {
      chainId: config.GANACHE_CHAIN_ID,
      name: "ganache",
    });
  }
  return _provider;
}

export function getWallet(): ethers.Wallet {
  if (!_wallet) {
    _wallet = new ethers.Wallet(config.BLOCKCHAIN_PRIVATE_KEY, getProvider());
  }
  return _wallet;
}

export async function checkBlockchainConnection(): Promise<boolean> {
  try {
    const provider = getProvider();
    await provider.getBlockNumber();
    logger.info("Blockchain connection established (Ganache)");
    return true;
  } catch (error) {
    logger.warn({ error }, "Blockchain connection failed — running in degraded mode");
    return false;
  }
}
