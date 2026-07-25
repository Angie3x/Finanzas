import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js usa `.env.local`; cargamos ese primero y `.env` como respaldo.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
