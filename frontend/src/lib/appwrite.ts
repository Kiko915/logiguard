import { Client, Account } from "appwrite";

// ─── Appwrite Browser Client ───────────────────────────────────────────────────
// Uses the public project ID only — no API key on the frontend.
// Configure VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID in .env
const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT as string)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID as string);

export const account = new Account(client);
export { client };
