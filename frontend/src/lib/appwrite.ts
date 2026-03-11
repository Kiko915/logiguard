import { Client, Account, Databases } from "appwrite";

// ─── Appwrite Browser Client ───────────────────────────────────────────────────
// Uses the public project ID only — no API key on the frontend.
// Configure VITE_APPWRITE_* vars in frontend/.env
const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT as string)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID as string);

export const account   = new Account(client);
export const databases = new Databases(client);
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID as string;
export { client };
