import { Client, Databases, Users, Account } from "node-appwrite";
import { config } from "../config/index.js";

// ─── Appwrite Admin Client ──────────────────────────────────────────────────────
// Uses the API key for full server-side (admin) access.
// Never expose this key or client to the browser.
const adminClient = new Client()
  .setEndpoint(config.APPWRITE_ENDPOINT)
  .setProject(config.APPWRITE_PROJECT_ID)
  .setKey(config.APPWRITE_API_KEY);

export const databases = new Databases(adminClient);
export const users = new Users(adminClient);

// ─── JWT-Scoped Client Factory ─────────────────────────────────────────────────
// Creates a client authenticated as a specific user via their Appwrite JWT.
// Used in auth middleware to verify incoming requests.
export function createUserClient(jwt: string): { account: Account } {
  const client = new Client()
    .setEndpoint(config.APPWRITE_ENDPOINT)
    .setProject(config.APPWRITE_PROJECT_ID)
    .setJWT(jwt);

  return { account: new Account(client) };
}
